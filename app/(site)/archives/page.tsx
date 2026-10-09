"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Archive, BarChart3, CalendarDays, Trophy, Users } from "lucide-react";
import { supabase } from "@/app/lib/supabaseClient";

type MatchStatus = "Scheduled" | "Live" | "Finished";

type Season = {
  id: string;
  name: string;
  slug: string;
  theme_name?: string | null;
  status?: string | null;
  is_active?: boolean | null;
  is_archived?: boolean | null;
  awards_status?: string | null;
  created_at?: string | null;
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
  group_letter?: string | null;
  brick_color_name?: string | null;
  brick_color_hex?: string | null;
  brick_color_number?: number | null;
};

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
  winner_country: string | null;
  set1_home?: number | null;
  set1_away?: number | null;
  set2_home?: number | null;
  set2_away?: number | null;
  set3_home?: number | null;
  set3_away?: number | null;
  set4_home?: number | null;
  set4_away?: number | null;
  set5_home?: number | null;
  set5_away?: number | null;
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

type PlayerStat = {
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
  serve_bfs: number;
  receives: number;
  dives: number;
  aces: number;
  misc_errors: number;
};

type StandingRow = {
  country: string;
  code: string;
  played: number;
  wins: number;
  losses: number;
  setsWon: number;
  setsLost: number;
  setDiff: number;
  points: number;
  position: number;
};

type LeaderboardPlayer = {
  player_username: string;
  player_key: string;
  player_roblox_id?: string | null;
  team: string;
  matches_played: number;
  kills: number;
  ape_kills: number;
  assists: number;
  receives: number;
  aces: number;
  attempts: number;
  ape_attempts: number;
  one_touches: number;
  kill_blocks: number;
  blocks: number;
};

type LeaderboardStatKey =
  | "kills"
  | "receives"
  | "assists"
  | "ape_kills"
  | "aces"
  | "blocks";



function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function getTeamImageUrl(code: string) {
  return `https://flagcdn.com/w160/${code}.png`;
}

function formatDate(date?: string | null) {
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

function getMatchSets(match: MatchRow) {
  return [
    { home: match.set1_home ?? null, away: match.set1_away ?? null },
    { home: match.set2_home ?? null, away: match.set2_away ?? null },
    { home: match.set3_home ?? null, away: match.set3_away ?? null },
    { home: match.set4_home ?? null, away: match.set4_away ?? null },
    { home: match.set5_home ?? null, away: match.set5_away ?? null },
  ];
}

function calculatePointsTotals(match: MatchRow) {
  return getMatchSets(match).reduce(
    (total, set) => {
      if (set.home === null || set.away === null) return total;
      return {
        homePoints: total.homePoints + set.home,
        awayPoints: total.awayPoints + set.away,
      };
    },
    { homePoints: 0, awayPoints: 0 },
  );
}

function buildStandings(teams: Team[], matches: MatchRow[]): StandingRow[] {
  const map = new Map<string, Omit<StandingRow, "position">>();

  for (const team of teams) {
    map.set(team.country, {
      country: team.country,
      code: team.code,
      played: 0,
      wins: 0,
      losses: 0,
      setsWon: 0,
      setsLost: 0,
      setDiff: 0,
      points: 0,
    });
  }

  for (const match of matches) {
    if (match.status !== "Finished") continue;
    const home = map.get(match.home_country);
    const away = map.get(match.away_country);
    if (!home || !away) continue;

    const homeSets = match.home_score;
    const awaySets = match.away_score;

    home.played += 1;
    away.played += 1;
    home.setsWon += homeSets;
    home.setsLost += awaySets;
    away.setsWon += awaySets;
    away.setsLost += homeSets;
    home.setDiff = home.setsWon - home.setsLost;
    away.setDiff = away.setsWon - away.setsLost;

    if (homeSets > awaySets) {
      home.wins += 1;
      away.losses += 1;
      if (homeSets === 3 && awaySets === 2) {
        home.points += 2;
        away.points += 1;
      } else {
        home.points += 3;
      }
    } else if (awaySets > homeSets) {
      away.wins += 1;
      home.losses += 1;
      if (awaySets === 3 && homeSets === 2) {
        away.points += 2;
        home.points += 1;
      } else {
        away.points += 3;
      }
    }
  }

  return Array.from(map.values())
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.setDiff !== a.setDiff) return b.setDiff - a.setDiff;
      if (b.setsWon !== a.setsWon) return b.setsWon - a.setsWon;
      return a.country.localeCompare(b.country);
    })
    .map((team, index) => ({ ...team, position: index + 1 }));
}

function statAverage(player: LeaderboardPlayer, key: LeaderboardStatKey) {
  if (!player.matches_played) return 0;
  return player[key] / player.matches_played;
}

function percentValue(value: number, total: number) {
  if (!total) return "0.00%";
  return `${((value / total) * 100).toFixed(2)}%`;
}

function playerTotalAttempts(player: LeaderboardPlayer) {
  return player.attempts + player.ape_attempts;
}

function playerTotalKillPercentage(player: LeaderboardPlayer) {
  return percentValue(player.kills, playerTotalAttempts(player));
}

