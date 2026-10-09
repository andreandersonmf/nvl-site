"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BarChart3, Edit3, Save, Shield, Trophy } from "lucide-react";
import { supabase } from "@/app/lib/supabaseClient";

type MatchStatus = "Scheduled" | "Live" | "Finished";

type MatchRow = {
  id: number;
  season_id?: string | null;
  home_country: string;
  away_country: string;
  stage: string | null;
  match_date: string;
  match_time: string;
  status: MatchStatus;
  home_score: number;
  away_score: number;
};

type Team = {
  id: number;
  season_id?: string | null;
  country: string;
  code: string;
  captain_name: string;
  captain_discord: string;
  captain_roblox_id: string;
  approved: boolean;
};

type TeamPlayer = {
  id: number;
  season_id?: string | null;
  team_id: number;
  roblox_username: string;
  roblox_user_id: string;
  discord_username: string;
  role: "Vice Captain" | "Court Captain" | "Player";
};

type Season = {
  id: string;
  name: string;
  slug: string;
  theme_name?: string | null;
  is_active?: boolean | null;
};

type PlayerOption = {
  key: string;
  name: string;
  teamCountry: string;
};

type StatRow = {
  id?: number;
  season_id?: string | null;
  match_id: number;
  team_country: string;
  player_key: string;
  player_name: string;
  set_number: number;

  spiking_errors: number;
  ape_kills: number;
  ape_attempts: number;
  kills: number;
  attempts: number;
  one_touches: number;
  kill_blocks: number;
  assists: number;
  spike_receives: number;
  serve_bfs: number;
  receives: number;
  dives: number;
  aces: number;
  misc_errors: number;
};

type StatField = keyof Pick<
  StatRow,
  | "spiking_errors"
  | "ape_kills"
  | "ape_attempts"
  | "kills"
  | "attempts"
  | "one_touches"
  | "kill_blocks"
  | "assists"
  | "serve_bfs"
  | "receives"
  | "dives"
  | "aces"
  | "misc_errors"
>;



const STAT_FIELDS: { key: StatField; label: string }[] = [
  { key: "spiking_errors", label: "Spk Err" },
  { key: "ape_kills", label: "Ape Kills" },
  { key: "ape_attempts", label: "Ape Att" },
  { key: "kills", label: "Kills" },
  { key: "attempts", label: "Spike Att" },
  { key: "one_touches", label: "One Touch" },
  { key: "kill_blocks", label: "Kill Blocks" },
  { key: "assists", label: "Assists" },
  { key: "serve_bfs", label: "BFs" },
  { key: "receives", label: "Recs" },
  { key: "dives", label: "Dives" },
  { key: "aces", label: "Aces" },
  { key: "misc_errors", label: "Misc Err" },
];

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function getFlagUrl(code: string) {
  return `https://flagcdn.com/w160/${code}.png`;
}

function formatDate(date: string) {
  if (!date) return "-";

  try {
    return new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return date;
  }
}

function zeroStatRow(
  matchId: number,
  teamCountry: string,
  player: PlayerOption,
  setNumber: number,
): StatRow {
  return {
    match_id: matchId,
    team_country: teamCountry,
    player_key: player.key,
    player_name: player.name,
    set_number: setNumber,

    spiking_errors: 0,
    ape_kills: 0,
    ape_attempts: 0,
    kills: 0,
    attempts: 0,
    one_touches: 0,
    kill_blocks: 0,
    assists: 0,
    spike_receives: 0,
    serve_bfs: 0,
    receives: 0,
    dives: 0,
    aces: 0,
    misc_errors: 0,
  };
}

