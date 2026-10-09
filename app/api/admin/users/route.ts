import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../lib/supabaseAdmin";
import { assertAdmin, authErrorResponse } from "../../../../lib/matchAuth";

export const runtime = "nodejs";

const VALID_ROLES = ["administrator", "stat_tracker", "referee", "media"] as const;
type SiteRole = (typeof VALID_ROLES)[number];

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

// GET - lists everyone who has ever logged in with Discord on the
// site (one row in `profiles` per person) together with their current
// roles in `site_user_roles`. Only an Admin (Owner, Discord
// Administrator, or someone who already has the 'administrator' role)
// can call this.
export async function GET(request: NextRequest) {
  const auth = await assertAdmin(request);
  if (!auth.ok) return authErrorResponse(auth);
  const access = auth.access;

  const supabase = getSupabaseAdmin();
  if (!supabase) return jsonError("Supabase is not configured.", 500);

  const [{ data: profiles, error: profilesError }, { data: roleRows, error: rolesError }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, discord_id, discord_username, discord_global_name, avatar_url")
      .order("discord_username", { ascending: true }),
    supabase.from("site_user_roles").select("profile_id, role"),
  ]);

  if (profilesError) return jsonError(profilesError.message, 500);
  if (rolesError) return jsonError(rolesError.message, 500);

  const rolesByProfile = new Map<string, string[]>();
  for (const row of roleRows ?? []) {
    const list = rolesByProfile.get(row.profile_id) ?? [];
    list.push(row.role);
    rolesByProfile.set(row.profile_id, list);
  }

  const ownerDiscordId = process.env.DISCORD_OWNER_ID || "";

  const users = (profiles ?? [])
    .filter((p) => p.discord_id)
    .map((p) => ({
      id: p.id,
      discord_id: p.discord_id,
      discord_username: p.discord_username,
      discord_global_name: p.discord_global_name,
      avatar_url: p.avatar_url,
      isOwner: Boolean(ownerDiscordId) && p.discord_id === ownerDiscordId,
      roles: rolesByProfile.get(p.id) ?? [],
    }));

  return NextResponse.json({ users });
}

// POST - grants or revokes a role (administrator / stat_tracker /
// referee / media) for a profile. Only Admin can call this. The Owner
// themselves can't be touched by mistake (the Owner always has access
// via DISCORD_OWNER_ID, so granting/revoking their roles would do
// nothing useful and would only confuse the list).
export async function POST(request: NextRequest) {
  const auth = await assertAdmin(request);
  if (!auth.ok) return authErrorResponse(auth);
  const access = auth.access;

  const supabase = getSupabaseAdmin();
  if (!supabase) return jsonError("Supabase is not configured.", 500);

  const body = await request.json().catch(() => ({}));
  const profileId = String(body?.profileId ?? "").trim();
  const role = String(body?.role ?? "").trim() as SiteRole;
  const action = body?.action as "grant" | "revoke" | undefined;

  if (!profileId || !VALID_ROLES.includes(role) || (action !== "grant" && action !== "revoke")) {
    return jsonError("Invalid payload.", 400);
  }

  if (action === "grant") {
    const { error } = await supabase
      .from("site_user_roles")
      .upsert(
        { profile_id: profileId, role, granted_by: access.profileId },
        { onConflict: "profile_id,role" },
      );
    if (error) return jsonError(error.message, 500);
  } else {
    const { error } = await supabase
      .from("site_user_roles")
      .delete()
      .eq("profile_id", profileId)
      .eq("role", role);
    if (error) return jsonError(error.message, 500);
  }

  return NextResponse.json({ ok: true });
}
