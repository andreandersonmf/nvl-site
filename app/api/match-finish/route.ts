import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { assertAdmin, authErrorResponse } from "@/lib/matchAuth";

export const runtime = "nodejs";

// FINISH STATS / FINISH MATCH - ADMIN ONLY.
// Referees (even the one assigned to the match) are always rejected with 403;
// unauthenticated callers get 401. The check runs on the server, before the
// match is even read, so it cannot be bypassed from the browser.

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

function nullableInt(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function POST(request: NextRequest) {
  try {
    // 401 not logged in / 403 not an Administrator. Nothing else is revealed.
    const auth = await assertAdmin(request);
    if (!auth.ok) return authErrorResponse(auth);

    if (!supabaseAdmin) return jsonError("Supabase not configured.", 500);

    const body = await request.json().catch(() => ({}));
    const matchId = Number(body.matchId);
    if (!matchId) return jsonError("matchId required.");

    const finalizeStats = body.finalizeStats === true;

    const { data: match, error: matchError } = await supabaseAdmin
      .from("matches")
      .select("*")
      .eq("id", matchId)
      .maybeSingle();

    if (matchError || !match) return jsonError("Match not found.", 404);
    if (finalizeStats) {
      if (match.stats_finalized) return jsonError("Stats are already finalized.", 409);
    } else if (match.status === "Finished") {
      return jsonError("Match is already Finished.", 409);
    }

    const setValues = {
      set1_home: nullableInt(body.set1_home),
      set1_away: nullableInt(body.set1_away),
      set2_home: nullableInt(body.set2_home),
      set2_away: nullableInt(body.set2_away),
      set3_home: nullableInt(body.set3_home),
      set3_away: nullableInt(body.set3_away),
      set4_home: nullableInt(body.set4_home),
      set4_away: nullableInt(body.set4_away),
      set5_home: nullableInt(body.set5_home),
      set5_away: nullableInt(body.set5_away),
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

    // "Finish Stats": the Admin panel's full finalize (locks the stats). The
    // browser only sends the values from the Admin's form; the Discord result
    // post stays with /api/match-notify exactly as before.
    if (finalizeStats) {
      const refereeId = nullableInt(body.referee_id);
      let refereeDiscordId: string | null = null;
      if (refereeId) {
        const { data: staff } = await supabaseAdmin
          .from("staff_applications")
          .select("discord_id")
          .eq("id", refereeId)
          .maybeSingle();
        refereeDiscordId = staff?.discord_id ? String(staff.discord_id) : null;
      }

      const { data: finalized, error: finalizeError } = await supabaseAdmin
        .from("matches")
        .update({
          status: "Finished",
          stage: typeof body.stage === "string" ? body.stage : match.stage,
          match_date: body.match_date || match.match_date,
          match_time: body.match_time || match.match_time,
          home_score: homeScore,
          away_score: awayScore,
          winner_country: winnerCountry,
          referee_id: refereeId,
          media_id: nullableInt(body.media_id),
          stat_tracker_id: nullableInt(body.stat_tracker_id),
          is_star_match: Boolean(body.is_star_match),
          wmvp_discord_id: String(body.wmvp_discord_id ?? "").trim() || null,
          lmvp_discord_id: String(body.lmvp_discord_id ?? "").trim() || null,
          referee_discord_id: refereeDiscordId,
          ...setValues,
          stats_finalized: true,
          stats_submitted_for_review: false,
          discord_rating_sent: false,
        })
        .eq("id", matchId)
        .eq("stats_finalized", false)
        .select("*")
        .maybeSingle();

      if (finalizeError) return jsonError(finalizeError.message, 500);
      if (!finalized) return jsonError("Stats could not be finalized.", 409);
      return NextResponse.json({ ok: true, match: finalized, previousStatus: match.status });
    }

    const refereeDiscordId = match.referee_discord_id || null;

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
