import { NextRequest, NextResponse } from "next/server";
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
      return jsonError("Unauthorized.", 401);
    }

    const { matchId, refereeDiscordId, captainDiscordId, rating, comment } =
      await request.json().catch(() => ({}));

    if (!matchId || !refereeDiscordId || !captainDiscordId || !rating)
      return jsonError("matchId, refereeDiscordId, captainDiscordId, rating required.");

    if (typeof rating !== "number" || rating < 1 || rating > 5)
      return jsonError("rating must be 1–5.");

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
      rating:               Number(rating),
      comment:              comment ? String(comment).slice(0, 500) : null,
    });

    if (error) return jsonError(error.message, 500);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return jsonError(e?.message || "Unexpected error.", 500);
  }
}

// GET: admin panel fetches ratings for the referee reputation tab
export async function GET(request: NextRequest) {
  try {
    if (!supabaseAdmin) return jsonError("Supabase not configured.", 500);

    const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return jsonError("Not authenticated.", 401);

    const { data: user, error: uErr } = await supabaseAdmin.auth.getUser(token);
    if (uErr || !user.user) return jsonError("Invalid session.", 401);

    const { data: role } = await supabaseAdmin
      .from("site_user_roles")
      .select("role")
      .eq("user_id", user.user.id)
      .maybeSingle();

    if (role?.role !== "administrator") return jsonError("Admin only.", 403);

    const { data, error } = await supabaseAdmin
      .from("referee_ratings")
      .select("*, matches(home_country, away_country, stage)")
      .order("created_at", { ascending: false });

    if (error) return jsonError(error.message, 500);

    return NextResponse.json({ ratings: data });
  } catch (e: any) {
    return jsonError(e?.message || "Unexpected error.", 500);
  }
}
