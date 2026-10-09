import { NextRequest, NextResponse } from "next/server";
import { assertAdmin, authErrorResponse } from "@/lib/matchAuth";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabaseAdmin = supabaseUrl && serviceKey
  ? createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

function jsonError(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

// POST: bot calls this after a captain submits a rating via DM
export async function POST(request: NextRequest) {
  try {
    if (!supabaseAdmin) return jsonError("Supabase not configured.", 500);

    // Only the bot should call this — authenticated via a shared bot secret
    const auth = request.headers.get("authorization") || "";
    const expectedSecret = process.env.BOT_INTERNAL_SECRET || "";
    if (expectedSecret && auth !== `Bearer ${expectedSecret}`) {
      console.error("[referee-rating] rejected: BOT_INTERNAL_SECRET is set on the site but the request did not send a matching Bearer secret.");
      return jsonError("Unauthorized.", 401);
    }

    const payload = await request.json().catch(() => ({}));
    const { matchId, refereeDiscordId, captainDiscordId, comment } = payload;
    // Accept the rating as a number or a numeric string ("5"); the bot may send either.
    const ratingValue = Number(payload.rating);

    if (!matchId || !refereeDiscordId || !captainDiscordId || !payload.rating) {
      console.error("[referee-rating] rejected: missing fields", { matchId, refereeDiscordId, captainDiscordId, rating: payload.rating });
      return jsonError("matchId, refereeDiscordId, captainDiscordId, rating required.");
    }

    if (!Number.isInteger(ratingValue) || ratingValue < 1 || ratingValue > 5) {
      console.error("[referee-rating] rejected: invalid rating", payload.rating);
      return jsonError("rating must be an integer from 1 to 5.");
    }

    // Prevent duplicate vote from same captain on same match
    const { data: existing } = await supabaseAdmin
      .from("referee_ratings")
      .select("id")
      .eq("match_id", matchId)
      .eq("captain_discord_id", String(captainDiscordId))
      .maybeSingle();

    if (existing) return jsonError("This captain already rated this match.", 409);

    const { error } = await supabaseAdmin.from("referee_ratings").insert({
      match_id:             Number(matchId),
      referee_discord_id:   String(refereeDiscordId),
      captain_discord_id:   String(captainDiscordId),
      rating:               ratingValue,
      comment:              comment ? String(comment).slice(0, 500) : null,
    });

    if (error) {
      console.error("[referee-rating] insert failed:", error.message);
      return jsonError(error.message, 500);
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return jsonError(e?.message || "Unexpected error.", 500);
  }
}

// GET: admin panel fetches ratings for the referee reputation tab
export async function GET(request: NextRequest) {
  try {
    if (!supabaseAdmin) return jsonError("Supabase not configured.", 500);

    const auth = await assertAdmin(request);
    if (!auth.ok) return authErrorResponse(auth);

    const { data, error } = await supabaseAdmin
      .from("referee_ratings")
      .select("*, matches(home_country, away_country, stage)")
      .order("created_at", { ascending: false });

    if (!error) return NextResponse.json({ ratings: data });

    // If the match join fails for any reason, still return the ratings themselves
    // (the match names are just left out) instead of showing nothing.
    const plain = await supabaseAdmin
      .from("referee_ratings")
      .select("*")
      .order("created_at", { ascending: false });
    if (plain.error) return jsonError(plain.error.message, 500);

    return NextResponse.json({ ratings: plain.data });
  } catch (e: any) {
    return jsonError(e?.message || "Unexpected error.", 500);
  }
}
