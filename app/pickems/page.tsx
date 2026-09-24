"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";

type MatchRow = {
  id: number;
  home_country: string;
  away_country: string;
  stage: string | null;
  match_date: string;
  match_time: string;
  status: "Scheduled" | "Live" | "Finished";
  best_of: number;
  set1_home: number | null;
  set1_away: number | null;
  set2_home: number | null;
  set2_away: number | null;
  set3_home: number | null;
  set3_away: number | null;
  set4_home: number | null;
  set4_away: number | null;
  set5_home: number | null;
  set5_away: number | null;
};

type PredictionRow = {
  id: number;
  match_id: number;
  set1_home: number | null;
  set1_away: number | null;
  set2_home: number | null;
  set2_away: number | null;
  set3_home: number | null;
  set3_away: number | null;
  set4_home: number | null;
  set4_away: number | null;
  set5_home: number | null;
  set5_away: number | null;
  points: number | null;
};

type PredictionDraft = {
  set1_home: string;
  set1_away: string;
  set2_home: string;
  set2_away: string;
  set3_home: string;
  set3_away: string;
  set4_home: string;
  set4_away: string;
  set5_home: string;
  set5_away: string;
};

type LeaderboardRow = {
  profile_id: string;
  display_name: string | null;
  avatar_url: string | null;
  total_points: number;
  predictions_scored: number;
};

const EMPTY_DRAFT: PredictionDraft = {
  set1_home: "", set1_away: "",
  set2_home: "", set2_away: "",
  set3_home: "", set3_away: "",
  set4_home: "", set4_away: "",
  set5_home: "", set5_away: "",
};

function draftFromPrediction(p: PredictionRow | undefined): PredictionDraft {
  if (!p) return { ...EMPTY_DRAFT };
  return {
    set1_home: p.set1_home?.toString() ?? "",
    set1_away: p.set1_away?.toString() ?? "",
    set2_home: p.set2_home?.toString() ?? "",
    set2_away: p.set2_away?.toString() ?? "",
    set3_home: p.set3_home?.toString() ?? "",
    set3_away: p.set3_away?.toString() ?? "",
    set4_home: p.set4_home?.toString() ?? "",
    set4_away: p.set4_away?.toString() ?? "",
    set5_home: p.set5_home?.toString() ?? "",
    set5_away: p.set5_away?.toString() ?? "",
  };
}

// Mirrors pickems_is_open() in the database: picks close 30 minutes
// before match_date/match_time, treated as Brasilia time (BRT, fixed
// UTC-3 - Brazil has had no DST since 2019). The database is always
// the real enforcement (via RLS); this is just for the UI.
function isPickemsOpen(matchDate: string, matchTime: string): boolean {
  if (!matchDate || !matchTime) return false;
  const start = new Date(`${matchDate}T${matchTime}:00-03:00`);
  if (Number.isNaN(start.getTime())) return false;
  return Date.now() < start.getTime() - 30 * 60 * 1000;
}

function formatMatchTime(matchDate: string, matchTime: string): string {
  if (!matchDate) return "TBA";
  const [year, month, day] = matchDate.split("-");
  return `${day}/${month}/${year} ${matchTime || ""} BRT`.trim();
}

function toNullableInt(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : null;
}

// Same aggregate-sets-tally logic as pickems_recompute_match(), used
// only to show a "your prediction implies X-Y" preview - the database
// is the source of truth for actual scoring.
function impliedSetsTally(draft: PredictionDraft, bestOf: number) {
  const pairs: [string, string][] = [
    [draft.set1_home, draft.set1_away],
    [draft.set2_home, draft.set2_away],
    [draft.set3_home, draft.set3_away],
    [draft.set4_home, draft.set4_away],
    [draft.set5_home, draft.set5_away],
  ].slice(0, bestOf) as [string, string][];

  let home = 0;
  let away = 0;
  for (const [h, a] of pairs) {
    const hv = toNullableInt(h);
    const av = toNullableInt(a);
    if (hv === null || av === null || hv === av) continue;
    if (hv > av) home += 1;
    else away += 1;
  }
  return { home, away };
}