function sumRows(rows: StatRow[]): StatRow | null {
  if (rows.length === 0) return null;

  const first = rows[0];

  return rows.reduce(
    (total, row) => ({
      ...total,
      spiking_errors: total.spiking_errors + row.spiking_errors,
      ape_kills: total.ape_kills + row.ape_kills,
      ape_attempts: total.ape_attempts + row.ape_attempts,
      kills: total.kills + row.kills,
      attempts: total.attempts + row.attempts,
      one_touches: total.one_touches + row.one_touches,
      kill_blocks: total.kill_blocks + row.kill_blocks,
      assists: total.assists + row.assists,
      spike_receives: total.spike_receives + row.spike_receives,
      serve_bfs: total.serve_bfs + row.serve_bfs,
      receives: total.receives + row.receives,
      dives: total.dives + row.dives,
      aces: total.aces + row.aces,
      misc_errors: total.misc_errors + row.misc_errors,
    }),
    {
      ...first,
      id: undefined,
      set_number: 0,
      spiking_errors: 0,
      ape_kills: 0,
      ape_attempts: 0,
      kills: 0,
      attempts: 0,
      one_touches: 0,
      kill_blocks: 0,
      assists: 0,
      spike_receives: 0,
      serve_bfs: 0,
      receives: 0,
      dives: 0,
      aces: 0,
      misc_errors: 0,
    },
  );
}

function percent(value: number, total: number) {
  if (!total) return "0.00%";
  return `${((value / total) * 100).toFixed(2)}%`;
}

function getDerived(row: StatRow) {
  const spikeAttempts = row.attempts;
  const totalKills = row.ape_kills + row.kills;
  const totalAttempts = row.ape_attempts + spikeAttempts;
  const totalBlocks = row.one_touches + row.kill_blocks;
  const receiveTotal = row.receives + row.dives;

  return {
    apeFg: percent(row.ape_kills, row.ape_attempts),
    killFg: percent(row.kills, spikeAttempts),
    totalKills,
    totalAttempts,
    totalFg: percent(totalKills, totalAttempts),
    totalBlocks,
    receiveTotal,
  };
}

function buildTeamTotal(teamCountry: string, rows: StatRow[]) {
  return sumRows(rows.filter((row) => row.team_country === teamCountry));
}

