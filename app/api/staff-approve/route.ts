import { NextRequest, NextResponse } from "next/server";
import { extractBearerToken, getEffectiveAccess } from "@/lib/adminAccess";
import { createClient } from "@supabase/supabase-js";

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

async function assertAdmin(request: NextRequest) {
  const token = extractBearerToken(request.headers.get("authorization"));
  const access = await getEffectiveAccess(token);
  return access.isAdmin;
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

export async function POST(request: NextRequest) {
  try {
    if (!supabaseAdmin) return jsonError("Supabase not configured.", 500);

    const isAdmin = await assertAdmin(request);
    if (!isAdmin) return jsonError("Admin only.", 403);

    const { staffId } = await request.json().catch(() => ({}));
    if (!staffId) return jsonError("staffId required.");

    // Fetch the application
    const { data: app, error: fetchErr } = await supabaseAdmin
      .from("staff_applications")
      .select("*")
      .eq("id", staffId)
      .maybeSingle();

    if (fetchErr || !app) return jsonError("Application not found.", 404);

    // Approve in DB
    const { error: updateErr } = await supabaseAdmin
      .from("staff_applications")
      .update({ approved: true, approved_at: new Date().toISOString() })
      .eq("id", staffId);

    if (updateErr) return jsonError(updateErr.message, 500);

    // Try to give Discord role
    let discordNote: string | null = null;
    const roleId = ROLE_IDS[app.role as string];

    if (roleId && app.discord_id) {
      const err = await addDiscordRole(String(app.discord_id), roleId);
      if (err) discordNote = err;
    } else if (!app.discord_id) {
      discordNote = "No discord_id on application — role not applied automatically.";
    } else if (!roleId) {
      discordNote = `Unknown role type: ${app.role}`;
    }

    return NextResponse.json({ ok: true, discordNote });
  } catch (e: any) {
    return jsonError(e?.message || "Unexpected error.", 500);
  }
}
