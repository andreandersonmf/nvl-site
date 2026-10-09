import { NextRequest, NextResponse } from "next/server";
import { authErrorResponse, authorizeAdminOrAssignedReferee, getAuthenticatedAccess } from "@/lib/matchAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

// EDIT SCORE / MATCH DETAILS - Administrator (any match) or the Referee assigned
// to the match.
//
// This is the only way a Referee writes match data. The browser sends the matchId
// plus any of: the set numbers, wmvp_discord_id, lmvp_discord_id and media_id.
// Nothing else is accepted: status, referee, stage, winner, stats flags, etc. are
// never taken from the request. Fields that are not sent are left untouched. The
// Media must be an approved Media staff member. The assigned referee is
// looked up in the database (matches.referee_id <-> the caller's own approved
// staff_applications ids) on every call.
//
//   401 not logged in | 403 not admin / not the assigned referee | 404 / 409 / 400 data errors

const SET_FIELDS = [
  "set1_home", "set1_away", "set2_home", "set2_away", "set3_home",
  "set3_away", "set4_home", "set4_away", "set5_home", "set5_away",
] as const;

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

// Approved Media members a Referee / Admin can pick for a match. Served from the
// server so it works regardless of what the browser may read directly.
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthenticatedAccess(request);
    if (!session.ok) return authErrorResponse(session);
    if (!session.access.isAdmin && !session.access.isRefereeStaff) {
      return jsonError("You do not have permission to manage matches.", 403);
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) return jsonError("Supabase not configured.", 500);

    const { data, error } = await supabase
      .from("staff_applications")
      .select("id, roblox_username, discord_username")
      .ilike("role", "media")
      .eq("approved", true)
      .order("created_at", { ascending: true });
    if (error) return jsonError(error.message, 500);

    return NextResponse.json({ media: data ?? [] });
  } catch (error: unknown) {
    return jsonError(error instanceof Error ? error.message : "Unexpected error.", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthenticatedAccess(request);
    if (!session.ok) return authErrorResponse(session);

    const supabase = getSupabaseAdmin();
    if (!supabase) return jsonError("Supabase not configured.", 500);

    const body = await request.json().catch(() => ({}));
    const matchId = Number(body?.matchId);
    if (!Number.isInteger(matchId) || matchId <= 0) return jsonError("matchId required.");

    const { data: match, error: matchError } = await supabase
      .from("matches")
      .select("*")
      .eq("id", matchId)
      .maybeSingle();

    if (matchError) return jsonError(matchError.message, 500);
    if (!match) {
      return session.access.isAdmin
        ? jsonError("Match not found.", 404)
        : jsonError("You do not have permission to edit this match.", 403);
    }

    const authz = authorizeAdminOrAssignedReferee(session.access, match);
    if (!authz.ok) return authErrorResponse(authz);

    if (match.stats_finalized) return jsonError("Stats for this match are finalized and locked.", 409);

    // Referees work on the match they started; they cannot touch scheduled or
    // already finished matches. Admin keeps full control.
    if (!session.access.isAdmin && match.status !== "Live") {
      return jsonError("Scores can only be edited while the match is Live.", 409);
    }
    if (match.status === "Finished" && !session.access.isAdmin) {
      return jsonError("This match is already finished.", 409);
    }

    const update: Record<string, unknown> = {};

    // --- set scores (only when sets are sent) ---
    const hasSets = SET_FIELDS.some((field) => body?.[field] !== undefined);
    if (hasSets) {
      const values: Record<string, number | null> = {};
      for (const field of SET_FIELDS) {
        const raw = body?.[field];
        if (raw === null || raw === undefined || raw === "") {
          values[field] = null;
          continue;
        }
        const n = Number(raw);
        if (!Number.isInteger(n) || n < 0 || n > 99) return jsonError(`Invalid value for ${field}.`);
        values[field] = n;
      }

      const pairs = [1, 2, 3, 4, 5].map((i) => [values[`set${i}_home`], values[`set${i}_away`]] as const);
      Object.assign(update, values, {
        home_score: pairs.filter(([h, a]) => h != null && a != null && h > a).length,
        away_score: pairs.filter(([h, a]) => h != null && a != null && a > h).length,
        stats_submitted_for_review: false,
      });
    }

    // --- MVPs (Discord IDs) ---
    for (const field of ["wmvp_discord_id", "lmvp_discord_id"] as const) {
      if (body?.[field] === undefined) continue;
      const text = String(body[field] ?? "").trim();
      if (text && !/^\d{5,25}$/.test(text)) return jsonError(`${field} must be a Discord ID (numbers only).`);
      update[field] = text || null;
    }

    // --- Media: must be an approved Media staff member ---
    if (body?.media_id !== undefined) {
      if (body.media_id === null || body.media_id === "") {
        update.media_id = null;
      } else {
        const mediaId = Number(body.media_id);
        if (!Number.isInteger(mediaId) || mediaId <= 0) return jsonError("Invalid media_id.");
        const { data: mediaRow, error: mediaError } = await supabase
          .from("staff_applications")
          .select("id")
          .eq("id", mediaId)
          .ilike("role", "media")
          .eq("approved", true)
          .maybeSingle();
        if (mediaError) return jsonError(mediaError.message, 500);
        if (!mediaRow) return jsonError("That person is not an approved Media member.");
        update.media_id = mediaId;
      }
    }

    if (Object.keys(update).length === 0) return jsonError("Nothing to update.");

    const { data: updated, error: updateError } = await supabase
      .from("matches")
      .update(update)
      .eq("id", matchId)
      .eq("stats_finalized", false)
      .select("*")
      .maybeSingle();

    if (updateError) return jsonError(updateError.message, 500);
    if (!updated) return jsonError("Match could not be updated.", 409);

    return NextResponse.json({ ok: true, match: updated });
  } catch (error: unknown) {
    return jsonError(error instanceof Error ? error.message : "Unexpected error.", 500);
  }
}