export default function StatsPage() {
  const [adminLogged, setAdminLogged] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [activeSeason, setActiveSeason] = useState<Season | null>(null);
  const [activeSeasonId, setActiveSeasonId] = useState<string | null>(null);
  const [teamPlayers, setTeamPlayers] = useState<TeamPlayer[]>([]);
  const [stats, setStats] = useState<StatRow[]>([]);

  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);
  const [selectedSet, setSelectedSet] = useState<0 | 1 | 2 | 3 | 4 | 5>(0);

  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  const selectedMatch = useMemo(() => {
    return matches.find((match) => match.id === selectedMatchId) ?? null;
  }, [matches, selectedMatchId]);

  const homeTeam = useMemo(() => {
    if (!selectedMatch) return null;
    return (
      teams.find(
        (team) => normalizeText(team.country) === normalizeText(selectedMatch.home_country),
      ) ?? null
    );
  }, [teams, selectedMatch]);

  const awayTeam = useMemo(() => {
    if (!selectedMatch) return null;
    return (
      teams.find(
        (team) => normalizeText(team.country) === normalizeText(selectedMatch.away_country),
      ) ?? null
    );
  }, [teams, selectedMatch]);

  const playerOptions = useMemo<PlayerOption[]>(() => {
    if (!selectedMatch) return [];

    const matchTeams = [selectedMatch.home_country, selectedMatch.away_country];

    return matchTeams.flatMap((country) => {
      const team = teams.find(
        (item) => normalizeText(item.country) === normalizeText(country),
      );

      if (!team) return [];

      const captain: PlayerOption[] =
        team.captain_name?.trim()
          ? [
              {
                key: `captain-${team.id}`,
                name: team.captain_name,
                teamCountry: team.country,
              },
            ]
          : [];

      const rosterPlayers: PlayerOption[] = teamPlayers
        .filter((player) => player.team_id === team.id)
        .map((player) => ({
          key: `player-${player.id}`,
          name: player.roblox_username,
          teamCountry: team.country,
        }));

      return [...captain, ...rosterPlayers];
    });
  }, [selectedMatch, teams, teamPlayers]);

  const displayRows = useMemo(() => {
    if (!selectedMatch) return [];

    if (selectedSet === 0) {
      return playerOptions
        .map((player) => {
          const rows = stats.filter(
            (row) =>
              row.match_id === selectedMatch.id &&
              row.player_key === player.key,
          );

          return (
            sumRows(rows) ??
            zeroStatRow(selectedMatch.id, player.teamCountry, player, 0)
          );
        })
        .filter((row) => row !== null);
    }

    return playerOptions.map((player) => {
      return (
        stats.find(
          (row) =>
            row.match_id === selectedMatch.id &&
            row.player_key === player.key &&
            row.set_number === selectedSet,
        ) ?? zeroStatRow(selectedMatch.id, player.teamCountry, player, selectedSet)
      );
    });
  }, [selectedMatch, selectedSet, playerOptions, stats]);

  const leaderboard = useMemo(() => {
    if (!selectedMatch) return [];

    return playerOptions
      .map((player) => {
        const rows = stats.filter(
          (row) =>
            row.player_key === player.key &&
            row.match_id === selectedMatch.id,
        );
        return sumRows(rows);
      })
      .filter((row): row is StatRow => Boolean(row))
      .sort((a, b) => {
        const aDerived = getDerived(a);
        const bDerived = getDerived(b);

        if (bDerived.totalKills !== aDerived.totalKills) {
          return bDerived.totalKills - aDerived.totalKills;
        }

        if (b.kill_blocks !== a.kill_blocks) return b.kill_blocks - a.kill_blocks;
        if (b.aces !== a.aces) return b.aces - a.aces;

        return a.player_name.localeCompare(b.player_name);
      })
      .slice(0, 10);
  }, [playerOptions, stats, selectedMatch]);

  async function resolveActiveSeason() {
    if (!supabase) return null;

    const { data: settings } = await supabase
      .from("league_settings")
      .select("active_season_id")
      .eq("id", 1)
      .maybeSingle();

    const preferredSeasonId = (settings?.active_season_id as string | null) ?? null;

    if (preferredSeasonId) {
      const { data, error } = await supabase
        .from("seasons")
        .select("*")
        .eq("id", preferredSeasonId)
        .maybeSingle();

      if (!error && data) {
        setActiveSeason(data as Season);
        setActiveSeasonId(data.id);
        return data.id as string;
      }
    }

    const { data, error } = await supabase
      .from("seasons")
      .select("*")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      setActiveSeason(data as Season);
      setActiveSeasonId(data.id);
      return data.id as string;
    }

    setActiveSeason(null);
    setActiveSeasonId(null);
    return null;
  }

  async function loadData() {
    if (!supabase) {
      setNotice("Configure Supabase to enable stats.");
      setLoading(false);
      return;
    }

    setLoading(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    setAdminLogged(!!session);

    const seasonId = await resolveActiveSeason();

    if (!seasonId) {
      setMatches([]);
      setTeams([]);
      setTeamPlayers([]);
      setStats([]);
      setLoading(false);
      return;
    }

    const [matchesResult, teamsResult, playersResult, statsResult] =
      await Promise.all([
        supabase
          .from("matches")
          .select("id, season_id, home_country, away_country, stage, match_date, match_time, status, home_score, away_score")
          .eq("season_id", seasonId)
          .order("match_date", { ascending: false })
          .order("match_time", { ascending: false }),
        supabase
          .from("teams")
          .select("id, season_id, country, code, captain_name, captain_discord, captain_roblox_id, approved")
          .eq("approved", true)
          .eq("season_id", seasonId)
          .order("country", { ascending: true }),
        supabase
          .from("team_players")
          .select("*")
          .eq("season_id", seasonId)
          .order("created_at", { ascending: true }),
        supabase
          .from("match_player_stats")
          .select("*")
          .eq("season_id", seasonId)
          .order("team_country", { ascending: true })
          .order("player_name", { ascending: true }),
      ]);

    if (matchesResult.error) setNotice(matchesResult.error.message);
    if (teamsResult.error) setNotice(teamsResult.error.message);
    if (playersResult.error) setNotice(playersResult.error.message);
    if (statsResult.error) setNotice(statsResult.error.message);

    const loadedMatches = (matchesResult.data ?? []) as MatchRow[];

    setMatches(loadedMatches);
    setTeams((teamsResult.data ?? []) as Team[]);
    setTeamPlayers((playersResult.data ?? []) as TeamPlayer[]);
    setStats((statsResult.data ?? []) as StatRow[]);

    if (!selectedMatchId && loadedMatches.length > 0) {
      setSelectedMatchId(loadedMatches[0].id);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  function updateLocalStat(
    player: PlayerOption,
    setNumber: number,
    field: StatField,
    value: string,
  ) {
    if (!selectedMatch) return;

    const cleanValue = value.trim() === "" ? 0 : Math.max(0, Number(value));

    setStats((prev) => {
      const existing = prev.find(
        (row) =>
          row.match_id === selectedMatch.id &&
          row.player_key === player.key &&
          row.set_number === setNumber,
      );

      if (existing) {
        return prev.map((row) =>
          row.match_id === selectedMatch.id &&
          row.player_key === player.key &&
          row.set_number === setNumber
            ? { ...row, [field]: Number.isNaN(cleanValue) ? 0 : cleanValue }
            : row,
        );
      }

      return [
        ...prev,
        {
          ...zeroStatRow(selectedMatch.id, player.teamCountry, player, setNumber),
          [field]: Number.isNaN(cleanValue) ? 0 : cleanValue,
        },
      ];
    });
  }

  async function saveCurrentSet() {
    if (!supabase || !selectedMatch || selectedSet === 0) return;

    const rowsToSave = playerOptions.map((player) => {
      const existing =
        stats.find(
          (row) =>
            row.match_id === selectedMatch.id &&
            row.player_key === player.key &&
            row.set_number === selectedSet,
        ) ?? zeroStatRow(selectedMatch.id, player.teamCountry, player, selectedSet);

      return {
        match_id: selectedMatch.id,
        season_id: selectedMatch.season_id ?? activeSeasonId,
        team_country: player.teamCountry,
        player_key: player.key,
        player_name: player.name,
        set_number: selectedSet,

        spiking_errors: existing.spiking_errors,
        ape_kills: existing.ape_kills,
        ape_attempts: existing.ape_attempts,
        kills: existing.kills,
        attempts: existing.attempts,
        one_touches: existing.one_touches,
        kill_blocks: existing.kill_blocks,
        assists: existing.assists,
        spike_receives: 0,
        serve_bfs: existing.serve_bfs,
        receives: existing.receives,
        dives: existing.dives,
        aces: existing.aces,
        misc_errors: existing.misc_errors,
      };
    });

    const { error } = await supabase
      .from("match_player_stats")
      .upsert(rowsToSave, {
        onConflict: "match_id,player_key,set_number",
      });

    if (error) {
      setNotice(error.message);
      return;
    }

    setNotice(`Set ${selectedSet} stats saved.`);
    await loadData();
  }

  const homeRows = displayRows.filter(
    (row) => selectedMatch && row.team_country === selectedMatch.home_country,
  );

  const awayRows = displayRows.filter(
    (row) => selectedMatch && row.team_country === selectedMatch.away_country,
  );

  const homeTotal = selectedMatch
    ? buildTeamTotal(selectedMatch.home_country, displayRows)
    : null;

  const awayTotal = selectedMatch
    ? buildTeamTotal(selectedMatch.away_country, displayRows)
    : null;

  function renderStatTable(teamCountry: string, rows: StatRow[]) {
    return (
      <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-[#1C120A]">
        <div className="border-b border-white/10 px-5 py-4">
          <h3 className="text-xl font-black">{teamCountry}</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1580px] w-full border-separate border-spacing-0 text-sm">
            <thead className="bg-white/[0.03] text-xs uppercase tracking-[0.16em] text-white/45">
              <tr>
                <th className="sticky left-0 z-30 min-w-[220px] bg-[#1C120A] px-4 py-3 text-left shadow-[8px_0_16px_rgba(0,0,0,0.35)]">
                  Player
                </th>
                {STAT_FIELDS.map((field) => (
                  <th key={field.key} className="px-3 py-3 text-center">
                    {field.label}
                  </th>
                ))}
                <th className="px-3 py-3 text-center">Ape FG%</th>
                <th className="px-3 py-3 text-center">Kill FG%</th>
                <th className="px-3 py-3 text-center">Total K</th>
                <th className="px-3 py-3 text-center">Total Att</th>
                <th className="px-3 py-3 text-center">Total FG%</th>
                <th className="px-3 py-3 text-center">Total Blocks</th>
                <th className="px-3 py-3 text-center">Total Recs</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => {
                const derived = getDerived(row);
                const player = playerOptions.find(
                  (option) => option.key === row.player_key,
                );

                return (
                  <tr key={`${row.player_key}-${row.set_number}`} className="border-t border-white/5">
                    <td className="sticky left-0 z-20 min-w-[220px] whitespace-nowrap bg-[#1C120A] px-4 py-3 font-semibold text-white shadow-[8px_0_16px_rgba(0,0,0,0.35)]">
                      {row.player_name}
                    </td>

                    {STAT_FIELDS.map((field) => (
                      <td key={field.key} className="px-2 py-2 text-center">
                        {editMode && adminLogged && selectedSet !== 0 && player ? (
                          <input
                            type="number"
                            min={0}
                            value={row[field.key]}
                            onChange={(event) =>
                              updateLocalStat(
                                player,
                                selectedSet,
                                field.key,
                                event.target.value,
                              )
                            }
                            className="w-20 rounded-xl border border-white/10 bg-white/5 px-2 py-2 text-center text-white outline-none focus:border-orange-400/40"
                          />
                        ) : (
                          <span className="text-white/75">{row[field.key]}</span>
                        )}
                      </td>
                    ))}

                    <td className="px-3 py-3 text-center text-amber-300">
                      {derived.apeFg}
                    </td>
                    <td className="px-3 py-3 text-center text-amber-300">
                      {derived.killFg}
                    </td>
                    <td className="px-3 py-3 text-center text-white/75">
                      {derived.totalKills}
                    </td>
                    <td className="px-3 py-3 text-center text-white/75">
                      {derived.totalAttempts}
                    </td>
                    <td className="px-3 py-3 text-center text-amber-300">
                      {derived.totalFg}
                    </td>
                    <td className="px-3 py-3 text-center text-white/75">
                      {derived.totalBlocks}
                    </td>
                    <td className="px-3 py-3 text-center text-white/75">
                      {derived.receiveTotal}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  function renderTeamTotal(row: StatRow | null) {
    if (!row) return null;

    const derived = getDerived(row);

    return (
      <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5">
        <p className="text-sm uppercase tracking-[0.2em] text-amber-300">
          {row.team_country} Team Totals
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div>
            <p className="text-xs text-white/45">Total Kills</p>
            <p className="text-2xl font-black">{derived.totalKills}</p>
          </div>

          <div>
            <p className="text-xs text-white/45">Total Attempts</p>
            <p className="text-2xl font-black">{derived.totalAttempts}</p>
          </div>

          <div>
            <p className="text-xs text-white/45">Total FG%</p>
            <p className="text-2xl font-black text-amber-300">
              {derived.totalFg}
            </p>
          </div>

          <div>
            <p className="text-xs text-white/45">Total Blocks</p>
            <p className="text-2xl font-black">{derived.totalBlocks}</p>
          </div>

          <div>
            <p className="text-xs text-white/45">Recs</p>
            <p className="text-2xl font-black">{row.receives}</p>
          </div>

          <div>
            <p className="text-xs text-white/45">Dives</p>
            <p className="text-2xl font-black">{row.dives}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#140D07] text-white selection:bg-orange-400/20">
      <header className="border-b border-white/10 bg-[#140D07]/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <h1 className="font-bold text-amber-300">NVL Stat Track</h1>

          <div className="flex items-center gap-3">
            {adminLogged ? (
              <span className="hidden items-center gap-2 rounded-full border border-orange-400/20 bg-orange-400/10 px-3 py-1.5 text-xs font-semibold text-amber-300 md:inline-flex">
                <Shield className="h-3.5 w-3.5" />
                Admin
              </span>
            ) : null}

            {adminLogged ? (
              <button
                type="button"
                onClick={() => setEditMode((prev) => !prev)}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold transition hover:bg-white/10"
              >
                <Edit3 className="h-4 w-4" />
                {editMode ? "Exit Edit" : "Edit Stats"}
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-12">
        <section className="rounded-[2rem] border border-white/10 bg-gradient-to-b from-white/10 to-white/5 p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-orange-400/20 bg-orange-400/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-amber-300">
                <BarChart3 className="h-4 w-4" />
                Stat Track
              </span>
              <h1 className="mt-5 text-4xl font-black md:text-6xl">
                NVL Stats Hub
              </h1>
              <p className="mt-4 max-w-2xl text-white/65">
                Track player stats by set, team totals, and automatic percentage calculations.
              </p>
              <p className="mt-3 text-sm font-semibold uppercase tracking-[0.22em] text-amber-300">
                {activeSeason?.name ?? "Active Season"}
              </p>
            </div>

            {notice ? (
              <div className="rounded-2xl border border-orange-400/20 bg-orange-400/10 px-4 py-3 text-sm text-amber-300">
                {notice}
              </div>
            ) : null}
          </div>
        </section>

        <section className="mt-8 grid gap-4 lg:grid-cols-[1.5fr_0.8fr]">
          <div className="rounded-[1.5rem] border border-white/10 bg-[#1C120A] p-5">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
              Match
            </label>

            <select
              value={selectedMatchId ?? ""}
              onChange={(event) => {
                setSelectedMatchId(Number(event.target.value));
                setSelectedSet(0);
                setEditMode(false);
              }}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none"
            >
              {matches.map((match) => (
                <option key={match.id} value={match.id} className="bg-[#170F08]">
                  {formatDate(match.match_date)} • {match.home_country} vs {match.away_country}
                  {match.stage ? ` • ${match.stage}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-[1.5rem] border border-white/10 bg-[#1C120A] p-5">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
              Set View
            </label>

            <div className="flex flex-wrap gap-2">
              {[
                { label: "All Sets", value: 0 },
                { label: "1st", value: 1 },
                { label: "2nd", value: 2 },
                { label: "3rd", value: 3 },
                { label: "4th", value: 4 },
                { label: "5th", value: 5 },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setSelectedSet(item.value as 0 | 1 | 2 | 3 | 4 | 5)}
                  className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                    selectedSet === item.value
                      ? "border-orange-400/30 bg-orange-400/10 text-amber-300"
                      : "border-white/10 bg-white/5 text-white/70"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {selectedMatch ? (
          <section className="mt-8 rounded-[2rem] border border-white/10 bg-[#1C120A] p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-amber-300">
                  Selected Match
                </p>
                <h2 className="mt-2 text-2xl font-black">
                  {selectedMatch.home_country} {selectedMatch.home_score} -{" "}
                  {selectedMatch.away_score} {selectedMatch.away_country}
                </h2>
                <p className="mt-1 text-white/55">
                  {formatDate(selectedMatch.match_date)} • {selectedMatch.match_time} BRT
                  {selectedMatch.stage ? ` • ${selectedMatch.stage}` : ""}
                </p>
              </div>

              <div className="flex items-center gap-3">
                {homeTeam ? (
                  <img
                    src={getFlagUrl(homeTeam.code)}
                    alt={`${homeTeam.country} flag`}
                    className="h-8 w-12 rounded object-cover"
                  />
                ) : null}

                <span className="text-white/40">vs</span>

                {awayTeam ? (
                  <img
                    src={getFlagUrl(awayTeam.code)}
                    alt={`${awayTeam.country} flag`}
                    className="h-8 w-12 rounded object-cover"
                  />
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        {editMode && selectedSet === 0 ? (
          <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
            All Sets is automatic. To edit stats, select 1st, 2nd, 3rd, 4th, or 5th set.
          </div>
        ) : null}

        {editMode && selectedSet !== 0 ? (
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={saveCurrentSet}
              className="inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-5 py-3 font-semibold text-black transition hover:-translate-y-0.5"
            >
              <Save className="h-4 w-4" />
              Save Set {selectedSet}
            </button>
          </div>
        ) : null}

        <section className="mt-8 space-y-8">
          {loading ? (
            <div className="rounded-[2rem] border border-white/10 bg-[#1C120A] p-8 text-white/60">
              Loading stats...
            </div>
          ) : !selectedMatch ? (
            <div className="rounded-[2rem] border border-white/10 bg-[#1C120A] p-8 text-white/60">
              No matches available.
            </div>
          ) : (
            <>
              {renderStatTable(selectedMatch.home_country, homeRows)}
              {renderStatTable(selectedMatch.away_country, awayRows)}

              <div className="grid gap-4 lg:grid-cols-2">
                {renderTeamTotal(homeTotal)}
                {renderTeamTotal(awayTotal)}
              </div>
            </>
          )}
        </section>

        <section className="mt-10 rounded-[2rem] border border-white/10 bg-[#1C120A] p-6">
          <div className="mb-5 flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-300" />
            <h2 className="text-2xl font-black">Top Players</h2>
          </div>

          {leaderboard.length === 0 ? (
            <p className="text-white/55">No stats added yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[960px] w-full text-sm">
                <thead className="text-xs uppercase tracking-[0.16em] text-white/45">
                  <tr>
                    <th className="px-3 py-3 text-left">#</th>
                    <th className="px-3 py-3 text-left">Player</th>
                    <th className="px-3 py-3 text-left">Team</th>
                    <th className="px-3 py-3 text-center">Total Kills</th>
                    <th className="px-3 py-3 text-center">FG%</th>
                    <th className="px-3 py-3 text-center">Blocks</th>
                    <th className="px-3 py-3 text-center">Recs</th>
                    <th className="px-3 py-3 text-center">Dives</th>
                    <th className="px-3 py-3 text-center">Aces</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((row, index) => {
                    const derived = getDerived(row);

                    return (
                      <tr key={row.player_key} className="border-t border-white/5">
                        <td className="px-3 py-3 font-bold text-amber-300">
                          {index + 1}
                        </td>
                        <td className="px-3 py-3 font-semibold">{row.player_name}</td>
                        <td className="px-3 py-3 text-white/70">{row.team_country}</td>
                        <td className="px-3 py-3 text-center">{derived.totalKills}</td>
                        <td className="px-3 py-3 text-center text-amber-300">
                          {derived.totalFg}
                        </td>
                        <td className="px-3 py-3 text-center">{derived.totalBlocks}</td>
                        <td className="px-3 py-3 text-center">{row.receives}</td>
                        <td className="px-3 py-3 text-center">{row.dives}</td>
                        <td className="px-3 py-3 text-center">{row.aces}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}