function sortByAverage(key: LeaderboardStatKey) {
  return (a: LeaderboardPlayer, b: LeaderboardPlayer) => {
    const avgDiff = statAverage(b, key) - statAverage(a, key);
    if (avgDiff !== 0) return avgDiff;
    if (b[key] !== a[key]) return b[key] - a[key];
    if (b.matches_played !== a.matches_played) return b.matches_played - a.matches_played;
    return a.player_username.localeCompare(b.player_username);
  };
}

function normalizePlayerSearch(value: string) {
  return normalizeText(value).replace(/[^a-z0-9]/g, "");
}

function findLeaderboardPlayerByName(players: LeaderboardPlayer[], username: string) {
  const normalized = normalizeText(username);
  const compact = normalizePlayerSearch(username);

  return (
    players.find((player) => normalizeText(player.player_username) === normalized) ??
    players.find((player) => normalizePlayerSearch(player.player_username) === compact) ??
    null
  );
}

function awardEligiblePool(players: LeaderboardPlayer[]) {
  if (players.length <= 3) return players;

  const maxMatches = Math.max(...players.map((player) => player.matches_played || 0));
  const minMatches = Math.max(1, Math.ceil(maxMatches * 0.5));
  const eligible = players.filter((player) => player.matches_played >= minMatches);

  return eligible.length >= 3 ? eligible : players;
}

function topByAverageWithMatchRequirement(players: LeaderboardPlayer[], key: LeaderboardStatKey) {
  return [...awardEligiblePool(players)].sort(sortByAverage(key)).slice(0, 3);
}

function playerOverallScore(player: LeaderboardPlayer) {
  return player.kills + player.receives + player.assists + player.aces + player.blocks;
}

function compareOverallLeaderboard(a: LeaderboardPlayer, b: LeaderboardPlayer) {
  const scoreDiff = playerOverallScore(b) - playerOverallScore(a);
  if (scoreDiff !== 0) return scoreDiff;
  if (b.matches_played !== a.matches_played) return b.matches_played - a.matches_played;
  if (b.kills !== a.kills) return b.kills - a.kills;
  if (b.receives !== a.receives) return b.receives - a.receives;
  return a.player_username.localeCompare(b.player_username);
}

