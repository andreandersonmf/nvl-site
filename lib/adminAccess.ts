import { getSupabaseAdmin } from "./supabaseAdmin";
import { isDiscordServerAdmin } from "./discordServer";

// Central authorization point for the site. This is ADDITIVE to the
// old admin/password login (which keeps working exactly as before,
// via the original `user_roles` table) - it never replaces it.
// Someone becomes a panel Admin if ANY of these is true:
//
//   1. It's the old fixed login (user_roles.role = 'admin' for the auth uid).
//   2. discord_id matches DISCORD_OWNER_ID (site's .env) -> Owner.
//   3. They have the "Administrator" permission on the Discord server
//      (checked via the bot token, requires DISCORD_GUILD_ID to be set).
//   4. They have an 'administrator' row in `site_user_roles` (granted
//      by another Admin in the panel's Users tab).
//
// Stat Tracker / Referee / Media follow the same pattern: Admin can
// always do everything; otherwise they depend on a matching row in
// `site_user_roles`.

export type EffectiveAccess = {
  authenticated: boolean;
  profileId: string | null;
  discordId: string | null;
  discordUsername: string | null;
  avatarUrl: string | null;
  isOwner: boolean;
  isAdmin: boolean;
  isStatTracker: boolean;
  // isReferee is kept for backwards compatibility: it is true for Admins too
  // (Admin can always do everything). Use isRefereeStaff / refereeStaffIds to
  // know whether the person is really a Referee (and which one).
  isReferee: boolean;
  // true only when the person is a Referee in their own right: either the
  // 'referee' row in site_user_roles, or an approved Referee application.
  isRefereeStaff: boolean;
  // staff_applications.id of every approved Referee application linked to this
  // person's Discord ID. This is what matches.referee_id points to.
  refereeStaffIds: number[];
  // What the server saw while looking for this person's Referee applications.
  // Only about the logged-in person themselves; shown in the Referee panel when
  // no assigned match appears, to make linking problems visible.
  refereeLookup: { profileLinked: boolean; discordIds: string[]; applicationsFound: number; lookupError?: string | null };
  isMedia: boolean;
  roles: string[];
};

const NO_ACCESS: EffectiveAccess = {
  authenticated: false,
  profileId: null,
  discordId: null,
  discordUsername: null,
  avatarUrl: null,
  isOwner: false,
  isAdmin: false,
  isStatTracker: false,
  isReferee: false,
  isRefereeStaff: false,
  refereeStaffIds: [],
  refereeLookup: { profileLinked: false, discordIds: [], applicationsFound: 0 },
  isMedia: false,
  roles: [],
};

export function extractBearerToken(authHeader: string | null | undefined): string | null {
  if (!authHeader) return null;
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  return token || null;
}

export async function getEffectiveAccess(token: string | null): Promise<EffectiveAccess> {
  const supabase = getSupabaseAdmin();
  if (!supabase || !token) return NO_ACCESS;

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return NO_ACCESS;

  const user = userData.user;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, discord_id, discord_username, avatar_url")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const { data: legacyRoleRow } = await supabase
    .from("user_roles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const legacyIsAdmin = legacyRoleRow?.role === "admin";

  // The Discord ID normally comes from the site's profile row. If that row is
  // missing / not linked to this login, fall back to the Discord identity that
  // Supabase Auth itself verified for this session (always a string, never edited
  // by the user), so approved staff are still recognised.
  const isDiscordSnowflake = (v: unknown): v is string => typeof v === "string" && /^\d{5,25}$/.test(v);
  const authDiscordIds = Array.from(
    new Set(
      [
        ...(user.identities ?? [])
          .filter((identity) => identity.provider === "discord")
          .flatMap((identity) => [
            identity.id,
            identity.identity_data?.provider_id,
            identity.identity_data?.sub,
          ]),
        user.user_metadata?.provider_id,
        user.user_metadata?.sub,
      ].filter(isDiscordSnowflake),
    ),
  );
  const authDiscordId = authDiscordIds[0] ?? null;
  const profileDiscordId = profile?.discord_id ? String(profile.discord_id) : null;
  const discordId = profileDiscordId ?? authDiscordId;
  const ownerDiscordId = process.env.DISCORD_OWNER_ID || "";
  const isOwner = Boolean(ownerDiscordId) && discordId === ownerDiscordId;

  let siteRoles: string[] = [];
  if (profile?.id) {
    const { data: roleRows } = await supabase
      .from("site_user_roles")
      .select("role")
      .eq("profile_id", profile.id);
    siteRoles = (roleRows ?? []).map((r) => r.role as string);
  }

  // An approved Referee application (matched by Discord ID) counts as being a
  // Referee even if nobody granted the 'referee' row in site_user_roles. This
  // is what lets freshly approved referees reach their assigned matches.
  // The person's approved Referee applications. Linked by the verified Discord
  // ID (profile or Supabase Auth identity) OR by the login that submitted the
  // application (staff_applications.user_id).
  const staffLookupIds = Array.from(new Set([profileDiscordId, ...authDiscordIds].filter((v): v is string => Boolean(v))));
  const linkFilters = [`user_id.eq.${user.id}`];
  if (staffLookupIds.length > 0) linkFilters.push(`discord_id.in.(${staffLookupIds.join(",")})`);
  const { data: staffRows, error: staffError } = await supabase
    .from("staff_applications")
    .select("id")
    .ilike("role", "referee")
    .eq("approved", true)
    .or(linkFilters.join(","));
  if (staffError) console.error("[adminAccess] staff_applications lookup failed:", staffError.message);
  const refereeStaffIds = (staffRows ?? []).map((r) => Number(r.id)).filter((n) => Number.isFinite(n));

  const isServerAdmin = discordId ? await isDiscordServerAdmin(discordId) : false;

  const isAdmin = legacyIsAdmin || isOwner || isServerAdmin || siteRoles.includes("administrator");
  const isStatTracker = isAdmin || siteRoles.includes("stat_tracker");
  const isRefereeStaff = siteRoles.includes("referee") || refereeStaffIds.length > 0;
  const isReferee = isAdmin || isRefereeStaff;
  const isMedia = isAdmin || siteRoles.includes("media");

  return {
    authenticated: true,
    profileId: profile?.id ?? null,
    discordId,
    discordUsername: profile?.discord_username ?? null,
    avatarUrl: profile?.avatar_url ?? null,
    isOwner,
    isAdmin,
    isStatTracker,
    isReferee,
    isRefereeStaff,
    refereeStaffIds,
    refereeLookup: {
      profileLinked: Boolean(profile?.id),
      discordIds: staffLookupIds,
      applicationsFound: refereeStaffIds.length,
      lookupError: staffError?.message ?? null,
    },
    isMedia,
    roles: siteRoles,
  };
}
