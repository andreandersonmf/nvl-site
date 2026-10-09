import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { assertAdmin, authErrorResponse } from "@/lib/matchAuth";

export const runtime = "nodejs";

const supabaseUrl   = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceKey    = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const guildId       = process.env.DISCORD_GUILD_ID || process.env.GUILD_ID || "";
const botToken      = process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN || "";

// Role IDs for each staff type (matching config.py in the bot)
const ROLE_IDS: Record<string, string> = {
  Referee:        process.env.STAFF_REFEREE_ROLE_ID     || "1544780634441121827",
  Media:          process.env.STAFF_STREAMER_ROLE_ID    || "1544780634441121826",
  "Stat Tracker": process.env.STAFF_STAT_TRACKER_ROLE_ID || "1548018986204139611",
};

const supabaseAdmin = supabaseUrl && serviceKey
  ? createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function addDiscordRole(discordId: string, roleId: string): Promise<string | null> {
  if (!botToken || !guildId || !discordId || !roleId) return "Missing config";
  const res = await fetch(
    `https://discord.com/api/v10/guilds/${guildId}/members/${discordId}/roles/${roleId}`,
    {
      method: "PUT",
      headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
    }
  );
  if (!res.ok && res.status !== 204) {
    const txt = await res.text().catch(() => "");
    return `Discord API error ${res.status}: ${txt}`;
  }
  return null;
}

async function removeDiscordRole(discordId: string, roleId: string): Promise<string | null> {
  if (!botToken || !guildId || !discordId || !roleId) return "Missing config";
  const res = await fetch(
    `https://discord.com/api/v10/guilds/${guildId}/members/${discordId}/roles/${roleId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
    }
  );
  if (!res.ok && res.status !== 204) {
    const txt = await res.text().catch(() => "");
    return `Discord API error ${res.status}: ${txt}`;
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    if (!supabaseAdmin) return jsonError("Supabase not configured.", 500);

    const auth = await assertAdmin(request);
    if (!auth.ok) return authErrorResponse(auth);

    const body = await request.json().catch(() => ({}));
    const staffId = Number(body?.staffId);
    const action = String(body?.action || "approve");
    const requestedDiscordId = String(body?.discordId || "").trim();

    if (!staffId) return jsonError("staffId required.");

    // Fetch the application
    const { data: app, error: fetchErr } = await supabaseAdmin
      .from("staff_applications")
      .select("*")
      .eq("id", staffId)
      .maybeSingle();

    if (fetchErr || !app) return jsonError("Application not found.", 404);

    const roleId = ROLE_IDS[app.role as string];

    // Admins can repair/sync the Discord ID of already-approved staff without
    // forcing them to submit a new application. The same action also applies
    // the correct Discord role when the application is already approved.
    if (action === "sync_discord_id") {
      if (!/^\d{15,25}$/.test(requestedDiscordId)) {
        return jsonError("A valid Discord User ID is required.");
      }

      const previousDiscordId = app.discord_id ? String(app.discord_id) : null;

      const { error: updateDiscordErr } = await supabaseAdmin
        .from("staff_applications")
        .update({ discord_id: requestedDiscordId })
        .eq("id", staffId);

      if (updateDiscordErr) return jsonError(updateDiscordErr.message, 500);

      let discordNote: string | null = null;
      if (app.approved && roleId) {
        const addErr = await addDiscordRole(requestedDiscordId, roleId);
        if (addErr) {
          discordNote = addErr;
        } else if (previousDiscordId && previousDiscordId !== requestedDiscordId) {
          // Best-effort cleanup of the old linked account. A failure here should
          // not undo the newly saved ID or newly applied role.
          await removeDiscordRole(previousDiscordId, roleId);
        }
      } else if (app.approved && !roleId) {
        discordNote = `Unknown role type: ${app.role}`;
      }

      return NextResponse.json({
        ok: true,
        discordNote,
        roleApplied: Boolean(app.approved && roleId && !discordNote),
      });
    }

    if (action !== "approve") return jsonError("Unknown staff action.");

    // Approve in DB
    const { error: updateErr } = await supabaseAdmin
      .from("staff_applications")
      .update({ approved: true, approved_at: new Date().toISOString() })
      .eq("id", staffId);

    if (updateErr) return jsonError(updateErr.message, 500);

    // Try to give Discord role
    let discordNote: string | null = null;

    if (roleId && app.discord_id) {
      const err = await addDiscordRole(String(app.discord_id), roleId);
      if (err) discordNote = err;
    } else if (!app.discord_id) {
      discordNote = "No Discord ID on application — save the Discord ID on this staff member to apply the role.";
    } else if (!roleId) {
      discordNote = `Unknown role type: ${app.role}`;
    }

    return NextResponse.json({ ok: true, discordNote, roleApplied: Boolean(roleId && app.discord_id && !discordNote) });
  } catch (e: any) {
    return jsonError(e?.message || "Unexpected error.", 500);
  }
}