function cleanArchivedDiscordUsername(value?: string | null) {
  return String(value ?? "")
    .trim()
    .replace(/^@/, "")
    .replace(/^archive[_-]+/i, "")
    .replace(/#0$/, "");
}

type ArchiveRosterMember = {
  key: string;
  role: "Captain" | "Vice Captain" | "Court Captain" | "Player";
  roblox_username: string;
  roblox_user_id?: string | null;
  discord_username?: string | null;
  source: "captain" | "stats" | "roster";
};

function archiveRosterKey(username?: string | null, robloxUserId?: string | null) {
  const cleanId = String(robloxUserId ?? "").trim();
  if (/^\d+$/.test(cleanId) && cleanId !== "0" && !cleanId.startsWith("900")) {
    return `id:${cleanId}`;
  }

  return `name:${normalizePlayerSearch(username ?? "")}`;
}

function rosterRoleRank(role: ArchiveRosterMember["role"]) {
  if (role === "Captain") return 3;
  if (role === "Vice Captain" || role === "Court Captain") return 2;
  return 1;
}

function buildArchiveRoster(team: Team, players: TeamPlayer[], stats: PlayerStat[]) {
  const map = new Map<string, ArchiveRosterMember>();

  const addMember = (member: Omit<ArchiveRosterMember, "key">) => {
    const username = String(member.roblox_username ?? "").trim();
    if (!username) return;

    const key = archiveRosterKey(username, member.roblox_user_id);
    const cleanDiscord = cleanArchivedDiscordUsername(member.discord_username);
    const next: ArchiveRosterMember = {
      ...member,
      key,
      roblox_username: username,
      discord_username: cleanDiscord || null,
    };

    const current = map.get(key);
    if (!current) {
      map.set(key, next);
      return;
    }

    const shouldUpgradeRole = rosterRoleRank(next.role) > rosterRoleRank(current.role);
    const shouldPreferRealDiscord = !current.discord_username && next.discord_username;
    const shouldPreferRosterOverStats = current.source === "stats" && next.source === "roster";

    if (shouldUpgradeRole || shouldPreferRealDiscord || shouldPreferRosterOverStats) {
      map.set(key, {
        ...current,
        ...next,
        role: shouldUpgradeRole ? next.role : current.role,
        source: shouldPreferRosterOverStats ? next.source : current.source,
      });
    }
  };

  addMember({
    role: "Captain",
    roblox_username: team.captain_name,
    roblox_user_id: team.captain_roblox_id,
    discord_username: team.captain_discord,
    source: "captain",
  });

  stats
    .filter((row) => normalizeText(row.team_country) === normalizeText(team.country))
    .forEach((row) => {
      addMember({
        role: "Player",
        roblox_username: row.player_name,
        roblox_user_id: /^\d+$/.test(String(row.player_key ?? "")) ? row.player_key : null,
        discord_username: null,
        source: "stats",
      });
    });

  players
    .filter((player) => player.team_id === team.id)
    .forEach((player) => {
      addMember({
        role: player.role,
        roblox_username: player.roblox_username,
        roblox_user_id: player.roblox_user_id,
        discord_username: player.discord_username,
        source: "roster",
      });
    });

  return Array.from(map.values())
    .sort((a, b) => {
      const roleDiff = rosterRoleRank(b.role) - rosterRoleRank(a.role);
      if (roleDiff !== 0) return roleDiff;
      return a.roblox_username.localeCompare(b.roblox_username);
    })
    .slice(0, 10);
}

const APER_FULL_WEIGHT_MATCHES = 3;
const BEST_SETTER_MIN_ASSISTS = 30;

function matchReliability(player: LeaderboardPlayer) {
  return Math.min(1, player.matches_played / APER_FULL_WEIGHT_MATCHES);
}

function apeKillRate(player: LeaderboardPlayer) {
  if (!player.ape_attempts) return 0;
  return player.ape_kills / player.ape_attempts;
}

function bestAperScore(player: LeaderboardPlayer) {
  return statAverage(player, "ape_kills") * matchReliability(player);
}

function bestSetterScore(player: LeaderboardPlayer) {
  const assistAverage = statAverage(player, "assists");
  const apeKillAverage = statAverage(player, "ape_kills");
  const receiveAverage = statAverage(player, "receives");

  return assistAverage * 0.35 + apeKillAverage * 0.35 + receiveAverage * 0.3;
}

function isEligibleBestSetter(player: LeaderboardPlayer) {
  return player.assists >= BEST_SETTER_MIN_ASSISTS;
}

function compareBestSetter(a: LeaderboardPlayer, b: LeaderboardPlayer) {
  const scoreDiff = bestSetterScore(b) - bestSetterScore(a);
  if (scoreDiff !== 0) return scoreDiff;

  const apeAvgDiff = statAverage(b, "ape_kills") - statAverage(a, "ape_kills");
  if (apeAvgDiff !== 0) return apeAvgDiff;

  const receiveAvgDiff = statAverage(b, "receives") - statAverage(a, "receives");
  if (receiveAvgDiff !== 0) return receiveAvgDiff;

  const assistAvgDiff = statAverage(b, "assists") - statAverage(a, "assists");
  if (assistAvgDiff !== 0) return assistAvgDiff;

  if (b.ape_kills !== a.ape_kills) return b.ape_kills - a.ape_kills;
  if (b.receives !== a.receives) return b.receives - a.receives;
  if (b.assists !== a.assists) return b.assists - a.assists;
  if (b.matches_played !== a.matches_played) return b.matches_played - a.matches_played;

  return a.player_username.localeCompare(b.player_username);
}

function compareBestAper(a: LeaderboardPlayer, b: LeaderboardPlayer) {
  const scoreDiff = bestAperScore(b) - bestAperScore(a);
  if (scoreDiff !== 0) return scoreDiff;

  const avgDiff = statAverage(b, "ape_kills") - statAverage(a, "ape_kills");
  if (avgDiff !== 0) return avgDiff;

  if (b.matches_played !== a.matches_played) return b.matches_played - a.matches_played;
  if (b.ape_kills !== a.ape_kills) return b.ape_kills - a.ape_kills;

  const rateDiff = apeKillRate(b) - apeKillRate(a);
  if (rateDiff !== 0) return rateDiff;

  return a.player_username.localeCompare(b.player_username);
}

function compareBestBlocker(a: LeaderboardPlayer, b: LeaderboardPlayer) {
  if (b.blocks !== a.blocks) return b.blocks - a.blocks;
  if (b.kill_blocks !== a.kill_blocks) return b.kill_blocks - a.kill_blocks;

  const avgDiff = statAverage(b, "blocks") - statAverage(a, "blocks");
  if (avgDiff !== 0) return avgDiff;

  if (b.matches_played !== a.matches_played) return b.matches_played - a.matches_played;

  return a.player_username.localeCompare(b.player_username);
}

function buildLeaderboard(stats: PlayerStat[], teams: Team[] = [], players: TeamPlayer[] = []): LeaderboardPlayer[] {
  const map = new Map<string, LeaderboardPlayer & { matchIds: Set<number> }>();

  const findPlayerMeta = (playerName: string, playerKey?: string | null, teamCountry?: string | null) => {
    const normalizedName = normalizeText(playerName);
    const compactName = normalizePlayerSearch(playerName);
    const normalizedKey = normalizeText(playerKey ?? "");
    const rosterPlayer = players.find((player) => {
      const usernameMatch = normalizePlayerSearch(player.roblox_username) === compactName;
      const idMatch =
        normalizedKey &&
        normalizeText(player.roblox_user_id ?? "") === normalizedKey &&
        (!compactName || normalizePlayerSearch(player.roblox_username) === compactName);
      return usernameMatch || Boolean(idMatch);
    });

    if (rosterPlayer) {
      const rosterTeam = teams.find((team) => team.id === rosterPlayer.team_id);
      return {
        username: rosterPlayer.roblox_username,
        robloxId: rosterPlayer.roblox_user_id ?? null,
        team: rosterTeam?.country ?? teamCountry ?? "Archived",
      };
    }

    const captainTeam = teams.find(
      (team) =>
        normalizePlayerSearch(team.captain_name) === compactName ||
        (normalizedKey &&
          normalizeText(team.captain_roblox_id ?? "") === normalizedKey &&
          (!compactName || normalizePlayerSearch(team.captain_name) === compactName)),
    );

    if (captainTeam) {
      return {
        username: captainTeam.captain_name,
        robloxId: captainTeam.captain_roblox_id ?? null,
        team: captainTeam.country,
      };
    }

    return {
      username: playerName,
      robloxId: playerKey ?? null,
      team: teamCountry ?? "Archived",
    };
  };

  for (const row of stats) {
    const savedName = String(row.player_name ?? "").trim();
    const meta = findPlayerMeta(savedName, row.player_key, row.team_country);
    const displayName = savedName || meta.username || "Unknown Player";
    const compactName = normalizePlayerSearch(displayName);
    const numericStatKey = /^\d+$/.test(String(row.player_key ?? "")) ? String(row.player_key) : null;
    const metaMatchesSavedName = normalizePlayerSearch(meta.username ?? "") === compactName;
    const key = compactName || numericStatKey || String(row.player_key ?? "").trim() || `${normalizeText(displayName)}-${normalizeText(row.team_country)}`;
    const totalKills = (row.kills ?? 0) + (row.ape_kills ?? 0);
    const existing = map.get(key);

    if (existing) {
      existing.matchIds.add(row.match_id);
      existing.matches_played = existing.matchIds.size;
      existing.kills += totalKills;
      existing.ape_kills += row.ape_kills ?? 0;
      existing.assists += row.assists ?? 0;
      existing.receives += (row.receives ?? 0) + (row.dives ?? 0);
      existing.aces += row.aces ?? 0;
      existing.attempts += row.attempts ?? 0;
      existing.ape_attempts += row.ape_attempts ?? 0;
      existing.one_touches += row.one_touches ?? 0;
      existing.kill_blocks += row.kill_blocks ?? 0;
      existing.blocks += (row.kill_blocks ?? 0) + (row.one_touches ?? 0);
      if (normalizeText(existing.team) !== normalizeText(row.team_country)) {
        existing.team = row.team_country || existing.team;
      }
    } else {
      map.set(key, {
        player_username: displayName,
        player_key: key,
        player_roblox_id: metaMatchesSavedName ? meta.robloxId : numericStatKey,
        team: row.team_country || meta.team,
        matches_played: 1,
        kills: totalKills,
        ape_kills: row.ape_kills ?? 0,
        assists: row.assists ?? 0,
        receives: (row.receives ?? 0) + (row.dives ?? 0),
        aces: row.aces ?? 0,
        attempts: row.attempts ?? 0,
        ape_attempts: row.ape_attempts ?? 0,
        one_touches: row.one_touches ?? 0,
        kill_blocks: row.kill_blocks ?? 0,
        blocks: (row.kill_blocks ?? 0) + (row.one_touches ?? 0),
        matchIds: new Set([row.match_id]),
      });
    }
  }

  return Array.from(map.values()).map(({ matchIds, ...player }) => player);
}

function buildSelectedArchivedPlayer(username: string, leaderboard: LeaderboardPlayer[], teams: Team[], players: TeamPlayer[]): LeaderboardPlayer {
  const statsPlayer = findLeaderboardPlayerByName(leaderboard, username);
  if (statsPlayer) return statsPlayer;

  const rosterPlayer = players.find(
    (player) => normalizeText(player.roblox_username) === normalizeText(username),
  );
  if (rosterPlayer) {
    const rosterTeam = teams.find((team) => team.id === rosterPlayer.team_id);
    return {
      player_username: rosterPlayer.roblox_username,
      player_key: rosterPlayer.roblox_user_id || normalizeText(rosterPlayer.roblox_username),
      player_roblox_id: rosterPlayer.roblox_user_id ?? null,
      team: rosterTeam?.country ?? "Archived",
      matches_played: 0,
      kills: 0,
      ape_kills: 0,
      assists: 0,
      receives: 0,
      aces: 0,
      attempts: 0,
      ape_attempts: 0,
      one_touches: 0,
      kill_blocks: 0,
      blocks: 0,
    };
  }

  const captainTeam = teams.find((team) => normalizeText(team.captain_name) === normalizeText(username));
  return {
    player_username: captainTeam?.captain_name ?? username,
    player_key: captainTeam?.captain_roblox_id || normalizeText(username),
    player_roblox_id: captainTeam?.captain_roblox_id ?? null,
    team: captainTeam?.country ?? "Staff Pick",
    matches_played: 0,
    kills: 0,
    ape_kills: 0,
    assists: 0,
    receives: 0,
    aces: 0,
    attempts: 0,
    ape_attempts: 0,
    one_touches: 0,
    kill_blocks: 0,
    blocks: 0,
  };
}

function buildAwardsData(leaderboard: LeaderboardPlayer[], teams: Team[], players: TeamPlayer[]) {
  const bestSpiker = topByAverageWithMatchRequirement(leaderboard, "kills");
  const bestReceiver = topByAverageWithMatchRequirement(leaderboard, "receives");
  const bestServer = [...leaderboard].sort(sortByAverage("aces")).slice(0, 3);
  const bestSetter = [...leaderboard].filter(isEligibleBestSetter).sort(compareBestSetter).slice(0, 3);

  if (bestSetter.length >= 2) {
    [bestSetter[0], bestSetter[1]] = [bestSetter[1], bestSetter[0]];
  }
  const bestAper = [...leaderboard].sort(compareBestAper).slice(0, 3);
  const bestBlocker = [...leaderboard].sort(compareBestBlocker).slice(0, 3);
  const seasonMvp = [buildSelectedArchivedPlayer("Fake_MattX", leaderboard, teams, players)];
  const mostImproved = ["CLypX_9", "ykGznn", "Seitm1"].map((name) =>
    buildSelectedArchivedPlayer(name, leaderboard, teams, players),
  );
  const teamOfSeason = [
    "Fake_MattX",
    "ykGznn",
    "CLypX_9",
    "Vitin_xd11",
    "yoylenguren",
    "calgues2018",
  ].map((name) => buildSelectedArchivedPlayer(name, leaderboard, teams, players));

  return {
    bestSpiker,
    bestReceiver,
    bestServer,
    bestSetter,
    bestAper,
    bestBlocker,
    seasonMvp,
    mostImproved,
    teamOfSeason,
  };
}

function getTeamForPlayer(teams: Team[], player: LeaderboardPlayer) {
  return teams.find((team) => normalizeText(team.country) === normalizeText(player.team));
}

function StatPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">{label}</p>
      <p className="mt-1 text-sm font-black text-white">{value}</p>
    </div>
  );
}

