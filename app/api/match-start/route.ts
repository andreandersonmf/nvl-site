import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { authErrorResponse, authorizeAdminOrAssignedReferee, getAuthenticatedAccess } from "@/lib/matchAuth";

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
      matchId: number | string;
      matchLink: string;
      streamLink?: string;
      streamerDiscordId?: string;
    };

    if (!matchId || !Number.isFinite(Number(matchId))) return jsonError("matchId required.");
    if (!matchLink?.trim()) return jsonError("matchLink is required.");

    // 401 when not logged in (checked before anything else is revealed).
    const session = await getAuthenticatedAccess(request);
    if (!session.ok) return authErrorResponse(session);

    // The match is always read from the database; the caller's request body
    // is never trusted for who the referee is.
    const { data: match, error: mErr } = await supabaseAdmin
      .from("matches")
      .select("*")
      .eq("id", Number(matchId))
      .maybeSingle();

    if (mErr) return jsonError(mErr.message, 500);

    // Admin: any match. Referee: only a match assigned to them. Others: 403.
    // (A missing match is answered with 403 for non-admins so ids can't be probed.)
    if (!match) {
      return session.access.isAdmin ? jsonError("Match not found.", 404) : jsonError("You do not have permission to start this match.", 403);
    }
    const authz = authorizeAdminOrAssignedReferee(session.access, match);
    if (!authz.ok) return authErrorResponse(authz);

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
      .eq("id", match.id)
      .eq("status", "Scheduled");

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
          { name: "Status", value: "`LIVE NOW`",          inline: true },
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
