import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const botToken = process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN || "";
const resultsChannelId = process.env.MATCH_RESULTS_CHANNEL_ID || "1544780635384578062";

const supabaseAdmin = supabaseUrl && serviceKey
  ? createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function cleanId(value: unknown) {
  return String(value ?? "").trim();
}

async function getAuthContext(request: NextRequest) {
  if (!supabaseAdmin) return { ok: false, reason: "Supabase not configured." };

  const token = cleanId(request.headers.get("authorization")).replace(/^Bearer\s+/i, "");
  if (!token) return { ok: false, reason: "Not authenticated." };

  const { data: authData, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !authData.user) return { ok: false, reason: "Invalid session." };

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id, discord_id")
    .eq("auth_user_id", authData.user.id)
    .maybeSingle();

  if (!profile) return { ok: false, reason: "Profile not found. Please log in via Discord first." };

  const { data: roleRows } = await supabaseAdmin
    .from("site_user_roles")
    .select("role")
    .eq("profile_id", profile.id);

  const roles = (roleRows ?? []).map((row) => String(row.role));
  return {
    ok: true,
    isAdmin: roles.includes("administrator"),
    isReferee: roles.includes("referee"),
    discordId: profile.discord_id ? String(profile.discord_id) : null,
  };
}

async function assertCanFinish(request: NextRequest, match: any) {
  const auth = await getAuthContext(request);
  if (!auth.ok) return auth;
  if (auth.isAdmin) return auth;

  if (!auth.isReferee || !auth.discordId) {
    return { ok: false, reason: "You do not have permission to finish matches." };
  }

  const { data: staff } = await supabaseAdmin!
    .from("staff_applications")
    .select("id, discord_id")
    .eq("role", "Referee")
    .eq("approved", true)
    .eq("discord_id", auth.discordId)
    .maybeSingle();

  if (!staff || Number(match.referee_id) !== Number(staff.id)) {
    return { ok: false, reason: "You are not assigned as referee for this match." };
  }

  return auth;
}

async function sendDiscordMessage(body: Record<string, unknown>) {
  if (!botToken) throw new Error("DISCORD_BOT_TOKEN not configured.");
  const response = await fetch(`https://discord.com/api/v10/channels/${resultsChannelId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Discord ${response.status}: ${text}`);
  }
}

function setLines(body: any) {
  const sets = [
    [body.set1_home, body.set1_away],
    [body.set2_home, body.set2_away],
    [body.set3_home, body.set3_away],
    [body.set4_home, body.set4_away],
    [body.set5_home, body.set5_away],
  ];
  return sets
    .map(([home, away], index) => home == null || away == null ? null : `Set ${index + 1}: **${home} – ${away}**`)
    .filter(Boolean)
    .join("\n") || "Sets not filled yet.";
}

export async function POST(request: NextRequest) {
  try {
    if (!supabaseAdmin) return jsonError("Supabase not configured.", 500);

    const body = await request.json().catch(() => ({}));
    const matchId = Number(body.matchId);
    if (!matchId) return jsonError("matchId required.");

    const { data: match, error: matchError } = await supabaseAdmin
      .from("matches")
      .select("*")
      .eq("id", matchId)
      .maybeSingle();

    if (matchError || !match) return jsonError("Match not found.", 404);
    if (match.status === "Finished") return jsonError("Match is already Finished.", 409);

    const auth = await assertCanFinish(request, match);
    if (!auth.ok) return jsonError(auth.reason!, 403);

    const setValues = {
      set1_home: body.set1_home == null ? null : Number(body.set1_home),
      set1_away: body.set1_away == null ? null : Number(body.set1_away),
      set2_home: body.set2_home == null ? null : Number(body.set2_home),
      set2_away: body.set2_away == null ? null : Number(body.set2_away),
      set3_home: body.set3_home == null ? null : Number(body.set3_home),
      set3_away: body.set3_away == null ? null : Number(body.set3_away),
      set4_home: body.set4_home == null ? null : Number(body.set4_home),
      set4_away: body.set4_away == null ? null : Number(body.set4_away),
      set5_home: body.set5_home == null ? null : Number(body.set5_home),
      set5_away: body.set5_away == null ? null : Number(body.set5_away),
    };

    const sets = [
      [setValues.set1_home, setValues.set1_away],
      [setValues.set2_home, setValues.set2_away],
      [setValues.set3_home, setValues.set3_away],
      [setValues.set4_home, setValues.set4_away],
      [setValues.set5_home, setValues.set5_away],
    ];
    const homeScore = sets.filter(([home, away]) => home != null && away != null && home > away).length;
    const awayScore = sets.filter(([home, away]) => home != null && away != null && away > home).length;

    const winnerCountry = homeScore === awayScore
      ? match.winner_country
      : homeScore > awayScore ? match.home_country : match.away_country;

    let refereeDiscordId = match.referee_discord_id || null;
    if (!refereeDiscordId && auth.discordId) refereeDiscordId = auth.discordId;

    const updatePayload = {
      status: "Finished",
      home_score: homeScore,
      away_score: awayScore,
      winner_country: winnerCountry,
      referee_discord_id: refereeDiscordId,
      ...setValues,
      stats_submitted_for_review: false,
      discord_rating_sent: false,
    };

    const { data: finishedMatch, error: updateError } = await supabaseAdmin
      .from("matches")
      .update(updatePayload)
      .eq("id", matchId)
      .neq("status", "Finished")
      .select("*")
      .maybeSingle();

    if (updateError) return jsonError(updateError.message, 500);
    if (!finishedMatch) return jsonError("Match could not be finished.", 409);

    const star = finishedMatch.is_star_match ? " ⭐" : "";
    const score = `${finishedMatch.home_score ?? 0} – ${finishedMatch.away_score ?? 0}`;
    const referee = finishedMatch.referee_discord_id ? `<@${finishedMatch.referee_discord_id}>` : "N/A";
    const wmvp = finishedMatch.wmvp_discord_id ? `<@${finishedMatch.wmvp_discord_id}>` : "N/A";
    const lmvp = finishedMatch.lmvp_discord_id ? `<@${finishedMatch.lmvp_discord_id}>` : "N/A";
    const streamer = finishedMatch.streamer_discord_id ? `<@${finishedMatch.streamer_discord_id}>` : null;

    const fields: { name: string; value: string; inline: boolean }[] = [
      { name: "Stage", value: finishedMatch.stage || "TBA", inline: true },
      { name: "Winner", value: finishedMatch.winner_country ? `🏅 **${finishedMatch.winner_country}**` : "—", inline: true },
      { name: "Set Scores", value: setLines(finishedMatch), inline: false },
      { name: "WMVP", value: wmvp, inline: true },
      { name: "LMVP", value: lmvp, inline: true },
      { name: "Referee", value: referee, inline: false },
    ];
    if (streamer) fields.push({ name: "Streamer", value: streamer, inline: true });

    try {
      await sendDiscordMessage({
        embeds: [{
          title: `🏆 NVL MATCH RESULT${star}`,
          description: `**${finishedMatch.home_country || "Home"}** ${score} **${finishedMatch.away_country || "Away"}**`,
          color: 0xf59e0b,
          fields,
          footer: { text: "National Volleyball League • Final Result" },
          timestamp: new Date().toISOString(),
        }],
      });
    } catch (discordError: any) {
      return NextResponse.json({
        ok: true,
        discordNotificationError: discordError?.message || "Discord notification failed.",
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return jsonError(error?.message || "Unexpected error.", 500);
  }
}