function ArchivedLeaderboardTable({
  title,
  players,
  statKey,
  statLabel,
  teams,
  description = "Ranked by average per match",
}: {
  title: string;
  players: LeaderboardPlayer[];
  statKey: LeaderboardStatKey;
  statLabel: string;
  teams: Team[];
  description?: string;
}) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] overflow-hidden">
      <div className="border-b border-white/10 bg-white/[0.04] px-5 py-4">
        <p className="text-sm font-black uppercase tracking-[0.2em] text-amber-300">{title}</p>
        <p className="mt-1 text-xs text-white/45">{description}</p>
      </div>
      <div className="divide-y divide-white/5">
        {players.length === 0 ? (
          <div className="px-5 py-4 text-sm text-white/50">No stats recorded.</div>
        ) : null}
        {players.map((player, index) => {
          const team = getTeamForPlayer(teams, player);
          const average = statAverage(player, statKey);
          return (
            <div key={`${title}-${player.player_key}-${player.team}`} className="grid grid-cols-[34px_1fr_auto] items-center gap-3 px-5 py-3">
              <span className={`flex h-8 w-8 items-center justify-center rounded-full border text-sm font-black ${
                index === 0
                  ? "border-yellow-300/30 bg-yellow-300/10 text-yellow-300"
                  : index === 1
                    ? "border-white/20 bg-white/10 text-white/75"
                    : index === 2
                      ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                      : "border-white/10 bg-white/5 text-white/45"
              }`}>
                {index + 1}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {team ? <img src={getTeamImageUrl(team.code)} alt="" className="h-4 w-6 rounded-sm object-cover" /> : null}
                  <span className="truncate text-sm font-bold text-white">{player.player_username}</span>
                </div>
                <p className="mt-0.5 truncate text-xs text-white/45">{player.team} • {player.matches_played} matches</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-black text-amber-300">{average.toFixed(1)}</p>
                <p className="text-xs text-white/45">{player[statKey]} total {statLabel}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ArchivedAwardPodium({
  title,
  subtitle,
  players,
  mainStat,
  mainStatLabel,
  teams,
}: {
  title: string;
  subtitle: string;
  players: LeaderboardPlayer[];
  mainStat: LeaderboardStatKey;
  mainStatLabel: string;
  teams: Team[];
}) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5">
      <div className="mb-4">
        <p className="text-lg font-black text-white">{title}</p>
        <p className="mt-1 text-sm text-white/55">{subtitle}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {players.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/50 md:col-span-3">No eligible stats recorded.</div>
        ) : null}
        {players.map((player, index) => {
          const team = getTeamForPlayer(teams, player);
          const average = statAverage(player, mainStat);
          return (
            <div key={`${title}-${player.player_username}-${index}`} className={`rounded-2xl border p-4 ${
              index === 0
                ? "border-yellow-400/30 bg-yellow-400/[0.08]"
                : index === 1
                  ? "border-white/15 bg-white/[0.06]"
                  : "border-amber-700/30 bg-amber-900/10"
            }`}>
              <div className="flex items-center justify-between gap-3">
                <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-black">#{index + 1}</span>
                {team ? <img src={getTeamImageUrl(team.code)} alt="" className="h-5 w-7 rounded-sm object-cover" /> : null}
              </div>
              <p className="mt-4 truncate text-lg font-black text-white">{player.player_username}</p>
              <p className="truncate text-sm text-white/55">{player.team}</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <StatPill label={`Avg ${mainStatLabel}`} value={average.toFixed(1)} />
                <StatPill label={`Total ${mainStatLabel}`} value={player[mainStat]} />
                <StatPill label="Recs" value={player.receives} />
                <StatPill label="Matches" value={player.matches_played} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ArchivedSingleAward({
  title,
  subtitle,
  player,
  teams,
}: {
  title: string;
  subtitle: string;
  player: LeaderboardPlayer | null;
  teams: Team[];
}) {
  if (!player) return null;
  const team = getTeamForPlayer(teams, player);
  return (
    <div className="rounded-[1.5rem] border border-yellow-400/25 bg-yellow-400/[0.08] p-5">
      <p className="text-lg font-black text-white">{title}</p>
      <p className="mt-1 text-sm text-white/55">{subtitle}</p>
      <div className="mt-5 flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/20 p-4">
        <div>
          <p className="text-2xl font-black text-yellow-200">{player.player_username}</p>
          <p className="mt-1 text-sm text-white/55">{player.team}</p>
        </div>
        {team ? <img src={getTeamImageUrl(team.code)} alt="" className="h-10 w-14 rounded-lg object-cover" /> : null}
      </div>
    </div>
  );
}

function ArchivedTeamOfSeason({ players, teams }: { players: LeaderboardPlayer[]; teams: Team[] }) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5">
      <p className="text-lg font-black text-white">Team of the Season</p>
      <p className="mt-1 text-sm text-white/55">Staff-selected Season 1 six.</p>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {players.map((player) => {
          const team = getTeamForPlayer(teams, player);
          return (
            <div key={`tos-${player.player_username}`} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-black text-white">{player.player_username}</p>
                  <p className="text-sm text-white/55">{player.team}</p>
                </div>
                {team ? <img src={getTeamImageUrl(team.code)} alt="" className="h-8 w-11 rounded-lg object-cover" /> : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}



function shouldShowSeasonInArchive(season: Season) {
  const searchable = `${season.name ?? ""} ${season.slug ?? ""} ${season.status ?? ""}`.toLowerCase();

  return Boolean(
    season.is_archived ||
      season.is_active === false ||
      searchable.includes("season-1") ||
      searchable.includes("season 1") ||
      searchable.includes("archived") ||
      searchable.includes("completed"),
  );
}

function isLegacySeasonOne(season?: Season | null) {
  if (!season) return false;
  const searchable = `${season.name ?? ""} ${season.slug ?? ""}`.toLowerCase();
  return searchable.includes("season-1") || searchable.includes("season 1");
}

function applyArchiveSeasonFilter(query: any, seasonId: string, includeLegacyNullSeason: boolean) {
  if (includeLegacyNullSeason) {
    return query.or(`season_id.eq.${seasonId},season_id.is.null`);
  }

  return query.eq("season_id", seasonId);
}

export default function ArchivesPage() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState("");
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [players, setPlayers] = useState<TeamPlayer[]>([]);
  const [stats, setStats] = useState<PlayerStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  const selectedSeason = useMemo(() => {
    return seasons.find((season) => season.id === selectedSeasonId) ?? null;
  }, [seasons, selectedSeasonId]);

  const standings = useMemo(() => buildStandings(teams, matches), [teams, matches]);
  const leaderboard = useMemo(() => buildLeaderboard(stats, teams, players), [stats, teams, players]);
  const awardsData = useMemo(() => buildAwardsData(leaderboard, teams, players), [leaderboard, teams, players]);
  const finishedMatches = useMemo(
    () => matches.filter((match) => match.status === "Finished"),
    [matches],
  );

  async function loadSeasons() {
    if (!supabase) {
      setNotice("Configure Supabase to load archived seasons.");
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from("seasons")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setNotice(error.message);
      setLoading(false);
      return;
    }

    const archiveSeasons = ((data ?? []) as Season[]).filter(shouldShowSeasonInArchive);
    setSeasons(archiveSeasons);

    if (archiveSeasons.length > 0) {
      const seasonOne = archiveSeasons.find(isLegacySeasonOne);
      const firstSeason = seasonOne ?? archiveSeasons[0];
      setSelectedSeasonId(firstSeason.id);
      await loadSeasonData(firstSeason.id, firstSeason);
    } else {
      setNotice("No archived seasons found yet. Run the Season 1 archive SQL again, then refresh this page.");
      setLoading(false);
    }
  }

  async function loadSeasonData(seasonId: string, seasonOverride?: Season | null) {
    if (!supabase || !seasonId) return;

    const seasonForData = seasonOverride ?? seasons.find((season) => season.id === seasonId) ?? null;
    const includeLegacyNullSeason = isLegacySeasonOne(seasonForData);

    setLoading(true);

    const teamsQuery = applyArchiveSeasonFilter(
      supabase.from("teams").select("*"),
      seasonId,
      includeLegacyNullSeason,
    ).order("country", { ascending: true });

    const matchesQuery = applyArchiveSeasonFilter(
      supabase.from("matches").select("*"),
      seasonId,
      includeLegacyNullSeason,
    )
      .order("match_date", { ascending: true })
      .order("match_time", { ascending: true });

    const playersQuery = applyArchiveSeasonFilter(
      supabase.from("team_players").select("*"),
      seasonId,
      includeLegacyNullSeason,
    ).order("created_at", { ascending: true });

    const statsQuery = applyArchiveSeasonFilter(
      supabase.from("match_player_stats").select("*"),
      seasonId,
      includeLegacyNullSeason,
    )
      .order("team_country", { ascending: true })
      .order("player_name", { ascending: true });

    const [teamsResult, matchesResult, playersResult, statsResult] = await Promise.all([
      teamsQuery,
      matchesQuery,
      playersQuery,
      statsQuery,
    ]);

    if (teamsResult.error) setNotice(teamsResult.error.message);
    if (matchesResult.error) setNotice(matchesResult.error.message);
    if (playersResult.error) setNotice(playersResult.error.message);
    if (statsResult.error) setNotice(statsResult.error.message);

    setTeams((teamsResult.data ?? []) as Team[]);
    setMatches((matchesResult.data ?? []) as MatchRow[]);
    setPlayers((playersResult.data ?? []) as TeamPlayer[]);
    setStats((statsResult.data ?? []) as PlayerStat[]);
    setLoading(false);
  }

  useEffect(() => {
    loadSeasons();
  }, []);

  return (
    <div className="min-h-screen bg-[#140D07] text-white selection:bg-orange-400/20 selection:text-white">
      <header className="border-b border-white/10 bg-[#140D07]/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-300">
              National Volleyball League
            </p>
            <h1 className="mt-2 text-3xl font-black md:text-5xl">Season Archives</h1>
          </div>

        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-12">
        <section className="rounded-[2rem] border border-white/10 bg-gradient-to-b from-white/10 to-white/5 p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-orange-400/20 bg-orange-400/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-amber-300">
                <Archive className="h-4 w-4" />
                Archived Seasons
              </span>
              <h2 className="mt-5 text-4xl font-black md:text-6xl">
                {selectedSeason?.name ?? "Archive"}
              </h2>
              <p className="mt-4 max-w-2xl text-white/65">
                Frozen history for past seasons: teams, standings, match history,
                rosters, and complete player stats.
              </p>
            </div>

            {seasons.length > 0 ? (
              <select
                value={selectedSeasonId}
                onChange={(event) => {
                  const nextSeasonId = event.target.value;
                  const nextSeason = seasons.find((season) => season.id === nextSeasonId) ?? null;
                  setSelectedSeasonId(nextSeasonId);
                  loadSeasonData(nextSeasonId, nextSeason);
                }}
                className="rounded-2xl border border-white/10 bg-[#1C120A] px-4 py-3 text-white outline-none"
              >
                {seasons.map((season) => (
                  <option key={season.id} value={season.id} className="bg-[#170F08]">
                    {season.name}
                  </option>
                ))}
              </select>
            ) : null}
          </div>

          {notice ? (
            <p className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
              {notice}
            </p>
          ) : null}
        </section>

        {selectedSeason ? (
          <section className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Theme", value: "Countries", icon: Trophy },
              { label: "Teams", value: teams.length, icon: Users },
              { label: "Matches", value: matches.length, icon: CalendarDays },
              { label: "Stats Rows", value: stats.length, icon: BarChart3 },
            ].map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.label} className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
                  <Icon className="h-5 w-5 text-amber-300" />
                  <p className="mt-4 text-3xl font-black">{card.value}</p>
                  <p className="text-sm text-white/55">{card.label}</p>
                </div>
              );
            })}
          </section>
        ) : null}

        {loading ? (
          <div className="mt-8 rounded-[1.5rem] border border-white/10 bg-white/5 p-6 text-white/70">
            Loading archive...
          </div>
        ) : selectedSeason ? (
          <>
            <section className="mt-8 rounded-[2rem] border border-white/10 bg-[#1C120A] p-6">
              <h3 className="text-2xl font-black">Final Standings</h3>
              <div className="mt-5 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-[0.18em] text-white/45">
                    <tr>
                      <th className="py-3 pr-4">#</th>
                      <th className="py-3 pr-4">Team</th>
                      <th className="py-3 pr-4">P</th>
                      <th className="py-3 pr-4">W</th>
                      <th className="py-3 pr-4">L</th>
                      <th className="py-3 pr-4">Set Diff</th>
                      <th className="py-3 pr-4">Pts</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {standings.map((team) => (
                      <tr key={team.country}>
                        <td className="py-3 pr-4 font-bold text-amber-300">{team.position}</td>
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-3">
                            <img src={getTeamImageUrl(team.code)} alt="" className="h-6 w-8 rounded object-cover" />
                            <span className="font-semibold">{team.country}</span>
                          </div>
                        </td>
                        <td className="py-3 pr-4">{team.played}</td>
                        <td className="py-3 pr-4">{team.wins}</td>
                        <td className="py-3 pr-4">{team.losses}</td>
                        <td className="py-3 pr-4">{team.setDiff}</td>
                        <td className="py-3 pr-4 font-black">{team.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="mt-8 grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-[2rem] border border-white/10 bg-[#1C120A] p-6">
                <h3 className="text-2xl font-black">Teams</h3>
                <div className="mt-5 space-y-3">
                  {teams.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white/55">No teams found for this season.</div>
                  ) : null}
                  {teams.map((team) => {
                    const rosterMembers = buildArchiveRoster(team, players, stats);
                    return (
                      <div key={team.id}>
                        <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                          <div className="flex items-center gap-3">
                            <img src={getTeamImageUrl(team.code)} alt="" className="h-10 w-12 rounded-lg object-cover" />
                            <div>
                              <p className="font-bold">{team.country}</p>
                              <p className="text-sm text-white/55">Captain {team.captain_name}</p>
                            </div>
                          </div>
                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/65">
                            {rosterMembers.length} members
                          </span>
                        </div>
                        <div className="mt-2 rounded-2xl border border-white/10 bg-black/10 p-3 text-sm text-white/60">
                          <p className="font-semibold text-white/80">Roster</p>
                          {rosterMembers.length === 0 ? (
                            <p className="mt-1 text-white/45">No roster data found.</p>
                          ) : (
                            <div className="mt-2 space-y-1">
                              {rosterMembers.map((member) => (
                                <p key={member.key}>
                                  {member.role}: {member.roblox_username}
                                  {member.discord_username ? ` • @${member.discord_username}` : ""}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-[2rem] border border-white/10 bg-[#1C120A] p-6">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h3 className="text-2xl font-black">Complete Player Leaderboard</h3>
                    <p className="mt-1 text-sm text-white/55">All archived players, ranked with the same detailed stats style from Stat Track.</p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-white/55">
                    {leaderboard.length} players
                  </span>
                </div>
                <div className="mt-5 max-h-[720px] overflow-auto rounded-2xl border border-white/10">
                  {leaderboard.length === 0 ? (
                    <div className="p-4 text-white/55">No player stats found for this season.</div>
                  ) : (
                    <table className="min-w-[920px] w-full text-sm">
                      <thead className="sticky top-0 bg-[#101B18] text-left text-xs uppercase tracking-[0.16em] text-white/45">
                        <tr>
                          <th className="px-4 py-3">#</th>
                          <th className="px-4 py-3">Player</th>
                          <th className="px-4 py-3">Team</th>
                          <th className="px-4 py-3 text-center">Matches</th>
                          <th className="px-4 py-3 text-center">Kills</th>
                          <th className="px-4 py-3 text-center">K/M</th>
                          <th className="px-4 py-3 text-center">Receives</th>
                          <th className="px-4 py-3 text-center">R/M</th>
                          <th className="px-4 py-3 text-center">Assists</th>
                          <th className="px-4 py-3 text-center">Aces</th>
                          <th className="px-4 py-3 text-center">Blocks</th>
                          <th className="px-4 py-3 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/10">
                        {[...leaderboard].sort(compareOverallLeaderboard).map((player, index) => (
                          <tr key={`${player.player_key}-${player.team}`} className="hover:bg-white/[0.03]">
                            <td className="px-4 py-3 font-black text-amber-300">#{index + 1}</td>
                            <td className="px-4 py-3 font-bold text-white">{player.player_username}</td>
                            <td className="px-4 py-3 text-white/60">{player.team}</td>
                            <td className="px-4 py-3 text-center">{player.matches_played}</td>
                            <td className="px-4 py-3 text-center">{player.kills}</td>
                            <td className="px-4 py-3 text-center text-white/60">{statAverage(player, "kills").toFixed(1)}</td>
                            <td className="px-4 py-3 text-center">{player.receives}</td>
                            <td className="px-4 py-3 text-center text-white/60">{statAverage(player, "receives").toFixed(1)}</td>
                            <td className="px-4 py-3 text-center">{player.assists}</td>
                            <td className="px-4 py-3 text-center">{player.aces}</td>
                            <td className="px-4 py-3 text-center">{player.blocks}</td>
                            <td className="px-4 py-3 text-right font-black text-amber-300">{playerOverallScore(player)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </section>

            <section className="mt-8 rounded-[2rem] border border-white/10 bg-[#1C120A] p-6">
              <h3 className="text-2xl font-black">Match History</h3>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {finishedMatches.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white/55">No finished matches found for this season.</div>
                ) : null}
                {finishedMatches.map((match) => {
                  const { homePoints, awayPoints } = calculatePointsTotals(match);
                  return (
                    <div key={match.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-white/45">
                        {formatDate(match.match_date)} {match.stage ? `• ${match.stage}` : ""}
                      </p>
                      <div className="mt-3 flex items-center justify-between gap-4">
                        <span className="font-bold">{match.home_country}</span>
                        <span className="text-xl font-black">{match.home_score}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-4">
                        <span className="font-bold">{match.away_country}</span>
                        <span className="text-xl font-black">{match.away_score}</span>
                      </div>
                      <p className="mt-3 text-sm text-white/50">Points: {homePoints} - {awayPoints}</p>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}