export default function PickemsPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const [tab, setTab] = useState<"predict" | "leaderboard">("predict");

  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(true);

  const [predictions, setPredictions] = useState<Record<number, PredictionRow>>({});
  const [drafts, setDrafts] = useState<Record<number, PredictionDraft>>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);

  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  function showNotice(text: string, error = false) {
    setNotice({ text, error });
    window.setTimeout(() => setNotice(null), 5000);
  }

  // --- Session + profile bootstrap -------------------------------
  useEffect(() => {
    if (!supabase) {
      setProfileLoading(false);
      return;
    }

    async function loadProfileId(currentSession: Session | null) {
      if (!supabase || !currentSession) {
        setProfileId(null);
        setProfileLoading(false);
        return;
      }
      const { data, error } = await supabase.rpc("current_profile_id");
      if (!error && data) setProfileId(data as string);
      setProfileLoading(false);
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      loadProfileId(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setProfileLoading(true);
      loadProfileId(nextSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // --- Matches (active season, all statuses - split client-side) --
  useEffect(() => {
    async function loadMatches() {
      if (!supabase) {
        setMatchesLoading(false);
        return;
      }
      setMatchesLoading(true);

      const { data: settings } = await supabase
        .from("league_settings")
        .select("active_season_id")
        .eq("id", 1)
        .maybeSingle();

      const activeSeasonId = (settings?.active_season_id as string | null) ?? null;
      if (!activeSeasonId) {
        setMatches([]);
        setMatchesLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("matches")
        .select("*")
        .eq("season_id", activeSeasonId)
        .order("match_date", { ascending: true })
        .order("match_time", { ascending: true });

      if (!error && data) setMatches(data as MatchRow[]);
      setMatchesLoading(false);
    }
    loadMatches();
  }, []);

  // --- Own predictions, once we know who "own" is ------------------
  useEffect(() => {
    async function loadPredictions() {
      if (!supabase || !profileId) {
        setPredictions({});
        return;
      }
      const { data, error } = await supabase
        .from("pickems_predictions")
        .select("*")
        .eq("profile_id", profileId);

      if (!error && data) {
        const byMatch: Record<number, PredictionRow> = {};
        for (const row of data as PredictionRow[]) byMatch[row.match_id] = row;
        setPredictions(byMatch);
      }
    }
    loadPredictions();
  }, [profileId]);

  // Seed the editable drafts whenever matches or predictions change,
  // without clobbering anything the player is actively typing.
  useEffect(() => {
    setDrafts((prev) => {
      const next = { ...prev };
      for (const match of matches) {
        if (next[match.id]) continue;
        next[match.id] = draftFromPrediction(predictions[match.id]);
      }
      return next;
    });
  }, [matches, predictions]);

  // --- Leaderboard --------------------------------------------------
  useEffect(() => {
    async function loadLeaderboard() {
      setLeaderboardLoading(true);
      try {
        const res = await fetch("/api/pickems/leaderboard");
        const json = await res.json();
        setLeaderboard(json.leaderboard ?? []);
      } catch {
        setLeaderboard([]);
      } finally {
        setLeaderboardLoading(false);
      }
    }
    if (tab === "leaderboard") loadLeaderboard();
  }, [tab]);

  const upcomingMatches = useMemo(
    () => matches.filter((m) => m.status === "Scheduled"),
    [matches],
  );
  const finishedMatches = useMemo(
    () => matches.filter((m) => m.status === "Finished" && predictions[m.id]),
    [matches, predictions],
  );

  function updateDraft(matchId: number, field: keyof PredictionDraft, value: string) {
    setDrafts((prev) => ({
      ...prev,
      [matchId]: { ...(prev[matchId] ?? EMPTY_DRAFT), [field]: value },
    }));
  }

  async function submitPrediction(match: MatchRow) {
    if (!supabase) return;
    if (!profileId) {
      showNotice("Log in with Discord to make your pick.", true);
      return;
    }

    const draft = drafts[match.id] ?? EMPTY_DRAFT;
    const maxSets = match.best_of === 5 ? 5 : 3;
    const fields = ["set1", "set2", "set3", "set4", "set5"].slice(0, maxSets);

    const payload: Record<string, number | null> = {};
    let homeWins = 0;
    let awayWins = 0;
    for (const field of fields) {
      const homeVal = toNullableInt(draft[`${field}_home` as keyof PredictionDraft]);
      const awayVal = toNullableInt(draft[`${field}_away` as keyof PredictionDraft]);

      // Sets after the match is already decided are optional.
      // Bo3: Set 3 is optional for a 2-0 prediction.
      // Bo5: Sets 4 and 5 are optional for a 3-0 prediction.
      const optional = field !== "set1" && field !== "set2" && ((maxSets === 3 && homeWins === 2 || awayWins === 2) || (maxSets === 5 && homeWins === 3 || awayWins === 3));
      if (homeVal === null || awayVal === null) {
        if (optional) {
          payload[`${field}_home`] = null;
          payload[`${field}_away`] = null;
          continue;
        }
        showNotice(`Fill in every required set (this match is Bo${maxSets}).`, true);
        return;
      }
      payload[`${field}_home`] = homeVal;
      payload[`${field}_away`] = awayVal;
      if (homeVal > awayVal) homeWins++;
      if (awayVal > homeVal) awayWins++;
    }
    // Fields beyond this match's format stay null.
    for (const field of ["set1", "set2", "set3", "set4", "set5"].slice(setCount)) {
      payload[`${field}_home`] = null;
      payload[`${field}_away`] = null;
    }

    setSavingId(match.id);
    const { data, error } = await supabase
      .from("pickems_predictions")
      .upsert(
        { match_id: match.id, profile_id: profileId, ...payload },
        { onConflict: "match_id,profile_id" },
      )
      .select("*")
      .maybeSingle();
    setSavingId(null);

    if (error) {
      showNotice(
        error.message.includes("row-level security")
          ? "Picks for this match are closed (30 minutes before start)."
          : error.message,
        true,
      );
      return;
    }

    if (data) {
      setPredictions((prev) => ({ ...prev, [match.id]: data as PredictionRow }));
      showNotice("Pick saved!");
    }
  }

  return (
    <div className="min-h-screen bg-[#140D07] text-white selection:bg-orange-400/20 selection:text-white">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#140D07]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <Link href="/" className="text-sm font-semibold uppercase tracking-[0.25em] text-amber-300">
            NVL
          </Link>
          <nav className="hidden flex-wrap gap-2 rounded-2xl border border-orange-400/10 bg-orange-500/[0.06] p-1.5 text-sm text-white/70 backdrop-blur-sm md:flex">
            <Link href="/" className="rounded-xl border border-white/10 px-4 py-2 hover:bg-white/10">Home</Link>
            <Link href="/matchmaking" className="rounded-xl border border-white/10 px-4 py-2 hover:bg-white/10">Matchmaking</Link>
            <Link href="/pickems" className="rounded-xl border border-orange-400/30 bg-orange-400/10 px-4 py-2 text-amber-300">Pickems</Link>
            <Link href="/archives" className="rounded-xl border border-white/10 px-4 py-2 hover:bg-white/10">Archives</Link>
            <Link href="/profile" className="rounded-xl border border-white/10 px-4 py-2 hover:bg-white/10">Profile</Link>
          </nav>
          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="rounded-xl border border-white/10 px-3 py-2 text-sm md:hidden"
          >
            Menu
          </button>
        </div>
        {mobileMenuOpen ? (
          <div className="flex flex-col gap-1 border-t border-white/10 px-4 py-3 text-sm md:hidden">
            <Link href="/" onClick={() => setMobileMenuOpen(false)} className="rounded-2xl px-4 py-3 hover:bg-white/5">Home</Link>
            <Link href="/matchmaking" onClick={() => setMobileMenuOpen(false)} className="rounded-2xl px-4 py-3 hover:bg-white/5">Matchmaking</Link>
            <Link href="/pickems" onClick={() => setMobileMenuOpen(false)} className="rounded-2xl px-4 py-3 hover:bg-white/5">Pickems</Link>
            <Link href="/archives" onClick={() => setMobileMenuOpen(false)} className="rounded-2xl px-4 py-3 hover:bg-white/5">Archives</Link>
            <Link href="/profile" onClick={() => setMobileMenuOpen(false)} className="rounded-2xl px-4 py-3 hover:bg-white/5">Profile</Link>
          </div>
        ) : null}
      </header>

      <main className="mx-auto max-w-6xl px-6 py-16">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-300">Predict &amp; Compete</p>
        <h1 className="mt-2 text-4xl font-black md:text-5xl">Pickems</h1>
        <p className="mt-4 max-w-2xl text-white/65">
          Predict the set score of upcoming official matches. Picks close 30 minutes before
          each match starts. Exact sets tally: 3 pts · correct winner only: 1 pt ·
          +2 pts for every individual set you call exactly right.
        </p>

        {notice ? (
          <div
            className={`mt-6 rounded-2xl border px-5 py-4 text-sm ${
              notice.error
                ? "border-red-400/25 bg-red-400/10 text-red-200"
                : "border-orange-400/25 bg-orange-400/10 text-amber-200"
            }`}
          >
            {notice.text}
          </div>
        ) : null}

        <div className="mt-8 flex gap-2 rounded-2xl border border-white/10 bg-[#1C120A] p-1.5 text-sm w-fit">
          <button
            type="button"
            onClick={() => setTab("predict")}
            className={`rounded-xl px-5 py-2 font-semibold transition duration-200 ${
              tab === "predict" ? "bg-orange-500 text-black" : "text-white/60 hover:text-white"
            }`}
          >
            Predictions
          </button>
          <button
            type="button"
            onClick={() => setTab("leaderboard")}
            className={`rounded-xl px-5 py-2 font-semibold transition duration-200 ${
              tab === "leaderboard" ? "bg-orange-500 text-black" : "text-white/60 hover:text-white"
            }`}
          >
            Leaderboard
          </button>
        </div>

        {tab === "predict" ? (
          <section className="mt-8">
            {!session && !profileLoading ? (
              <div className="rounded-[1.5rem] border border-orange-400/20 bg-orange-400/10 p-6 text-sm text-amber-100">
                <Link href="/login" className="font-semibold underline decoration-amber-300/40">
                  Log in with Discord
                </Link>{" "}
                to make your picks. Anyone can browse upcoming matches below.
              </div>
            ) : null}

            <h2 className="mt-8 text-2xl font-black">Upcoming matches</h2>

            {matchesLoading ? (
              <p className="mt-4 text-white/40">Loading matches...</p>
            ) : upcomingMatches.length === 0 ? (
              <p className="mt-4 text-white/40">No scheduled matches right now.</p>
            ) : (
              <div className="mt-6 grid gap-5">
                {upcomingMatches.map((match) => {
                  const open = isPickemsOpen(match.match_date, match.match_time);
                  const draft = drafts[match.id] ?? EMPTY_DRAFT;
                  const setCount = match.best_of === 5 ? 5 : 3;
                  const tally = impliedSetsTally(draft, setCount);
                  const hasPick = Boolean(predictions[match.id]);

                  return (
                    <div key={match.id} className="rounded-[1.5rem] border border-white/10 bg-[#1C120A] p-6">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-white/40">
                            {match.stage || "Match"} · Bo{setCount}
                          </p>
                          <p className="text-xl font-black">
                            {match.home_country} <span className="text-white/40">vs</span> {match.away_country}
                          </p>
                          <p className="text-sm text-white/50">{formatMatchTime(match.match_date, match.match_time)}</p>
                        </div>
                        <div className="text-right">
                          {hasPick ? (
                            <span className="rounded-full border border-orange-400/30 bg-orange-400/10 px-3 py-1 text-xs font-semibold text-amber-300">
                              Pick saved
                            </span>
                          ) : null}
                          {!open ? (
                            <p className="mt-2 text-xs font-semibold text-red-300">Picks closed</p>
                          ) : null}
                        </div>
                      </div>

                      {!profileId ? null : (
                        <>
                          <div className="mt-5 grid gap-3">
                            {Array.from({ length: setCount }, (_, i) => i + 1).map((setNumber) => (
                              <div key={setNumber} className="grid grid-cols-[70px_1fr_1fr] items-end gap-3">
                                <p className="text-sm font-semibold text-white/60">Set {setNumber}</p>
                                <div>
                                  <label className="mb-1 block text-xs text-white/40">{match.home_country}</label>
                                  <input
                                    type="number"
                                    min="0"
                                    disabled={!open}
                                    value={draft[`set${setNumber}_home` as keyof PredictionDraft]}
                                    onChange={(e) =>
                                      updateDraft(match.id, `set${setNumber}_home` as keyof PredictionDraft, e.target.value)
                                    }
                                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-orange-400/40 disabled:opacity-40"
                                    placeholder="25"
                                  />
                                </div>
                                <div>
                                  <label className="mb-1 block text-xs text-white/40">{match.away_country}</label>
                                  <input
                                    type="number"
                                    min="0"
                                    disabled={!open}
                                    value={draft[`set${setNumber}_away` as keyof PredictionDraft]}
                                    onChange={(e) =>
                                      updateDraft(match.id, `set${setNumber}_away` as keyof PredictionDraft, e.target.value)
                                    }
                                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-orange-400/40 disabled:opacity-40"
                                    placeholder="22"
                                  />
                                </div>
                              </div>
                            ))}
                          </div>

                          <p className="mt-3 text-xs text-white/40">
                            Your pick implies: {match.home_country} {tally.home}-{tally.away} {match.away_country}
                          </p>

                          {open ? (
                            <button
                              type="button"
                              disabled={savingId === match.id}
                              onClick={() => submitPrediction(match)}
                              className="mt-4 rounded-2xl bg-orange-500 px-6 py-2.5 text-sm font-black text-black transition duration-200 hover:-translate-y-0.5 disabled:opacity-60"
                            >
                              {savingId === match.id ? "Saving..." : hasPick ? "Update pick" : "Save pick"}
                            </button>
                          ) : null}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {finishedMatches.length > 0 ? (
              <>
                <h2 className="mt-14 text-2xl font-black">Your results</h2>
                <div className="mt-6 overflow-x-auto rounded-[1.5rem] border border-white/10 bg-[#1C120A] p-5">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead className="text-white/50">
                      <tr>
                        <th className="py-2">Match</th>
                        <th className="py-2">Result</th>
                        <th className="py-2">Your pick</th>
                        <th className="py-2 text-center">Points</th>
                      </tr>
                    </thead>
                    <tbody>
                      {finishedMatches.map((match) => {
                        const pred = predictions[match.id];
                        const setCount = match.best_of === 5 ? 5 : 3;
                        const actualParts: string[] = [];
                        const pickParts: string[] = [];
                        for (let i = 1; i <= setCount; i++) {
                          const ah = match[`set${i}_home` as keyof MatchRow];
                          const aa = match[`set${i}_away` as keyof MatchRow];
                          if (ah !== null && aa !== null) actualParts.push(`${ah}-${aa}`);
                          const ph = pred?.[`set${i}_home` as keyof PredictionRow];
                          const pa = pred?.[`set${i}_away` as keyof PredictionRow];
                          if (ph !== null && ph !== undefined && pa !== null && pa !== undefined) {
                            pickParts.push(`${ph}-${pa}`);
                          }
                        }
                        return (
                          <tr key={match.id} className="border-t border-white/5">
                            <td className="py-3 font-semibold">
                              {match.home_country} vs {match.away_country}
                            </td>
                            <td className="py-3 text-white/70">{actualParts.join(", ") || "—"}</td>
                            <td className="py-3 text-white/70">{pickParts.join(", ") || "—"}</td>
                            <td className="py-3 text-center font-black text-amber-300">
                              {pred?.points ?? "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}
          </section>
        ) : (
          <section className="mt-8">
            <h2 className="text-2xl font-black">Season Leaderboard</h2>
            <div className="mt-6 overflow-x-auto rounded-[1.5rem] border border-white/10 bg-[#1C120A] p-5">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="text-white/50">
                  <tr>
                    <th className="py-2">#</th>
                    <th className="py-2">Player</th>
                    <th className="py-2 text-center">Points</th>
                    <th className="py-2 text-center">Picks scored</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboardLoading ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-white/40">Loading...</td>
                    </tr>
                  ) : leaderboard.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-white/40">No scored picks yet this season.</td>
                    </tr>
                  ) : (
                    leaderboard.map((row, i) => (
                      <tr key={row.profile_id} className="border-t border-white/5">
                        <td className="py-3 font-bold text-white/40">{i + 1}</td>
                        <td className="py-3 font-semibold">
                          <span className="inline-flex items-center">
                            {row.avatar_url ? (
                              <img src={row.avatar_url} alt="" className="mr-2 h-6 w-6 rounded-full border border-white/10 object-cover" />
                            ) : null}
                            {row.display_name || `Player ${row.profile_id.slice(0, 6)}`}
                          </span>
                        </td>
                        <td className="py-3 text-center font-black text-amber-300">{row.total_points}</td>
                        <td className="py-3 text-center">{row.predictions_scored}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-white/10 bg-[#160E08]">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8 text-sm text-white/60 md:flex-row md:items-center md:justify-between">
          <p>National Volleyball League — Pickems</p>
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-orange-400/10 bg-orange-500/[0.06] p-2 backdrop-blur-sm">
            <Link href="/" className="rounded-xl px-2 py-1 hover:bg-white/10 hover:text-white">Home</Link>
            <Link href="/matchmaking" className="rounded-xl px-2 py-1 hover:bg-white/10 hover:text-white">Matchmaking</Link>
            <Link href="/archives" className="rounded-xl px-2 py-1 hover:bg-white/10 hover:text-white">Archives</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
