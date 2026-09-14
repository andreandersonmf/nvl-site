import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseUrl       = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceKey        = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const botToken          = process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN || "";

const matchLinksChannelId  = process.env.MATCH_LINKS_CHANNEL_ID  || "1544780635384578061";
const streamAlertChannelId = process.env.STREAM_ALERT_CHANNEL_ID || "1545074917639323768";
const streamAlertRoleId    = process.env.STREAM_ALERT_ROLE_ID    || "1544780634411765886";

const supabaseAdmin = supabaseUrl && serviceKey
  ? createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

function jsonError(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

async function assertRefereeOrAdmin(request: NextRequest, matchId: number) {
  if (!supabaseAdmin) return { ok: false, reason: "Supabase not configured." };

  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return { ok: false, reason: "Not authenticated." };

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return { ok: false, reason: "Invalid session." };

  // Check role
  const { data: roleRow } = await supabaseAdmin
    .from("site_user_roles")
    .select("role")
    .eq("user_id", data.user.id)
    .maybeSingle();

  // Admins always pass
  if (roleRow?.role === "administrator") return { ok: true };

  // For referees: match by discord_username from profile → staff_applications
  if (roleRow?.role === "referee") {
    // Get the logged-in user's Discord username from their profile
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("discord_username, discord_id")
      .eq("auth_user_id", data.user.id)
      .maybeSingle();

    if (!profile) return { ok: false, reason: "Profile not found." };

    // Find their approved referee application by discord_username OR discord_id
    const { data: apps } = await supabaseAdmin
      .from("staff_applications")
      .select("id")
      .eq("role", "Referee")
      .eq("approved", true);

    if (!apps || apps.length === 0)
      return { ok: false, reason: "No approved referee application found." };

    // Find by discord_username (case-insensitive) or discord_id
    const { data: appRow } = await supabaseAdmin
      .from("staff_applications")
      .select("id")
      .eq("role", "Referee")
      .eq("approved", true)
      .or(
        `discord_username.ilike.${profile.discord_username},discord_id.eq.${profile.discord_id}`
      )
      .maybeSingle();

    if (!appRow) return { ok: false, reason: "Referee application not found for your account." };

    // Check if this referee is assigned to the match
    const { data: match } = await supabaseAdmin
      .from("matches")
      .select("referee_id")
      .eq("id", matchId)
      .maybeSingle();

    if (match?.referee_id === appRow.id) return { ok: true };

    return { ok: false, reason: "You are not assigned as referee for this match." };
  }

  return { ok: false, reason: "You are not assigned as referee for this match." };
}

async function sendDiscordMessage(channelId: string, body: Record<string, unknown>) {
  if (!botToken) throw new Error("DISCORD_BOT_TOKEN not configured.");
  const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Discord ${res.status}: ${txt}`);
  }
  return res.json();
}

export async function POST(request: NextRequest) {
  try {
    if (!supabaseAdmin) return jsonError("Supabase not configured.", 500);

    const body = await request.json().catch(() => ({}));
    const { matchId, matchLink, streamLink, streamerDiscordId } = body as {
      matchId: number;
      matchLink: string;
      streamLink?: string;
      streamerDiscordId?: string;
    };

    if (!matchId) return jsonError("matchId required.");
    if (!matchLink?.trim()) return jsonError("matchLink is required.");

    const auth = await assertRefereeOrAdmin(request, matchId);
    if (!auth.ok) return jsonError(auth.reason!, 403);

    // Fetch match
    const { data: match, error: mErr } = await supabaseAdmin
      .from("matches")
      .select("*")
      .eq("id", matchId)
      .maybeSingle();

    if (mErr || !match) return jsonError("Match not found.", 404);
    if (match.status !== "Scheduled")
      return jsonError(`Match is already ${match.status} — cannot start.`, 409);

    // Update to Live
    const { error: updErr } = await supabaseAdmin
      .from("matches")
      .update({
        status: "Live",
        match_link: matchLink.trim(),
        stream_link: streamLink?.trim() || null,
        streamer_discord_id: streamerDiscordId?.trim() || null,
      })
      .eq("id", matchId);

    if (updErr) return jsonError(updErr.message, 500);

    const star = match.is_star_match ? " ⭐" : "";

    // Post in #match-links
    await sendDiscordMessage(matchLinksChannelId, {
      embeds: [{
        title: `🏐 MATCH STARTING${star}`,
        description: `**${match.home_country}** vs **${match.away_country}**`,
        color: 0xef4444,
        fields: [
          { name: "Stage",  value: match.stage || "TBA", inline: true },
          { name: "Status", value: "`LIVE NOW`",         inline: true },
        ],
        footer: { text: "National Volleyball League • Click the button to join" },
        timestamp: new Date().toISOString(),
      }],
      components: [{
        type: 1,
        components: [{
          type: 2,
          style: 5,
          label: "Click here to join the match",
          url: matchLink.trim(),
        }],
      }],
    });

    // Stream alert if provided
    if (streamLink?.trim()) {
      const streamerMention = streamerDiscordId ? `<@${streamerDiscordId}>` : "Streamer";
      await sendDiscordMessage(streamAlertChannelId, {
        content: `<@&${streamAlertRoleId}> 🔴 **NVL match is LIVE${star}:** ${match.home_country} vs ${match.away_country} — streamed by ${streamerMention}`,
        embeds: [{
          title: `🎥 NVL LIVE STREAM${star}`,
          description: `**${match.home_country}** vs **${match.away_country}** is live now!`,
          color: 0xef4444,
          fields: [
            { name: "Stage",  value: match.stage || "TBA", inline: true },
            { name: "Stream", value: streamLink.trim(),    inline: false },
          ],
          footer: { text: "National Volleyball League • Stream Alert" },
          timestamp: new Date().toISOString(),
        }],
        allowed_mentions: { roles: [streamAlertRoleId] },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return jsonError(e?.message || "Unexpected error.", 500);
  }
}
