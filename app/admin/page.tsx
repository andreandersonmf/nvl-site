"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, Star, Trophy } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

type Country = {
  name: string;
  code: string;
  emoji?: string;
  accent?: string;
};

type GroupLetter = "A" | "B" | "C" | "D";

type Team = {
  id: number;
  country: string;
  code: string;
  captain_name: string;
  captain_discord: string;
  captain_roblox_id: string;
  captain_discord_id?: string | null;
  discord_role_id?: string | null;
  approved: boolean;
  approved_at?: string | null;
  created_at: string;
  brick_color_name?: string | null;
  brick_color_hex?: string | null;
  brick_color_number?: number | null;
  group_letter?: GroupLetter | null;
  season_id?: string | null;
};

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

type MatchStatus = "Scheduled" | "Live" | "Finished";

type SiteAccess = {
  authenticated: boolean;
  profileId: string | null;
  discordId: string | null;
  isOwner: boolean;
  isAdmin: boolean;
  isStatTracker: boolean;
  isReferee: boolean;
  isMedia: boolean;
  roles: string[];
};

type SiteUser = {
  id: string;
  discord_id: string;
  discord_username: string | null;
  discord_global_name: string | null;
  avatar_url: string | null;
  isOwner: boolean;
  roles: string[];
};

type MatchRow = {
  id: number;
  home_country: string;
  away_country: string;
  stage: string | null;
  match_date: string;
  match_time: string;
  status: MatchStatus;
  home_score: number;
  away_score: number;
  winner_country: string | null;
  referee_id: number | null;
  media_id: number | null;
  stat_tracker_id: number | null;
  is_star_match: boolean;
  stats_finalized: boolean;
  stats_submitted_for_review: boolean;
  season_id?: string | null;
  created_at: string;

  // Match start fields
  match_link: string | null;
  stream_link: string | null;
  streamer_discord_id: string | null;
  referee_discord_id: string | null;

  // Result MVPs
  wmvp_discord_id: string | null;
  lmvp_discord_id: string | null;

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

  // Pickems: how many sets this match is played to (3 or 5). Purely
  // informational for how many prediction fields show on /pickems -
  // the real result above still records however many sets actually
  // happened, same as before.
  best_of: number;
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
  pointsFor: number;
  pointsAgainst: number;
  ptsDiff: number;
  points: number;
  position: number;
};

type SelectOption = {
  label: string;
  value: string;
  imageUrl?: string;
  badgeClassName?: string;
};

type MatchDraft = {
  status: MatchStatus;
  stage: string;
  match_date: string;
  match_time: string;
  home_score: number;
  away_score: number;
  referee_id: number | null;
  media_id: number | null;
  stat_tracker_id: number | null;
  is_star_match: boolean;
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

type TeamPlayerRole = "Vice Captain" | "Court Captain" | "Player";

type TeamPlayer = {
  id: number;
  team_id: number;
  roblox_username: string;
  roblox_user_id: string;
  discord_username: string;
  discord_id?: string | null;
  role: TeamPlayerRole;
  season_id?: string | null;
  created_at: string;
};

type StaffRole = "Referee" | "Media" | "Stat Tracker";

type StaffApplication = {
  id: number;
  role: StaffRole;
  email: string | null;
  user_id: string | null;
  roblox_username: string;
  discord_username: string;
  roblox_user_id: string;
  commitment_confirmed: boolean;
  rulebook_confirmed: boolean;
  approved: boolean;
  approved_at?: string | null;
  created_at: string;
};

type TeamTransaction = {
  id: string;
  team_id?: number | null;
  team_name?: string | null;
  transaction_type?: string | null;
  requested_role?: string | null;
  status?: string | null;
  player_discord_id?: string | null;
  player_discord_username?: string | null;
  requester_discord_id?: string | null;
  requester_discord_username?: string | null;
  roblox_username?: string | null;
  roblox_user_id?: string | null;
  created_at?: string | null;
};

type BrickColor = {
  name: string;
  number: number;
  hex: string;
};

type PlayerStat = {
  id?: number;
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
  spike_receives?: number | null;
  serve_bfs: number;
  receives: number;
  dives: number;
  aces: number;
  misc_errors: number;
  season_id?: string | null;
  created_at?: string | null;
};

const COUNTRY_THEMES: Country[] = [
  { name: "Argentina", code: "ar", emoji: "🇦🇷" },
  { name: "Australia", code: "au", emoji: "🇦🇺" },
  { name: "Belgium", code: "be", emoji: "🇧🇪" },
  { name: "Brazil", code: "br", emoji: "🇧🇷" },
  { name: "Canada", code: "ca", emoji: "🇨🇦" },
  { name: "Chile", code: "cl", emoji: "🇨🇱" },
  { name: "China", code: "cn", emoji: "🇨🇳" },
  { name: "Colombia", code: "co", emoji: "🇨🇴" },
  { name: "Egypt", code: "eg", emoji: "🇪🇬" },
  { name: "France", code: "fr", emoji: "🇫🇷" },
  { name: "Germany", code: "de", emoji: "🇩🇪" },
  { name: "Greece", code: "gr", emoji: "🇬🇷" },
  { name: "India", code: "in", emoji: "🇮🇳" },
  { name: "Ireland", code: "ie", emoji: "🇮🇪" },
  { name: "Israel", code: "il", emoji: "🇮🇱" },
  { name: "Italy", code: "it", emoji: "🇮🇹" },
  { name: "Japan", code: "jp", emoji: "🇯🇵" },
  { name: "Mexico", code: "mx", emoji: "🇲🇽" },
  { name: "Netherlands", code: "nl", emoji: "🇳🇱" },
  { name: "Norway", code: "no", emoji: "🇳🇴" },
  { name: "Poland", code: "pl", emoji: "🇵🇱" },
  { name: "Portugal", code: "pt", emoji: "🇵🇹" },
  { name: "Russia", code: "ru", emoji: "🇷🇺" },
  { name: "Saudi Arabia", code: "sa", emoji: "🇸🇦" },
  { name: "South Africa", code: "za", emoji: "🇿🇦" },
  { name: "South Korea", code: "kr", emoji: "🇰🇷" },
  { name: "Spain", code: "es", emoji: "🇪🇸" },
  { name: "Sweden", code: "se", emoji: "🇸🇪" },
  { name: "Switzerland", code: "ch", emoji: "🇨🇭" },
  { name: "Turkey", code: "tr", emoji: "🇹🇷" },
  { name: "United Arab Emirates", code: "ae", emoji: "🇦🇪" },
  { name: "United Kingdom", code: "gb", emoji: "🇬🇧" },
  { name: "United States", code: "us", emoji: "🇺🇸" },
];

const ACTIVE_TEAM_THEMES = COUNTRY_THEMES;
const CURRENT_SEASON_LABEL = "Season 1";
const CURRENT_SEASON_THEME = "Countries";


const BRICK_COLORS: BrickColor[] = [
  { name: "White", number: 1, hex: "#F2F3F3" },
  { name: "Grey", number: 2, hex: "#A1A5A2" },
  { name: "Light yellow", number: 3, hex: "#F9E999" },
  { name: "Brick yellow", number: 5, hex: "#D7C59A" },
  { name: "Light green (Mint)", number: 6, hex: "#C2DAB8" },
  { name: "Light reddish violet", number: 9, hex: "#E8BAC8" },
  { name: "Pastel Blue", number: 11, hex: "#80BBDB" },
  { name: "Light orange brown", number: 12, hex: "#CB8442" },
  { name: "Nougat", number: 18, hex: "#CC8E69" },
  { name: "Bright red", number: 21, hex: "#C4281C" },
  { name: "Med. reddish violet", number: 22, hex: "#C470A0" },
  { name: "Bright blue", number: 23, hex: "#0D69AC" },
  { name: "Bright yellow", number: 24, hex: "#F5CD30" },
  { name: "Earth orange", number: 25, hex: "#624732" },
  { name: "Black", number: 26, hex: "#1B2A35" },
  { name: "Dark grey", number: 27, hex: "#6D6E6C" },
  { name: "Dark green", number: 28, hex: "#287F47" },
  { name: "Medium green", number: 29, hex: "#A1C48C" },
  { name: "Lig. Yellowich orange", number: 36, hex: "#F3CF9B" },
  { name: "Bright green", number: 37, hex: "#4B974B" },
  { name: "Dark orange", number: 38, hex: "#A05F35" },
  { name: "Light bluish violet", number: 39, hex: "#C1CADE" },
  { name: "Transparent", number: 40, hex: "#ECECEC" },
  { name: "Tr. Red", number: 41, hex: "#CD544B" },
  { name: "Tr. Lg blue", number: 42, hex: "#C1DFF0" },
  { name: "Tr. Blue", number: 43, hex: "#7BB6E8" },
  { name: "Tr. Yellow", number: 44, hex: "#F7F18D" },
  { name: "Light blue", number: 45, hex: "#B4D2E4" },
  { name: "Tr. Flu. Reddish orange", number: 47, hex: "#D9856C" },
  { name: "Tr. Green", number: 48, hex: "#84B68D" },
  { name: "Tr. Flu. Green", number: 49, hex: "#F8F184" },
  { name: "Phosph. White", number: 50, hex: "#ECE8DE" },
  { name: "Light red", number: 100, hex: "#EEC4B6" },
  { name: "Medium red", number: 101, hex: "#DA867A" },
  { name: "Medium blue", number: 102, hex: "#6E99CA" },
  { name: "Light grey", number: 103, hex: "#C7C1B7" },
  { name: "Bright violet", number: 104, hex: "#6B327C" },
  { name: "Br. yellowish orange", number: 105, hex: "#E29B40" },
  { name: "Bright orange", number: 106, hex: "#DA8541" },
  { name: "Bright bluish green", number: 107, hex: "#008F9C" },
  { name: "Earth yellow", number: 108, hex: "#685C43" },
  { name: "Bright bluish violet", number: 110, hex: "#435493" },
  { name: "Tr. Brown", number: 111, hex: "#BFB7B1" },
  { name: "Medium bluish violet", number: 112, hex: "#6874AC" },
  { name: "Tr. Medi. reddish violet", number: 113, hex: "#E5ADC8" },
  { name: "Med. yellowish green", number: 115, hex: "#C7D23C" },
  { name: "Med. bluish green", number: 116, hex: "#55A5AF" },
  { name: "Light bluish green", number: 118, hex: "#B7D7D5" },
  { name: "Br. yellowish green", number: 119, hex: "#A4BD47" },
  { name: "Lig. yellowish green", number: 120, hex: "#D9E4A7" },
  { name: "Med. yellowish orange", number: 121, hex: "#E7AC58" },
  { name: "Br. reddish orange", number: 123, hex: "#D36F4C" },
  { name: "Bright reddish violet", number: 124, hex: "#923978" },
  { name: "Light orange", number: 125, hex: "#EAB892" },
  { name: "Tr. Bright bluish violet", number: 126, hex: "#A5A5CB" },
  { name: "Gold", number: 127, hex: "#DCBC81" },
  { name: "Dark nougat", number: 128, hex: "#AE7A59" },
  { name: "Silver", number: 131, hex: "#9CA3A8" },
  { name: "Neon orange", number: 133, hex: "#D5733D" },
  { name: "Neon green", number: 134, hex: "#D8DD56" },
  { name: "Sand blue", number: 135, hex: "#74869D" },
  { name: "Sand violet", number: 136, hex: "#877C90" },
  { name: "Medium orange", number: 137, hex: "#E09864" },
  { name: "Sand yellow", number: 138, hex: "#958A73" },
  { name: "Earth blue", number: 140, hex: "#203A56" },
  { name: "Earth green", number: 141, hex: "#27462D" },
  { name: "Tr. Flu. Blue", number: 143, hex: "#CFE2F7" },
  { name: "Sand blue metallic", number: 145, hex: "#7988A1" },
  { name: "Sand violet metallic", number: 146, hex: "#958EA3" },
  { name: "Sand yellow metallic", number: 147, hex: "#938767" },
  { name: "Dark grey metallic", number: 148, hex: "#575857" },
  { name: "Black metallic", number: 149, hex: "#161D32" },
  { name: "Light grey metallic", number: 150, hex: "#ABADAC" },
  { name: "Sand green", number: 151, hex: "#789082" },
  { name: "Sand red", number: 153, hex: "#957977" },
  { name: "Dark red", number: 154, hex: "#7B2E2F" },
  { name: "Tr. Flu. Yellow", number: 157, hex: "#FFF67B" },
  { name: "Tr. Flu. Red", number: 158, hex: "#E1A4C2" },
  { name: "Gun metallic", number: 168, hex: "#756C62" },
  { name: "Red flip/flop", number: 176, hex: "#97695B" },
  { name: "Yellow flip/flop", number: 178, hex: "#B48455" },
  { name: "Silver flip/flop", number: 179, hex: "#898788" },
  { name: "Curry", number: 180, hex: "#D7A94B" },
  { name: "Fire Yellow", number: 190, hex: "#F9D62E" },
  { name: "Flame yellowish orange", number: 191, hex: "#E8AB2D" },
  { name: "Reddish brown", number: 192, hex: "#694028" },
  { name: "Flame reddish orange", number: 193, hex: "#CF6024" },
  { name: "Medium stone grey", number: 194, hex: "#A3A2A5" },
  { name: "Royal blue", number: 195, hex: "#4667A4" },
  { name: "Dark Royal blue", number: 196, hex: "#23478B" },
  { name: "Bright reddish lilac", number: 198, hex: "#8E4285" },
  { name: "Dark stone grey", number: 199, hex: "#635F62" },
  { name: "Lemon metalic", number: 200, hex: "#828A5D" },
  { name: "Light stone grey", number: 208, hex: "#E5E4DF" },
  { name: "Dark Curry", number: 209, hex: "#B08E44" },
  { name: "Faded green", number: 210, hex: "#709578" },
  { name: "Turquoise", number: 211, hex: "#79B5B5" },
  { name: "Light Royal blue", number: 212, hex: "#9FC3E9" },
  { name: "Medium Royal blue", number: 213, hex: "#6C81B7" },
  { name: "Rust", number: 216, hex: "#904C2A" },
  { name: "Brown", number: 217, hex: "#7C5C46" },
  { name: "Reddish lilac", number: 218, hex: "#96709F" },
  { name: "Lilac", number: 219, hex: "#6B629B" },
  { name: "Light lilac", number: 220, hex: "#A7A9CE" },
  { name: "Bright purple", number: 221, hex: "#CD6298" },
  { name: "Light purple", number: 222, hex: "#E4ADC8" },
  { name: "Light pink", number: 223, hex: "#DC9095" },
  { name: "Light brick yellow", number: 224, hex: "#F0D5A0" },
  { name: "Warm yellowish orange", number: 225, hex: "#EBB87F" },
  { name: "Cool yellow", number: 226, hex: "#FDEA8D" },
  { name: "Dove blue", number: 232, hex: "#7DBBDD" },
  { name: "Medium lilac", number: 268, hex: "#342B75" },
  { name: "Slime green", number: 301, hex: "#506D54" },
  { name: "Smoky grey", number: 302, hex: "#5B5D69" },
  { name: "Dark blue", number: 303, hex: "#0010B0" },
  { name: "Parsley green", number: 304, hex: "#2C651D" },
  { name: "Steel blue", number: 305, hex: "#527CAE" },
  { name: "Storm blue", number: 306, hex: "#335882" },
  { name: "Lapis", number: 307, hex: "#102ADC" },
  { name: "Dark indigo", number: 308, hex: "#3D1585" },
  { name: "Sea green", number: 309, hex: "#348E40" },
  { name: "Shamrock", number: 310, hex: "#5B9A4C" },
  { name: "Fossil", number: 311, hex: "#9FA1AC" },
  { name: "Mulberry", number: 312, hex: "#592259" },
  { name: "Forest green", number: 313, hex: "#1F801D" },
  { name: "Cadet blue", number: 314, hex: "#9FADC0" },
  { name: "Electric blue", number: 315, hex: "#0989CF" },
  { name: "Eggplant", number: 316, hex: "#7B007B" },
  { name: "Moss", number: 317, hex: "#7C9C6B" },
  { name: "Artichoke", number: 318, hex: "#8AAB85" },
  { name: "Sage green", number: 319, hex: "#B9C4B1" },
  { name: "Ghost grey", number: 320, hex: "#CACBD1" },
  { name: "Lilac", number: 321, hex: "#A75E9B" },
  { name: "Plum", number: 322, hex: "#7B2F7B" },
  { name: "Olivine", number: 323, hex: "#94BE81" },
  { name: "Laurel green", number: 324, hex: "#A8BD99" },
  { name: "Quill grey", number: 325, hex: "#DFDFDE" },
  { name: "Crimson", number: 327, hex: "#970000" },
  { name: "Mint", number: 328, hex: "#B1E5A6" },
  { name: "Baby blue", number: 329, hex: "#98C2DB" },
  { name: "Carnation pink", number: 330, hex: "#FF98DC" },
  { name: "Persimmon", number: 331, hex: "#FF5959" },
  { name: "Maroon", number: 332, hex: "#750000" },
  { name: "Gold", number: 333, hex: "#EFB838" },
  { name: "Daisy orange", number: 334, hex: "#F8D96D" },
  { name: "Pearl", number: 335, hex: "#E7E7EC" },
  { name: "Fog", number: 336, hex: "#C7D4E4" },
  { name: "Salmon", number: 337, hex: "#FF9494" },
  { name: "Terra Cotta", number: 338, hex: "#BE6862" },
  { name: "Cocoa", number: 339, hex: "#562424" },
  { name: "Wheat", number: 340, hex: "#F1E7C7" },
  { name: "Buttermilk", number: 341, hex: "#FEF3BB" },
  { name: "Mauve", number: 342, hex: "#E0B2D0" },
  { name: "Sunrise", number: 343, hex: "#D490BD" },
  { name: "Tawny", number: 344, hex: "#965555" },
  { name: "Rust", number: 345, hex: "#8F4C2A" },
  { name: "Cashmere", number: 346, hex: "#D3BE96" },
  { name: "Khaki", number: 347, hex: "#E2DCBC" },
  { name: "Lily white", number: 348, hex: "#EDEAEA" },
  { name: "Seashell", number: 349, hex: "#E9DADA" },
  { name: "Burgundy", number: 350, hex: "#883E3E" },
  { name: "Cork", number: 351, hex: "#BC9B5D" },
  { name: "Burlap", number: 352, hex: "#C7AC78" },
  { name: "Beige", number: 353, hex: "#CABFA3" },
  { name: "Oyster", number: 354, hex: "#BBB3B2" },
  { name: "Pine Cone", number: 355, hex: "#6C584B" },
  { name: "Fawn brown", number: 356, hex: "#A0844F" },
  { name: "Hurricane grey", number: 357, hex: "#958988" },
  { name: "Cloudy grey", number: 358, hex: "#ABA89E" },
  { name: "Linen", number: 359, hex: "#AF9483" },
  { name: "Copper", number: 360, hex: "#966766" },
  { name: "Dirt brown", number: 361, hex: "#564236" },
  { name: "Bronze", number: 362, hex: "#7E683F" },
  { name: "Flint", number: 363, hex: "#69665C" },
  { name: "Dark taupe", number: 364, hex: "#5A4C42" },
  { name: "Burnt Sienna", number: 365, hex: "#6A3909" },
  { name: "Institutional white", number: 1001, hex: "#F8F8F8" },
  { name: "Mid gray", number: 1002, hex: "#CDCDCD" },
  { name: "Really black", number: 1003, hex: "#111111" },
  { name: "Really red", number: 1004, hex: "#FF0000" },
  { name: "Deep orange", number: 1005, hex: "#FFB000" },
  { name: "Alder", number: 1006, hex: "#B480FF" },
  { name: "Dusty Rose", number: 1007, hex: "#A34B4B" },
  { name: "Olive", number: 1008, hex: "#C1BE42" },
  { name: "New Yeller", number: 1009, hex: "#FFFF00" },
  { name: "Really blue", number: 1010, hex: "#0000FF" },
  { name: "Navy blue", number: 1011, hex: "#002060" },
  { name: "Deep blue", number: 1012, hex: "#2154B9" },
  { name: "Cyan", number: 1013, hex: "#04AFEC" },
  { name: "CGA brown", number: 1014, hex: "#AA5500" },
  { name: "Magenta", number: 1015, hex: "#AA00AA" },
  { name: "Pink", number: 1016, hex: "#FF66CC" },
  { name: "Deep orange", number: 1017, hex: "#FFAF00" },
  { name: "Teal", number: 1018, hex: "#12EED4" },
  { name: "Toothpaste", number: 1019, hex: "#00FFFF" },
  { name: "Lime green", number: 1020, hex: "#00FF00" },
  { name: "Camo", number: 1021, hex: "#3A7D15" },
  { name: "Grime", number: 1022, hex: "#7F8E64" },
  { name: "Lavender", number: 1023, hex: "#8C5B9F" },
  { name: "Pastel light blue", number: 1024, hex: "#AFDDFF" },
  { name: "Pastel orange", number: 1025, hex: "#FFC9C9" },
  { name: "Pastel violet", number: 1026, hex: "#B1A7FF" },
  { name: "Pastel blue-green", number: 1027, hex: "#9FF3E9" },
  { name: "Pastel green", number: 1028, hex: "#CCFFCC" },
  { name: "Pastel yellow", number: 1029, hex: "#FFFFCC" },
  { name: "Pastel brown", number: 1030, hex: "#FFCC99" },
  { name: "Royal purple", number: 1031, hex: "#6225D1" },
  { name: "Hot pink", number: 1032, hex: "#FF00BF" },
];




function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function getCountryByName(name: string) {
  return (
    COUNTRY_THEMES.find(
      (theme) => normalizeText(theme.name) === normalizeText(name),
    ) || null
  );
}

function getFlagUrl(code: string) {
  return `https://flagcdn.com/w160/${code}.png`;
}

function getTeamGroup(teamCountry: string, teams: Team[]) {
  const team = teams.find(
    (item) => normalizeText(item.country) === normalizeText(teamCountry),
  );
  return team?.group_letter ?? null;
}

function getGroupBadgeClass(group: GroupLetter) {
  if (group === "A") return "border-sky-400/20 bg-sky-400/10 text-sky-300";
  if (group === "B")
    return "border-indigo-400/20 bg-indigo-400/10 text-indigo-300";
  if (group === "C")
    return "border-rose-400/20 bg-rose-400/10 text-rose-300";
  return "border-fuchsia-400/20 bg-fuchsia-400/10 text-fuchsia-300";
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

function getStatusBadgeClass(status: MatchStatus) {
  if (status === "Live") return "border-red-400/20 bg-red-400/10 text-red-300";
  if (status === "Finished") return "border-white/15 bg-white/10 text-white";
  return "border-orange-400/20 bg-orange-400/10 text-amber-300";
}

function scrollToSection(id: string) {
  const element = document.getElementById(id);
  if (!element) return;

  element.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });

  setTimeout(() => {
    const headerOffset = 96;
    window.scrollBy({
      top: -headerOffset,
      behavior: "smooth",
    });
  }, 50);
}

function getPlayerRoleOrder(role: TeamPlayerRole) {
  if (role === "Vice Captain" || role === "Court Captain") return 0;
  return 1;
}

function sortTeamPlayers(players: TeamPlayer[]) {
  return [...players].sort((a, b) => {
    const roleDiff = getPlayerRoleOrder(a.role) - getPlayerRoleOrder(b.role);
    if (roleDiff !== 0) return roleDiff;

    return a.roblox_username.localeCompare(b.roblox_username);
  });
}

function getRosterRoleBadgeClass(role: TeamPlayerRole) {
  if (role === "Vice Captain") {
    return "border-sky-400/20 bg-sky-400/10 text-sky-300";
  }

  if (role === "Court Captain") {
    return "border-violet-400/20 bg-violet-400/10 text-violet-300";
  }

  return "border-white/10 bg-white/5 text-white/75";
}

function Avatar({
  robloxUserId,
  name,
}: {
  robloxUserId: string;
  name: string;
}) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadAvatar() {
      if (!/^\d+$/.test(robloxUserId.trim())) {
        setAvatarUrl(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        const response = await fetch(
          `/api/roblox-avatar?userId=${encodeURIComponent(robloxUserId.trim())}`,
          { cache: "no-store" },
        );

        const data = await response.json();

        if (!cancelled) {
          setAvatarUrl(data?.imageUrl ?? null);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setAvatarUrl(null);
          setLoading(false);
        }
      }
    }

    loadAvatar();

    return () => {
      cancelled = true;
    };
  }, [robloxUserId]);

  if (loading) {
    return (
      <div className="h-10 w-10 animate-pulse rounded-full border border-white/10 bg-white/5" />
    );
  }

  if (!avatarUrl) {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xs font-bold text-white/70">
        {name.slice(0, 2).toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={avatarUrl}
      alt={`${name} Roblox avatar`}
      className="h-10 w-10 rounded-full border border-white/10 object-cover"
      onError={() => setAvatarUrl(null)}
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  );
}

function getBrickColorByNumber(number: string) {
  return BRICK_COLORS.find((color) => String(color.number) === number) || null;
}

function SelectPicker({
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const selected = options.find((option) => option.value === value) || null;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen((prev) => !prev);
        }}
        className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-white transition duration-200 hover:-translate-y-0.5 hover:border-orange-400/30 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-orange-400/40 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:border-white/10 disabled:hover:bg-white/5"
      >
        <span className="flex min-w-0 items-center gap-3">
          {selected?.imageUrl ? (
            <img
              src={selected.imageUrl}
              alt={`${selected.label} icon`}
              className="h-5 w-7 rounded-sm object-cover"
            />
          ) : null}

          {selected?.badgeClassName ? (
            <span
              className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${selected.badgeClassName}`}
            >
              {selected.label}
            </span>
          ) : (
            <span
              className={`truncate ${selected ? "text-white" : "text-white/45"}`}
            >
              {selected ? selected.label : placeholder}
            </span>
          )}
        </span>

        <ChevronDown
          className={`h-4 w-4 shrink-0 text-white/60 transition duration-200 ${open ? "rotate-180" : "rotate-0"}`}
        />
      </button>

      {open && !disabled ? (
        <div className="absolute z-40 mt-2 max-h-72 w-full overflow-y-auto rounded-2xl border border-white/10 bg-[#170F08] p-2 shadow-2xl shadow-black/40">
          {options.length === 0 ? (
            <div className="px-3 py-3 text-sm text-white/50">
              No options available
            </div>
          ) : (
            options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-white transition duration-150 hover:bg-orange-400/10 active:scale-[0.99]"
              >
                {option.imageUrl ? (
                  <img
                    src={option.imageUrl}
                    alt={`${option.label} icon`}
                    className="h-5 w-7 rounded-sm object-cover"
                  />
                ) : null}

                {option.badgeClassName ? (
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${option.badgeClassName}`}
                  >
                    {option.label}
                  </span>
                ) : (
                  <span>{option.label}</span>
                )}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

function AnimatedNavButton({
  label,
  targetId,
}: {
  label: string;
  targetId: string;
}) {
  return (
    <NavScrollLink
      label={label}
      targetId={targetId}
      className="rounded-xl px-2 py-1 text-sm text-white/80 transition duration-200 hover:-translate-y-0.5 hover:bg-white/5 hover:text-white active:translate-y-0.5"
    />
  );
}

function TeamCard({
  team,
  players,
  expanded,
  onToggle,
}: {
  team: Team;
  players: TeamPlayer[];
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="relative rounded-[1.75rem] border border-white/10 bg-white/5 p-5 transition duration-200 hover:-translate-y-1 hover:bg-white/[0.07]">
      {team.brick_color_name && team.brick_color_hex ? (
        <div className="absolute right-5 top-5 flex items-center gap-2 rounded-full border border-white/10 bg-[#170F08] px-3 py-1.5 text-xs font-semibold text-white/85">
          <span
            className="h-3 w-3 rounded-full border border-white/20"
            style={{ backgroundColor: team.brick_color_hex }}
          />
          <span>{team.brick_color_number}</span>
        </div>
      ) : null}
      <button
        type="button"
        onClick={onToggle}
        className="w-full rounded-[1rem] text-left focus:outline-none focus:ring-2 focus:ring-orange-400/40"
        aria-expanded={expanded}
        aria-label={
          expanded
            ? `Hide roster for ${team.country}`
            : `View roster for ${team.country}`
        }
      >
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-[#241708]">
            <img
              src={getFlagUrl(team.code)}
              alt={`${team.country} flag`}
              className="h-full w-full object-cover"
            />
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="truncate text-lg font-bold">{team.country}</h3>
            {team.captain_name?.trim() &&
            team.captain_discord?.trim() &&
            String(team.captain_roblox_id || "").trim() ? (
              <div className="flex items-center gap-3 text-sm text-white/70">
                <Avatar
                  robloxUserId={team.captain_roblox_id}
                  name={team.captain_name}
                />
                <div className="min-w-0">
                  <p className="truncate">Captain {team.captain_name}</p>
                  <p className="truncate text-white/55">
                    @{team.captain_discord}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-sm text-red-300">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-red-400/20 bg-red-400/10 text-xs font-bold">
                  ?
                </div>
                <div>
                  <p className="font-semibold">No captain assigned</p>
                  <p className="text-xs text-red-200/70">
                    This team needs a captain
                  </p>
                </div>
              </div>
            )}
            <p className="mt-3 text-xs uppercase tracking-[0.18em] text-amber-300">
              {expanded ? "Hide roster" : "View roster"} • {players.length + 1}{" "}
              members
            </p>
          </div>
        </div>
      </button>

      {expanded ? (
        <div className="mt-5 rounded-2xl border border-white/10 bg-[#170F08] p-4">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-amber-300">
            Team Roster
          </p>

          {team.brick_color_name && team.brick_color_hex ? (
            <div className="mb-4 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80">
              <span
                className="h-4 w-4 rounded-full border border-white/20"
                style={{ backgroundColor: team.brick_color_hex }}
              />
              <span className="font-medium">Brick Color:</span>
              <span>{team.brick_color_name}</span>
              {team.brick_color_number ? (
                <span className="text-white/50">
                  #{team.brick_color_number}
                </span>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-3">
            {team.captain_name?.trim() &&
            team.captain_discord?.trim() &&
            String(team.captain_roblox_id || "").trim() ? (
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                <Avatar
                  robloxUserId={team.captain_roblox_id}
                  name={team.captain_name}
                />
                <div className="min-w-0">
                  <p className="font-semibold text-white">
                    {team.captain_name}
                  </p>
                  <p className="text-sm text-white/60">
                    @{team.captain_discord}
                  </p>
                </div>
                <span className="ml-auto rounded-full border border-orange-400/20 bg-orange-400/10 px-3 py-1 text-xs font-semibold text-amber-300">
                  Captain
                </span>
              </div>
            ) : (
              <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-300">
                No captain assigned.
              </div>
            )}

            {players.length === 0 ? (
              <p className="text-sm text-white/55">
                No extra players added yet.
              </p>
            ) : (
              players.map((player) => (
                <div
                  key={player.id}
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3"
                >
                  <Avatar
                    robloxUserId={player.roblox_user_id}
                    name={player.roblox_username}
                  />
                  <div className="min-w-0">
                    <p className="font-semibold text-white">
                      {player.roblox_username}
                    </p>
                    <p className="text-sm text-white/60">
                      @{player.discord_username}
                    </p>
                  </div>
                  <span
                    className={`ml-auto rounded-full border px-3 py-1 text-xs font-semibold ${getRosterRoleBadgeClass(player.role)}`}
                  >
                    {player.role}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ScheduleCard({
  match,
  getStaffById,
}: {
  match: MatchRow;
  getStaffById: (staffId: number | null) => StaffApplication | null;
}) {
  const homeCountry = getCountryByName(match.home_country);
  const awayCountry = getCountryByName(match.away_country);
  const referee = getStaffById(match.referee_id);
  const media = getStaffById(match.media_id);
  const resultStyles = getMatchResultStyles(match);

  return (
    <div
      className={`relative overflow-hidden rounded-[1.5rem] border p-5 md:hidden ${
        match.is_star_match
          ? "border-yellow-400/40 bg-gradient-to-br from-yellow-400/15 via-[#1C120A] to-[#1C120A] shadow-[0_0_28px_rgba(250,204,21,0.12)]"
          : "border-white/10 bg-[#1C120A]"
      }`}
    >
      {match.is_star_match ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-yellow-400" />
      ) : null}
      {match.is_star_match ? (
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-yellow-400/30 bg-yellow-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-yellow-300">
          <Star className="h-3.5 w-3.5 fill-yellow-300" />
          Star Match
        </div>
      ) : null}

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold">
            {homeCountry ? (
              <img
                src={getFlagUrl(homeCountry.code)}
                alt={`${match.home_country} flag`}
                className="h-5 w-7 rounded-sm object-cover"
              />
            ) : null}
            <span
              className={`truncate ${match.status === "Finished" ? resultStyles.homeClass : "text-white"}`}
            >
              {match.home_country}
            </span>
          </div>
          <p className="my-2 text-xs uppercase tracking-[0.2em] text-white/40">
            vs
          </p>
          <div className="flex items-center gap-2 text-sm font-semibold">
            {awayCountry ? (
              <img
                src={getFlagUrl(awayCountry.code)}
                alt={`${match.away_country} flag`}
                className="h-5 w-7 rounded-sm object-cover"
              />
            ) : null}
            <span
              className={`truncate ${match.status === "Finished" ? resultStyles.awayClass : "text-white"}`}
            >
              {match.away_country}
            </span>
          </div>
        </div>

        <span
          className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${getStatusBadgeClass(match.status)}`}
        >
          {match.status}
        </span>
      </div>
      {match.stage ? (
        <div className="mt-4">
          <span className="inline-flex rounded-full border border-orange-400/20 bg-orange-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-300">
            {match.stage}
          </span>
        </div>
      ) : null}
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-white/75">
        <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
          <p className="text-xs uppercase tracking-[0.18em] text-white/45">
            Date
          </p>
          <p className="mt-1 font-medium">{formatDate(match.match_date)}</p>
        </div>
        <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
          <p className="text-xs uppercase tracking-[0.18em] text-white/45">
            Time
          </p>
          <p className="mt-1 font-medium">{match.match_time} BRT</p>
        </div>
      </div>

      {match.status === "Finished" ? (
        <div className="mt-4 rounded-xl border border-white/8 bg-white/[0.03] p-3 text-sm text-white/75">
          Final score:{" "}
          <span className="font-semibold text-white">
            {match.home_score}-{match.away_score}
          </span>
          {match.stats_finalized ? (
            <div className="mt-2">
              <Link
                href={`/stats?match=${match.id}`}
                className="inline-flex items-center gap-1 rounded-full border border-orange-400/20 bg-orange-400/10 px-2.5 py-1 text-[11px] font-semibold text-amber-300 transition hover:bg-orange-400/15"
              >
                View Match Stats
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}
      {referee || media ? (
        <div className="mt-4 rounded-xl border border-white/8 bg-white/[0.03] p-3">
          <p className="text-xs uppercase tracking-[0.18em] text-white/45">
            Match Staff
          </p>

          <div className="mt-3 space-y-3">
            {referee ? (
              <div className="flex items-center gap-3">
                <Avatar
                  robloxUserId={referee.roblox_user_id}
                  name={referee.roblox_username}
                />
                <div>
                  <p className="text-sm font-semibold text-white">
                    Referee: {referee.roblox_username}
                  </p>
                  <p className="text-xs text-white/60">
                    @{referee.discord_username}
                  </p>
                </div>
              </div>
            ) : null}

            {media ? (
              <div className="flex items-center gap-3">
                <Avatar
                  robloxUserId={media.roblox_user_id}
                  name={media.roblox_username}
                />
                <div>
                  <p className="text-sm font-semibold text-white">
                    Media: {media.roblox_username}
                  </p>
                  <p className="text-xs text-white/60">
                    @{media.discord_username}
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function NavScrollLink({
  label,
  targetId,
  className = "",
}: {
  label: string;
  targetId: string;
  className?: string;
}) {
  return (
    <a
      href={`#${targetId}`}
      onClick={(e) => {
        e.preventDefault();
        scrollToSection(targetId);
      }}
      className={className}
    >
      {label}
    </a>
  );
}

function getMatchResultStyles(match: MatchRow) {
  const homeWon = match.home_score > match.away_score;
  const awayWon = match.away_score > match.home_score;

  return {
    homeClass: homeWon
      ? "font-bold text-amber-300"
      : awayWon
        ? "font-semibold text-red-300"
        : "font-semibold text-white",
    awayClass: awayWon
      ? "font-bold text-amber-300"
      : homeWon
        ? "font-semibold text-red-300"
        : "font-semibold text-white",
  };
}

function StandingsCard({ team }: { team: StandingRow }) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-[#1C120A] p-5 md:hidden">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-orange-400/20 bg-orange-400/10 text-sm font-bold text-amber-300">
            {team.position}
          </div>
          <div className="flex items-center gap-3">
            <img
              src={getFlagUrl(team.code)}
              alt={`${team.country} flag`}
              className="h-5 w-7 rounded-sm object-cover"
            />
            <span className="font-semibold text-white">{team.country}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-white/70">
          <Trophy className="h-3.5 w-3.5" />
          {team.points} pts
        </div>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-3 text-sm text-white/75">
        <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3 text-center">
          <p className="text-xs uppercase tracking-[0.18em] text-white/45">
            W-L
          </p>
          <p className="mt-1 font-semibold text-white">
            {team.wins}-{team.losses}
          </p>
        </div>
        <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3 text-center">
          <p className="text-xs uppercase tracking-[0.18em] text-white/45">
            Sets
          </p>
          <p className="mt-1 font-semibold text-white">
            {team.setsWon}-{team.setsLost}
          </p>
        </div>
        <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3 text-center">
          <p className="text-xs uppercase tracking-[0.18em] text-white/45">
            SD
          </p>
          <p className="mt-1 font-semibold text-white">
            {team.setDiff > 0 ? `+${team.setDiff}` : team.setDiff}
          </p>
        </div>
        <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3 text-center">
          <p className="text-xs uppercase tracking-[0.18em] text-white/45">
            PD
          </p>
          <p className="mt-1 font-semibold text-white">
            {team.ptsDiff > 0 ? `+${team.ptsDiff}` : team.ptsDiff}
          </p>
        </div>
      </div>
    </div>
  );
}

function getStaffRoleLabel(role: StaffRole) {
  return role;
}

function cleanDiscordUsername(value: string) {
  return value.trim().replace(/^@/, "");
}

function isNumericId(value: string) {
  return /^\d+$/.test(value.trim());
}

function toNullableNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isNaN(value) ? null : value;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const parsed = Number(trimmed);
  return Number.isNaN(parsed) ? null : parsed;
}

function getMatchSets(source: {
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
}) {
  return [
    { home: source.set1_home ?? null, away: source.set1_away ?? null },
    { home: source.set2_home ?? null, away: source.set2_away ?? null },
    { home: source.set3_home ?? null, away: source.set3_away ?? null },
    { home: source.set4_home ?? null, away: source.set4_away ?? null },
    { home: source.set5_home ?? null, away: source.set5_away ?? null },
  ];
}

function calculateSetWins(source: {
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
}) {
  const sets = getMatchSets(source);

  let homeScore = 0;
  let awayScore = 0;

  for (const set of sets) {
    if (set.home === null || set.away === null) continue;
    if (set.home === set.away) continue;

    if (set.home > set.away) {
      homeScore += 1;
    } else {
      awayScore += 1;
    }
  }

  return { homeScore, awayScore };
}

function calculatePointsTotals(source: {
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
}) {
  const sets = getMatchSets(source);

  let homePoints = 0;
  let awayPoints = 0;

  for (const set of sets) {
    if (set.home === null || set.away === null) continue;

    homePoints += set.home;
    awayPoints += set.away;
  }

  return {
    homePoints,
    awayPoints,
    pointsDiff: homePoints - awayPoints,
  };
}

function getWinnerCountryFromSets(
  source: {
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
  },
  homeCountry: string,
  awayCountry: string,
  status: MatchStatus,
) {
  if (status !== "Finished") return null;

  const { homeScore, awayScore } = calculateSetWins(source);

  if (homeScore > awayScore) return homeCountry;
  if (awayScore > homeScore) return awayCountry;
  return null;
}

function getWinnerCountryFromScore(
  homeScore: number,
  awayScore: number,
  homeCountry: string,
  awayCountry: string,
  status: MatchStatus,
) {
  if (status !== "Finished") return null;
  if (homeScore > awayScore) return homeCountry;
  if (awayScore > homeScore) return awayCountry;
  return null;
}

function formatSetScores(source: {
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
}) {
  const sets = getMatchSets(source);

  return sets
    .filter((set) => set.home !== null && set.away !== null)
    .map((set) => `${set.home}-${set.away}`)
    .join(", ");
}

function isPlayoffsMatch(match: { stage?: string | null }) {
  return normalizeText(match.stage ?? "").startsWith("playoffs:");
}

function buildStandings(
  teamsBase: Team[],
  matchesBase: MatchRow[],
): StandingRow[] {
  const validCountries = new Set(teamsBase.map((team) => team.country));
  const map = new Map<string, Omit<StandingRow, "position">>();

  for (const team of teamsBase) {
    map.set(team.country, {
      country: team.country,
      code: team.code,
      played: 0,
      wins: 0,
      losses: 0,
      setsWon: 0,
      setsLost: 0,
      setDiff: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      ptsDiff: 0,
      points: 0,
    });
  }

  for (const match of matchesBase) {
    if (match.status !== "Finished") continue;
    if (!validCountries.has(match.home_country)) continue;
    if (!validCountries.has(match.away_country)) continue;

    const home = map.get(match.home_country);
    const away = map.get(match.away_country);
    if (!home || !away) continue;

    const homeSets = match.home_score;
    const awaySets = match.away_score;
    const { homePoints, awayPoints } = calculatePointsTotals(match);

    home.played += 1;
    away.played += 1;

    home.setsWon += homeSets;
    home.setsLost += awaySets;
    away.setsWon += awaySets;
    away.setsLost += homeSets;

    home.pointsFor += homePoints;
    home.pointsAgainst += awayPoints;
    away.pointsFor += awayPoints;
    away.pointsAgainst += homePoints;

    home.setDiff = home.setsWon - home.setsLost;
    away.setDiff = away.setsWon - away.setsLost;

    home.ptsDiff = home.pointsFor - home.pointsAgainst;
    away.ptsDiff = away.pointsFor - away.pointsAgainst;

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
      if (b.ptsDiff !== a.ptsDiff) return b.ptsDiff - a.ptsDiff;
      if (b.setsWon !== a.setsWon) return b.setsWon - a.setsWon;
      return a.country.localeCompare(b.country);
    })
    .map((team, index) => ({ ...team, position: index + 1 }));
}

type LeaderboardPlayer = {
  player_username: string;
  player_roblox_id?: string | null;
  team: string;
  kills: number;
  receives: number;
  assists: number;
  ape_kills: number;
  aces: number;
  attempts: number;
  ape_attempts: number;
  one_touches: number;
  kill_blocks: number;
  blocks: number;
  matches_played: number;
};

type LeaderboardStatKey =
  | "kills"
  | "receives"
  | "assists"
  | "ape_kills"
  | "aces"
  | "blocks";

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

const APER_FULL_WEIGHT_MATCHES = 3;

function matchReliability(player: LeaderboardPlayer) {
  return Math.min(1, player.matches_played / APER_FULL_WEIGHT_MATCHES);
}

function apeKillRate(player: LeaderboardPlayer) {
  if (!player.ape_attempts) return 0;
  return player.ape_kills / player.ape_attempts;
}

function bestAperScore(player: LeaderboardPlayer) {
  // Rewards high ape-kill average, but reduces the impact of one-match samples.
  return statAverage(player, "ape_kills") * matchReliability(player);
}

const BEST_SETTER_MIN_ASSISTS = 30;

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

function PlayerAvatar({ player }: { player: Pick<LeaderboardPlayer, "player_username" | "player_roblox_id"> }) {
  if (player.player_roblox_id) {
    return <Avatar robloxUserId={player.player_roblox_id} name={player.player_username} />;
  }

  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xs font-bold text-white/70">
      {player.player_username.slice(0, 2).toUpperCase()}
    </div>
  );
}

function LeaderboardTable({
  title,
  accentClass,
  borderClass,
  players,
  statKey,
  statLabel,
  teams,
  description = "Ranked by average per match",
}: {
  title: string;
  accentClass: string;
  borderClass: string;
  players: LeaderboardPlayer[];
  statKey: LeaderboardStatKey;
  statLabel: string;
  teams: Team[];
  description?: string;
}) {
  if (players.length === 0) return null;

  return (
    <div className={`rounded-2xl border ${borderClass} bg-white/[0.03] overflow-hidden shadow-[0_18px_60px_rgba(0,0,0,0.18)]`}>
      <div className={`px-5 py-4 border-b ${borderClass} bg-white/[0.04]`}>
        <p className={`text-sm font-bold uppercase tracking-[0.2em] ${accentClass}`}>
          {title}
        </p>
        <p className="mt-1 text-xs text-white/45">{description}</p>
      </div>
      <div className="divide-y divide-white/5">
        {players.map((player, index) => {
          const team = teams.find(
            (t) => normalizeText(t.country) === normalizeText(player.team),
          );
          const avg = statAverage(player, statKey);
          return (
            <div
              key={player.player_username}
              className="grid grid-cols-[32px_44px_1fr_auto] items-center gap-3 px-5 py-3 transition hover:bg-white/[0.03]"
            >
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full border text-sm font-black ${
                  index === 0
                    ? "border-yellow-300/30 bg-yellow-300/10 text-yellow-300"
                    : index === 1
                      ? "border-white/20 bg-white/10 text-white/70"
                      : index === 2
                        ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                        : "border-white/10 bg-white/5 text-white/40"
                }`}
              >
                {index + 1}
              </span>
              <PlayerAvatar player={player} />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {team ? (
                    <img
                      src={getFlagUrl(team.code)}
                      alt={team.country}
                      className="h-4 w-6 rounded-sm object-cover"
                    />
                  ) : null}
                  <span className="truncate text-sm font-bold text-white">
                    {player.player_username}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-white/45">
                  {player.team} • {player.matches_played} match{player.matches_played !== 1 ? "es" : ""}
                </p>
              </div>
              <div className="text-right">
                <p className={`text-lg font-black ${accentClass}`}>
                  {avg.toFixed(1)}
                </p>
                <p className="text-xs text-white/45">
                  {player[statKey]} total {statLabel}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AwardsPodium({
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
  if (players.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white/50">
        No stats recorded for this category yet.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5">
        <p className="text-xl font-black text-white">{title}</p>
        <p className="mt-1 text-sm text-white/60">{subtitle}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {players.map((player, index) => {
          const team = teams.find(
            (t) => normalizeText(t.country) === normalizeText(player.team),
          );
          const avg = statAverage(player, mainStat);
          return (
            <div
              key={player.player_username}
              className={`rounded-[1.5rem] border p-5 shadow-[0_18px_70px_rgba(0,0,0,0.22)] ${
                index === 0
                  ? "border-yellow-400/30 bg-yellow-400/[0.08]"
                  : index === 1
                    ? "border-white/15 bg-white/[0.06]"
                    : "border-amber-700/30 bg-amber-900/10"
              }`}
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-full border text-sm font-black ${
                    index === 0
                      ? "border-yellow-300/30 bg-yellow-300/10 text-yellow-300"
                      : index === 1
                        ? "border-white/20 bg-white/10 text-white/75"
                        : "border-amber-500/30 bg-amber-500/10 text-amber-400"
                  }`}
                >
                  #{index + 1}
                </span>
                {team ? (
                  <img
                    src={getFlagUrl(team.code)}
                    alt={team.country}
                    className="h-5 w-7 rounded-sm object-cover"
                  />
                ) : null}
              </div>
              <div className="flex items-center gap-3">
                <PlayerAvatar player={player} />
                <div className="min-w-0">
                  <p className="truncate text-lg font-black text-white">
                    {player.player_username}
                  </p>
                  <p className="truncate text-sm text-white/60">{player.team}</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-xl border border-white/10 bg-white/5 p-2 text-center">
                  <p className="text-xs uppercase tracking-wide text-white/45">
                    Avg. {mainStatLabel}
                  </p>
                  <p className="mt-1 font-black text-white">
                    {avg.toFixed(1)}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-2 text-center">
                  <p className="text-xs uppercase tracking-wide text-white/45">
                    Total {mainStatLabel}
                  </p>
                  <p className="mt-1 font-black text-white">{player[mainStat]}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-2 text-center">
                  <p className="text-xs uppercase tracking-wide text-white/45">
                    Receives
                  </p>
                  <p className="mt-1 font-bold text-white">{player.receives}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-2 text-center">
                  <p className="text-xs uppercase tracking-wide text-white/45">
                    Matches
                  </p>
                  <p className="mt-1 font-bold text-white">
                    {player.matches_played}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AwardsMVP({
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
  if (!player) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white/50">
        No stats recorded for this award yet.
      </div>
    );
  }

  const team = teams.find(
    (t) => normalizeText(t.country) === normalizeText(player.team),
  );

  const avg =
    player.matches_played > 0
      ? ((player.kills + player.receives + player.assists + player.ape_kills + player.aces) /
          player.matches_played).toFixed(1)
      : "0.0";

  return (
    <div>
      <div className="mb-5">
        <p className="text-xl font-black text-white">{title}</p>
        <p className="mt-1 text-sm text-white/60">{subtitle}</p>
      </div>
      <div className="mx-auto max-w-sm rounded-[2rem] border border-yellow-400/30 bg-gradient-to-b from-yellow-400/10 to-yellow-400/[0.03] p-8 text-center shadow-[0_24px_90px_rgba(0,0,0,0.35)]">
        <div className="mx-auto mb-4 flex justify-center">
          <PlayerAvatar player={player} />
        </div>
        {team ? (
          <img
            src={getFlagUrl(team.code)}
            alt={team.country}
            className="mx-auto mb-3 h-8 w-11 rounded-md object-cover"
          />
        ) : null}
        <p className="text-2xl font-black text-white">{player.player_username}</p>
        <p className="mt-1 text-sm text-white/60">{player.team}</p>

        <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-center">
            <p className="text-xs uppercase tracking-wide text-white/45">Kills</p>
            <p className="mt-1 text-xl font-black text-white">{player.kills}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-center">
            <p className="text-xs uppercase tracking-wide text-white/45">Receives</p>
            <p className="mt-1 text-xl font-black text-white">{player.receives}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-center">
            <p className="text-xs uppercase tracking-wide text-white/45">Assists</p>
            <p className="mt-1 text-xl font-black text-white">{player.assists}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-center">
            <p className="text-xs uppercase tracking-wide text-white/45">Aces</p>
            <p className="mt-1 text-xl font-black text-white">{player.aces}</p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-3">
          <p className="text-xs uppercase tracking-wide text-yellow-300/70">
            Avg. full impact / match
          </p>
          <p className="mt-1 text-2xl font-black text-yellow-300">{avg}</p>
        </div>

        <p className="mt-3 text-xs text-white/40">
          {player.matches_played} match{player.matches_played !== 1 ? "es" : ""} played
        </p>
      </div>
    </div>
  );
}

function TeamOfSeason({
  players,
}: {
  players: LeaderboardPlayer[];
}) {
  return (
    <div>
      <div className="mb-5">
        <p className="text-xl font-black text-white">Team of the Season</p>
        <p className="mt-1 text-sm text-white/60">
          The six selected best players of the season.
        </p>
      </div>

      {players.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white/50">
          No selected players found yet.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {players.map((player, index) => (
            <div
              key={player.player_username}
              className="rounded-[1.5rem] border border-yellow-400/15 bg-gradient-to-br from-yellow-400/[0.08] to-white/[0.03] p-5 shadow-[0_18px_70px_rgba(0,0,0,0.22)]"
            >
              <div className="mb-4 flex items-center justify-between">
                <span className="rounded-full border border-yellow-400/25 bg-yellow-400/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-yellow-300">
                  Starter #{index + 1}
                </span>
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-white/35">
                  Season I
                </span>
              </div>
              <div className="flex items-center gap-3">
                <PlayerAvatar player={player} />
                <div className="min-w-0">
                  <p className="truncate text-lg font-black text-white">
                    {player.player_username}
                  </p>
                  <p className="truncate text-sm text-white/55">{player.team}</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-xl border border-white/10 bg-white/5 p-2 text-center">
                  <p className="text-xs uppercase tracking-wide text-white/45">Kills</p>
                  <p className="mt-1 font-black text-red-300">{player.kills}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-2 text-center">
                  <p className="text-xs uppercase tracking-wide text-white/45">Receives</p>
                  <p className="mt-1 font-black text-blue-300">{player.receives}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-2 text-center">
                  <p className="text-xs uppercase tracking-wide text-white/45">Assists</p>
                  <p className="mt-1 font-black text-amber-300">{player.assists}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-2 text-center">
                  <p className="text-xs uppercase tracking-wide text-white/45">Aces</p>
                  <p className="mt-1 font-black text-purple-300">{player.aces}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CVRSASitePage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [activeSeason, setActiveSeason] = useState<Season | null>(null);
  const [activeSeasonId, setActiveSeasonId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [adminNotice, setAdminNotice] = useState("");
  const [filterStatus, setFilterStatus] = useState<"All" | MatchStatus>("All");
  const [filterStage, setFilterStage] = useState("All");
  const [adminLogged, setAdminLogged] = useState(false);
  const [matchDrafts, setMatchDrafts] = useState<Record<number, MatchDraft>>(
    {},
  );
  const [submittingTeam, setSubmittingTeam] = useState(false);
  const [teamPlayers, setTeamPlayers] = useState<TeamPlayer[]>([]);
  // Start Match modal state
  const [startMatchModal, setStartMatchModal] = useState<{ matchId: number; home: string; away: string } | null>(null);
  const [startMatchLink, setStartMatchLink]   = useState("");
  const [startStreamLink, setStartStreamLink] = useState("");
  const [startStreamer, setStartStreamer]     = useState("");
  const [startMatchLoading, setStartMatchLoading] = useState(false);
  // Referee ratings
  const [refereeRatings, setRefereeRatings] = useState<any[]>([]);
  const [teamTransactions, setTeamTransactions] = useState<TeamTransaction[]>([]);
  const [teamRoleDrafts, setTeamRoleDrafts] = useState<Record<number, string>>({});
  const [teamSyncBusy, setTeamSyncBusy] = useState(false);
  const [selectedAdminTeamId, setSelectedAdminTeamId] = useState<number | null>(
    null,
  );
  const [expandedTeamId, setExpandedTeamId] = useState<number | null>(null);
  const [registrationsOpen, setRegistrationsOpen] = useState(true);
  const [togglingRegistrations, setTogglingRegistrations] = useState(false);
  const [filterTeam, setFilterTeam] = useState("All");
  const [filterGroup, setFilterGroup] = useState("All");
  const [statTrackerLogged, setStatTrackerLogged] = useState(false);
  const [refereeLogged, setRefereeLogged] = useState(false);

  // Discord-based access (Owner / servidor Administrator / site_user_roles).
  // Soma-se ao login por e-mail/senha acima — nunca o substitui.
  const [siteAccess, setSiteAccess] = useState<SiteAccess | null>(null);
  const [siteUsers, setSiteUsers] = useState<SiteUser[] | null>(null);
  const [siteUsersBusyId, setSiteUsersBusyId] = useState<string | null>(null);

  // Leaderboard
  const [leaderboardPublic, setLeaderboardPublic] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [playerStats, setPlayerStats] = useState<PlayerStat[]>([]);
  const [playerStatsLoading, setPlayerStatsLoading] = useState(false);
  const [leaderboardPublicLoading, setLeaderboardPublicLoading] = useState(false);
  const [leaderboardFilterTeam, setLeaderboardFilterTeam] = useState("All");
  const [leaderboardFilterStage, setLeaderboardFilterStage] = useState("All");

  // Awards
  const [awardsPublic, setAwardsPublic] = useState(false);
  const [showAwards, setShowAwards] = useState(false);
  const [awardsTab, setAwardsTab] = useState<
    | "best_spiker"
    | "best_receiver"
    | "best_server"
    | "best_setter"
    | "best_aper"
    | "best_blocker"
    | "season_mvp"
    | "most_improved"
    | "team_of_season"
  >("best_spiker");
  const [awardsPublicLoading, setAwardsPublicLoading] = useState(false);

  type StandingsView = "Qualifiers" | "Playoffs" | GroupLetter;

  const [standingsView, setStandingsView] =
    useState<StandingsView>("Qualifiers");

  const [teamGroupForm, setTeamGroupForm] = useState({
    team_id: "",
    group_letter: "",
  });

  const [playerForm, setPlayerForm] = useState({
    team_id: "",
    roblox_username: "",
    roblox_user_id: "",
    discord_username: "",
    discord_id: "",
    role: "Player" as TeamPlayerRole,
  });

  const [registerForm, setRegisterForm] = useState({
    country: "",
    captain_name: "",
    captain_discord: "",
    captain_discord_id: "",
    captain_roblox_id: "",
    brick_color_name: "",
  });

  const [registerConfirmations, setRegisterConfirmations] = useState({
    captain_commitment: false,
    in_discord_server: false,
  });

  const [successDialog, setSuccessDialog] = useState({
    open: false,
    title: "",
    message: "",
  });

  const [adminTeamForm, setAdminTeamForm] = useState({
    country: "",
    captain_name: "",
    captain_discord: "",
    captain_discord_id: "",
    captain_roblox_id: "",
    brick_color_name: "",
  });

  const [matchForm, setMatchForm] = useState({
    home_country: "",
    away_country: "",
    stage: "",
    match_date: "",
    match_time: "",
    status: "Scheduled" as MatchStatus,
    is_star_match: false,
    stat_tracker_id: "",
    best_of: 3 as 3 | 5,

    set1_home: "",
    set1_away: "",
    set2_home: "",
    set2_away: "",
    set3_home: "",
    set3_away: "",
    set4_home: "",
    set4_away: "",
    set5_home: "",
    set5_away: "",
  });

  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: null | (() => Promise<void> | void);
  }>({
    open: false,
    title: "",
    message: "",
    confirmLabel: "Confirm",
    onConfirm: null,
  });

  const [staffApplications, setStaffApplications] = useState<
    StaffApplication[]
  >([]);

  const [adminFilterStatus, setAdminFilterStatus] = useState<
    "All" | MatchStatus
  >("All");
  const [adminFilterStage, setAdminFilterStage] = useState("All");

  const [submittingStaffApplication, setSubmittingStaffApplication] =
    useState(false);

  const [staffRegisterForm, setStaffRegisterForm] = useState({
    role: "" as "" | StaffRole,
    roblox_username: "",
    discord_username: "",
    roblox_user_id: "",
  });

  const [staffConfirmations, setStaffConfirmations] = useState({
    commitment_confirmed: false,
    rulebook_confirmed: false,
  });

  const [captainForm, setCaptainForm] = useState({
    team_id: "",
    captain_name: "",
    captain_discord: "",
    captain_discord_id: "",
    captain_roblox_id: "",
    old_captain_new_role: "Player" as TeamPlayerRole,
  });

  const [removingCaptain, setRemovingCaptain] = useState(false);
  const [savingCaptainChange, setSavingCaptainChange] = useState(false);

  async function getCurrentUserRole() {
    if (!supabase) return null;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (error) return null;

    return data?.role ?? null;
  }

  // Calls /api/admin/access with the current session token to
  // automatically find out whether this person is Owner / Admin (via
  // Discord) / Stat Tracker / Referee / Media - with no password
  // needed. Stores the result in `siteAccess` (used by the Users tab)
  // and returns it to the caller to decide whether to unlock
  // adminLogged/statTrackerLogged.
  async function loadSiteAccess(token?: string): Promise<SiteAccess | null> {
    try {
      const res = await fetch("/api/admin/access", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = (await res.json()) as SiteAccess;
      setSiteAccess(json);
      return json;
    } catch {
      setSiteAccess(null);
      return null;
    }
  }

  async function loadSiteUsers() {
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;

    const res = await fetch("/api/admin/users", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json().catch(() => ({}));
    setSiteUsers(json.users ?? []);
  }

  async function toggleSiteRole(user: SiteUser, role: "administrator" | "stat_tracker" | "referee" | "media") {
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;

    setSiteUsersBusyId(user.id);
    const has = user.roles.includes(role);
    try {
      await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ profileId: user.id, role, action: has ? "revoke" : "grant" }),
      });
      await loadSiteUsers();
    } finally {
      setSiteUsersBusyId(null);
    }
  }

  async function callTeamSync(action: string, payload: Record<string, any> = {}) {
    if (!supabase) throw new Error("Supabase is not configured.");

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("Login session expired. Log in again before changing Discord-linked teams.");

    const response = await fetch("/api/team-sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action, ...payload }),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result?.error || "Team sync failed.");
    return result;
  }


  async function notifyMatchToDiscord(match: MatchRow, eventType: MatchStatus) {
    if (!supabase || !adminLogged) return;

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      showNotice("Match saved, but Discord notification was skipped because the admin session expired.", true);
      return;
    }

    const response = await fetch("/api/match-notify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ match, eventType }),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      showNotice(`Match saved, but Discord notification failed: ${result?.error || response.statusText}`, true);
    }
  }

  function isStatTrackerRole(role: string | null) {
    if (!role) return false;

    return ["stat_track", "stat tracker", "stat_tracker", "stattracker"].includes(
      normalizeText(role),
    );
  }

  async function reloadTeams(seasonId = activeSeasonId) {
    if (!supabase) return;

    if (!seasonId) {
      setTeams([]);
      return;
    }

    const result = await supabase
      .from("teams")
      .select("*")
      .eq("season_id", seasonId)
      .order("country", { ascending: true });

    if (result.error) {
      setNotice(`Teams error: ${result.error.message}`);
      return;
    }

    setTeams((result.data ?? []) as Team[]);
  }

  function showSuccessDialog(title: string, message: string) {
    setSuccessDialog({
      open: true,
      title,
      message,
    });
  }

  async function handleDiscordLoginFromAdmin() {
    if (!supabase) return;

    const redirectTo = `${window.location.origin}/admin`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "discord",
      options: { redirectTo, scopes: "identify email" },
    });

    if (error) showNotice(error.message, true);
  }

  async function handleAdminLogout() {
    if (!supabase) return;

    await supabase.auth.signOut();

    setAdminLogged(false);
    setStatTrackerLogged(false);
    setRefereeLogged(false);

    const seasonId = await reloadLeagueSettings();
    await reloadTeams(seasonId);
    await reloadMatches(seasonId);
    await reloadTeamPlayers(seasonId);
    await reloadPlayerStats(seasonId);
    await reloadStaffApplications();

    showNotice("Admin locked.", true);
  }

  async function reloadMatches(seasonId = activeSeasonId) {
    if (!supabase) return;

    if (!seasonId) {
      setMatches([]);
      setMatchDrafts({});
      return;
    }

    const result = await supabase
      .from("matches")
      .select("*")
      .eq("season_id", seasonId)
      .order("match_date", { ascending: true })
      .order("match_time", { ascending: true });

    if (!result.error && result.data) {
      const rows = result.data as MatchRow[];
      setMatches(rows);
      setMatchDrafts(
        Object.fromEntries(
          rows.map((match) => [
            match.id,
            {
              status: match.status,
              stage: match.stage ?? "",
              match_date: match.match_date,
              match_time: match.match_time,
              home_score: match.home_score,
              away_score: match.away_score,
              referee_id: match.referee_id ?? null,
              media_id: match.media_id ?? null,
              stat_tracker_id: match.stat_tracker_id,
              is_star_match: Boolean(match.is_star_match),
              best_of: match.best_of === 5 ? 5 : 3,

              set1_home: match.set1_home ?? null,
              set1_away: match.set1_away ?? null,
              set2_home: match.set2_home ?? null,
              set2_away: match.set2_away ?? null,
              set3_home: match.set3_home ?? null,
              set3_away: match.set3_away ?? null,
              set4_home: match.set4_home ?? null,
              set4_away: match.set4_away ?? null,
              set5_home: match.set5_home ?? null,
              set5_away: match.set5_away ?? null,
            },
          ]),
        ),
      );
    }
  }

  useEffect(() => {
    async function loadData() {
      if (!supabase) {
        setLoading(false);
        setNotice("Configure Supabase to enable submissions.");
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        const role = await getCurrentUserRole();
        const access = await loadSiteAccess(session.access_token);

        const isAdminNow = role === "admin" || access?.isAdmin === true;
        const isStatTrackerNow =
          isAdminNow || isStatTrackerRole(role) || access?.isStatTracker === true;
        const isRefereeNow =
          !isAdminNow && (role === "referee" || access?.isReferee === true);

        setAdminLogged(isAdminNow);
        setStatTrackerLogged(!isAdminNow && isStatTrackerNow);
        setRefereeLogged(isRefereeNow);
      } else {
        setAdminLogged(false);
        setStatTrackerLogged(false);
        setRefereeLogged(false);
        setSiteAccess(null);
      }

      const seasonId = await reloadLeagueSettings();

      await Promise.all([
        reloadTeams(seasonId),
        reloadMatches(seasonId),
        reloadTeamPlayers(seasonId),
        reloadStaffApplications(),
        reloadTeamTransactions(),
        reloadPlayerStats(seasonId),
      ]);
      setLoading(false);
    }

    loadData();
  }, []);

  useEffect(() => {
    if (!supabase || !adminLogged) return;

    const interval = window.setInterval(() => {
      reloadTeamTransactions();
    }, 15000);

    return () => window.clearInterval(interval);
  }, [adminLogged]);

  useEffect(() => {
    if (!adminLogged) return;
    loadSiteUsers();
  }, [adminLogged]);

  // Hierarchy used to order Users & Roles: Owner first, then the site
  // roles in the same order they're granted in (Administrator > Stat
  // Tracker > Referee > Media), then anyone with no special role.
  // Someone with more than one role is placed under the highest one
  // they hold. Within the same tier, sorted alphabetically.
  function siteUserHierarchyTier(u: SiteUser): number {
    if (u.isOwner) return 0;
    if (u.roles.includes("administrator")) return 1;
    if (u.roles.includes("stat_tracker")) return 2;
    if (u.roles.includes("referee")) return 3;
    if (u.roles.includes("media")) return 4;
    return 5;
  }

  function siteUserDisplayName(u: SiteUser): string {
    return u.discord_global_name || u.discord_username || u.discord_id || "";
  }

  const sortedSiteUsers = useMemo(() => {
    if (!siteUsers) return siteUsers;
    return [...siteUsers].sort((a, b) => {
      const tierDiff = siteUserHierarchyTier(a) - siteUserHierarchyTier(b);
      if (tierDiff !== 0) return tierDiff;
      return siteUserDisplayName(a).localeCompare(siteUserDisplayName(b), "en", { sensitivity: "base" });
    });
  }, [siteUsers]);

  const availableCountries = useMemo(() => {
    const used = new Set(teams.map((team) => normalizeText(team.country)));
    return ACTIVE_TEAM_THEMES.filter(
      (theme) => !used.has(normalizeText(theme.name)),
    );
  }, [teams]);

  const approvedTeams = useMemo(() => {
    return teams.filter((team) => team.approved);
  }, [teams]);

  const pendingTeams = useMemo(() => {
    return teams.filter((team) => !team.approved);
  }, [teams]);

  const statusOptions = useMemo<SelectOption[]>(() => {
    return [
      {
        label: "Scheduled",
        value: "Scheduled",
        badgeClassName: getStatusBadgeClass("Scheduled"),
      },
      {
        label: "Live",
        value: "Live",
        badgeClassName: getStatusBadgeClass("Live"),
      },
      {
        label: "Finished",
        value: "Finished",
        badgeClassName: getStatusBadgeClass("Finished"),
      },
    ];
  }, []);

  const countryOptions = useMemo<SelectOption[]>(() => {
    return availableCountries.map((country) => ({
      label: country.name,
      value: country.name,
      imageUrl: getFlagUrl(country.code),
    }));
  }, [availableCountries]);

  const registeredCountryOptions = useMemo<SelectOption[]>(() => {
    return approvedTeams.map((team) => ({
      label: team.country,
      value: team.country,
      imageUrl: getFlagUrl(team.code),
    }));
  }, [approvedTeams]);

  const groupOptions: SelectOption[] = [
    { label: "Group A", value: "A" },
    { label: "Group B", value: "B" },
    { label: "Group C", value: "C" },
    { label: "Group D", value: "D" },
  ];

  const teamFilterOptions = useMemo<SelectOption[]>(() => {
    return approvedTeams.map((team) => ({
      label: team.country,
      value: team.country,
      imageUrl: getFlagUrl(team.code),
    }));
  }, [approvedTeams]);

  const groupedTeams = useMemo(() => {
    return {
      A: approvedTeams.filter((team) => team.group_letter === "A"),
      B: approvedTeams.filter((team) => team.group_letter === "B"),
      C: approvedTeams.filter((team) => team.group_letter === "C"),
      D: approvedTeams.filter((team) => team.group_letter === "D"),
    };
  }, [approvedTeams]);

  const availableStages = useMemo(() => {
    const stages = Array.from(
      new Set(
        matches
          .map((match) => match.stage?.trim())
          .filter((stage): stage is string => Boolean(stage)),
      ),
    );

    return stages.sort((a, b) => a.localeCompare(b));
  }, [matches]);

  const filteredMatches = useMemo(() => {
    return matches.filter((match) => {
      const statusOk = filterStatus === "All" || match.status === filterStatus;
      const stageOk =
        filterStage === "All" || (match.stage?.trim() ?? "") === filterStage;

      const teamOk =
        filterTeam === "All" ||
        normalizeText(match.home_country) === normalizeText(filterTeam) ||
        normalizeText(match.away_country) === normalizeText(filterTeam);

      const homeGroup = getTeamGroup(match.home_country, teams);
      const awayGroup = getTeamGroup(match.away_country, teams);

      const groupOk =
        filterGroup === "All" ||
        homeGroup === filterGroup ||
        awayGroup === filterGroup;

      return statusOk && stageOk && teamOk && groupOk;
    });
  }, [filterStatus, filterStage, filterTeam, filterGroup, matches, teams]);

  const adminFilteredMatches = useMemo(() => {
    return matches
      .filter((match) => {
        const statusOk =
          adminFilterStatus === "All" || match.status === adminFilterStatus;

        const stageOk =
          adminFilterStage === "All" ||
          (match.stage?.trim() ?? "") === adminFilterStage;

        return statusOk && stageOk;
      })
      .sort((a, b) => {
        const dateA = `${a.match_date} ${a.match_time}`;
        const dateB = `${b.match_date} ${b.match_time}`;

        return dateA.localeCompare(dateB);
      });
  }, [matches, adminFilterStatus, adminFilterStage]);

  const qualifierMatches = useMemo(() => {
    return matches.filter((match) => !isPlayoffsMatch(match));
  }, [matches]);

  const playoffMatches = useMemo(() => {
    return matches.filter((match) => isPlayoffsMatch(match));
  }, [matches]);

  const qualifierStandings = useMemo<StandingRow[]>(() => {
    return buildStandings(approvedTeams, qualifierMatches);
  }, [approvedTeams, qualifierMatches]);

  const playoffTeams = useMemo(() => {
    return qualifierStandings
      .slice(0, 8)
      .map((standing) =>
        approvedTeams.find((team) => team.country === standing.country),
      )
      .filter((team): team is Team => Boolean(team));
  }, [approvedTeams, qualifierStandings]);

  const playoffQualifiedCountries = useMemo(() => {
    return new Set(playoffTeams.map((team) => team.country));
  }, [playoffTeams]);

  const playoffStandings = useMemo<StandingRow[]>(() => {
    return buildStandings(playoffTeams, playoffMatches);
  }, [playoffTeams, playoffMatches]);

  const standingsFiltered = useMemo<StandingRow[]>(() => {
    if (standingsView === "Playoffs") {
      return playoffStandings;
    }

    if (standingsView === "Qualifiers") {
      return qualifierStandings;
    }

    const teamsInGroup = approvedTeams.filter(
      (team) => team.group_letter === standingsView,
    );

    return buildStandings(teamsInGroup, qualifierMatches);
  }, [
    standingsView,
    approvedTeams,
    qualifierMatches,
    qualifierStandings,
    playoffStandings,
  ]);

  const playerMetaByKey = useMemo(() => {
    const map = new Map<string, { username: string; robloxId: string | null; team: string }>();

    for (const team of approvedTeams) {
      if (team.captain_name?.trim()) {
        map.set(`captain-${team.id}`, {
          username: team.captain_name,
          robloxId: team.captain_roblox_id ?? null,
          team: team.country,
        });
      }
    }

    for (const player of teamPlayers) {
      const team = approvedTeams.find((item) => item.id === player.team_id);
      if (!team) continue;
      map.set(`player-${player.id}`, {
        username: player.roblox_username,
        robloxId: player.roblox_user_id ?? null,
        team: team.country,
      });
    }

    return map;
  }, [approvedTeams, teamPlayers]);

  const findPlayerMeta = (
    username: string,
    playerKey?: string | null,
    teamCountry?: string | null,
  ) => {
    const normalizedUsername = normalizeText(username);

    if (playerKey) {
      const byKey = playerMetaByKey.get(playerKey);
      const keyMatchesSavedName =
        !normalizedUsername ||
        normalizePlayerSearch(byKey?.username ?? "") === normalizePlayerSearch(username);
      if (byKey && keyMatchesSavedName) return byKey;
    }


    for (const team of approvedTeams) {
      if (normalizeText(team.captain_name ?? "") === normalizedUsername) {
        return {
          username: team.captain_name,
          robloxId: team.captain_roblox_id ?? null,
          team: team.country,
        };
      }
    }

    const rosterPlayer = teamPlayers.find(
      (player) => normalizeText(player.roblox_username) === normalizedUsername,
    );
    if (rosterPlayer) {
      const rosterTeam = approvedTeams.find(
        (team) => team.id === rosterPlayer.team_id,
      );
      return {
        username: rosterPlayer.roblox_username,
        robloxId: rosterPlayer.roblox_user_id ?? null,
        team: rosterTeam?.country ?? teamCountry ?? "Selected",
      };
    }

    return {
      username,
      robloxId: null,
      team: teamCountry ?? "Selected",
    };
  };

  const aggregatePlayerStats = (rows: PlayerStat[]) => {
    const map = new Map<
      string,
      LeaderboardPlayer & { matchIds: Set<number> }
    >();

    for (const s of rows) {
      const savedName = String(s.player_name ?? "").trim();
      const meta = findPlayerMeta(savedName, s.player_key, s.team_country);
      const displayName = savedName || meta.username || "Unknown Player";
      const compactName = normalizePlayerSearch(displayName);
      const numericStatKey = /^\d+$/.test(String(s.player_key ?? "")) ? String(s.player_key) : null;
      const metaMatchesSavedName = normalizePlayerSearch(meta.username ?? "") === compactName;
      const key = compactName || numericStatKey || String(s.player_key ?? "").trim() || `${normalizeText(displayName)}-${normalizeText(s.team_country)}`;
      const totalKills = (s.kills ?? 0) + (s.ape_kills ?? 0);
      const existing = map.get(key);

      if (existing) {
        existing.kills += totalKills;
        existing.receives += (s.receives ?? 0) + (s.dives ?? 0);
        existing.assists += s.assists ?? 0;
        existing.ape_kills += s.ape_kills ?? 0;
        existing.aces += s.aces ?? 0;
        existing.attempts += s.attempts ?? 0;
        existing.ape_attempts += s.ape_attempts ?? 0;
        existing.one_touches += s.one_touches ?? 0;
        existing.kill_blocks += s.kill_blocks ?? 0;
        existing.blocks += (s.one_touches ?? 0) + (s.kill_blocks ?? 0);
        existing.matchIds.add(s.match_id);
        existing.matches_played = existing.matchIds.size;
        if (normalizeText(existing.team) !== normalizeText(s.team_country)) {
          existing.team = s.team_country || existing.team;
        }
      } else {
        map.set(key, {
          player_username: displayName,
          player_roblox_id: metaMatchesSavedName ? meta.robloxId : numericStatKey,
          team: s.team_country || meta.team || "Selected",
          kills: totalKills,
          receives: (s.receives ?? 0) + (s.dives ?? 0),
          assists: s.assists ?? 0,
          ape_kills: s.ape_kills ?? 0,
          aces: s.aces ?? 0,
          attempts: s.attempts ?? 0,
          ape_attempts: s.ape_attempts ?? 0,
          one_touches: s.one_touches ?? 0,
          kill_blocks: s.kill_blocks ?? 0,
          blocks: (s.one_touches ?? 0) + (s.kill_blocks ?? 0),
          matches_played: 1,
          matchIds: new Set([s.match_id]),
        });
      }
    }

    return Array.from(map.values()).map(({ matchIds, ...player }) => player);
  };

  // Leaderboard filtered player stats
  const leaderboardStats = useMemo(() => {
    let filtered = playerStats;

    if (leaderboardFilterTeam !== "All") {
      filtered = filtered.filter(
        (s) => normalizeText(s.team_country) === normalizeText(leaderboardFilterTeam),
      );
    }

    if (leaderboardFilterStage !== "All") {
      const matchIds = new Set(
        matches
          .filter((m) => (m.stage?.trim() ?? "") === leaderboardFilterStage)
          .map((m) => m.id),
      );
      filtered = filtered.filter((s) => matchIds.has(s.match_id));
    }

    return aggregatePlayerStats(filtered);
  }, [playerStats, leaderboardFilterTeam, leaderboardFilterStage, matches, playerMetaByKey, approvedTeams, teamPlayers]);

  // Awards computed data
  const awardsData = useMemo(() => {
    const all = aggregatePlayerStats(playerStats);

    const buildSelectedPlayer = (username: string): LeaderboardPlayer => {
      const statsPlayer = findLeaderboardPlayerByName(all, username);
      if (statsPlayer) return statsPlayer;

      const meta = findPlayerMeta(username);

      return {
        player_username: meta.username || username,
        player_roblox_id: meta.robloxId,
        team: meta.team,
        kills: 0,
        receives: 0,
        assists: 0,
        ape_kills: 0,
        aces: 0,
        attempts: 0,
        ape_attempts: 0,
        one_touches: 0,
        kill_blocks: 0,
        blocks: 0,
        matches_played: 0,
      };
    };

    const bestSpiker = topByAverageWithMatchRequirement(all, "kills");

    const bestReceiver = topByAverageWithMatchRequirement(all, "receives");

    const bestServer = [...all].sort(sortByAverage("aces")).slice(0, 3);

    const bestSetter = [...all]
      .filter(isEligibleBestSetter)
      .sort(compareBestSetter)
      .slice(0, 3);

    if (bestSetter.length >= 2) {
      [bestSetter[0], bestSetter[1]] = [bestSetter[1], bestSetter[0]];
    }

    const bestAper = [...all].sort(compareBestAper).slice(0, 3);

    const bestBlocker = [...all].sort(compareBestBlocker).slice(0, 3);

    const seasonMvp = [buildSelectedPlayer("Fake_MattX")];

    const mostImproved = ["CLypX_9", "ykGznn", "Seitm1"].map(buildSelectedPlayer);

    const teamOfSeason = [
      "Fake_MattX",
      "ykGznn",
      "CLypX_9",
      "Vitin_xd11",
      "yoylenguren",
      "calgues2018",
    ].map(buildSelectedPlayer);

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
  }, [playerStats, playerMetaByKey, approvedTeams, teamPlayers]);

  const approvedStaff = useMemo(() => {
    return staffApplications.filter((staff) => staff.approved);
  }, [staffApplications]);

  const pendingStaff = useMemo(() => {
    return staffApplications.filter((staff) => !staff.approved);
  }, [staffApplications]);

  const approvedReferees = useMemo(() => {
    return approvedStaff.filter((staff) => staff.role === "Referee");
  }, [approvedStaff]);

  const approvedMediaMembers = useMemo(() => {
    return approvedStaff.filter((staff) => staff.role === "Media");
  }, [approvedStaff]);

  const approvedStatTrackers = useMemo(() => {
    return approvedStaff.filter((staff) => staff.role === "Stat Tracker");
  }, [approvedStaff]);

  const statTrackerOptions = useMemo<SelectOption[]>(() => {
    return approvedStatTrackers.map((staff) => ({
      label: `${staff.roblox_username} (@${staff.discord_username})`,
      value: String(staff.id),
    }));
  }, [approvedStatTrackers]);

  const staffRoleOptions: SelectOption[] = [
    { label: "Referee", value: "Referee" },
    { label: "Media", value: "Media" },
    { label: "Stat Tracker", value: "Stat Tracker" },
  ];

  const refereeOptions = useMemo<SelectOption[]>(() => {
    return approvedReferees.map((staff) => ({
      label: `${staff.roblox_username} (@${staff.discord_username})`,
      value: String(staff.id),
    }));
  }, [approvedReferees]);

  const mediaOptions = useMemo<SelectOption[]>(() => {
    return approvedMediaMembers.map((staff) => ({
      label: `${staff.roblox_username} (@${staff.discord_username})`,
      value: String(staff.id),
    }));
  }, [approvedMediaMembers]);

  const usedBrickNumbers = useMemo(() => {
    return new Set(
      teams
        .map((team) => team.brick_color_number)
        .filter(
          (number): number is number => number !== null && number !== undefined,
        ),
    );
  }, [teams]);

  const registerBrickColorOptions = useMemo<SelectOption[]>(() => {
    return BRICK_COLORS.filter(
      (color) => !usedBrickNumbers.has(color.number),
    ).map((color) => ({
      label: `${color.name} (#${color.number})`,
      value: String(color.number),
    }));
  }, [usedBrickNumbers]);

  function getAdminBrickColorOptions(teamId: number): SelectOption[] {
    const currentTeam = teams.find((team) => team.id === teamId);

    return BRICK_COLORS.filter((color) => {
      if (currentTeam?.brick_color_number === color.number) return true;
      return !teams.some(
        (team) =>
          team.id !== teamId && team.brick_color_number === color.number,
      );
    }).map((color) => ({
      label: `${color.name} (#${color.number})`,
      value: String(color.number),
    }));
  }

  function showNotice(text: string, isAdmin = false) {
    if (isAdmin) {
      setAdminNotice(text);
      window.setTimeout(() => setAdminNotice(""), 3500);
      return;
    }

    setNotice(text);
    window.setTimeout(() => setNotice(""), 3500);
  }

  function handleMatchFormChange(event: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target;
    setMatchForm((prev) => ({ ...prev, [name]: value }));
  }

  function updateMatchDraft(matchId: number, patch: Partial<MatchDraft>) {
    setMatchDrafts((prev) => ({
      ...prev,
      [matchId]: {
        ...prev[matchId],
        ...patch,
      },
    }));
  }

  function updateMatchDraftNumber(
    matchId: number,
    field: keyof MatchDraft,
    value: string,
  ) {
    const trimmed = value.trim();

    updateMatchDraft(matchId, {
      [field]: trimmed === "" ? null : Number(trimmed),
    } as Partial<MatchDraft>);
  }

  function getPlayersByTeam(teamId: number) {
    return sortTeamPlayers(
      teamPlayers.filter((player) => player.team_id === teamId),
    );
  }

  function getStaffById(staffId: number | null) {
    if (!staffId) return null;
    return staffApplications.find((staff) => staff.id === staffId) ?? null;
  }

  function openConfirmDialog({
    title,
    message,
    confirmLabel = "Confirm",
    onConfirm,
  }: {
    title: string;
    message: string;
    confirmLabel?: string;
    onConfirm: () => Promise<void> | void;
  }) {
    setConfirmDialog({
      open: true,
      title,
      message,
      confirmLabel,
      onConfirm,
    });
  }

  function canCurrentStatTrackerEditMatch(match: MatchRow) {
    if (match.stats_finalized) return false;
    if (!statTrackerLogged) return false;

    return match.stat_tracker_id !== null;
  }

  const statTrackMatches = useMemo(() => {
    return matches
      .filter((match) => {
        if (!adminLogged) {
          if (!statTrackerLogged) return false;
          if (match.stat_tracker_id === null) return false;
        }

        const statusOk =
          adminFilterStatus === "All" || match.status === adminFilterStatus;

        const stageOk =
          adminFilterStage === "All" ||
          (match.stage?.trim() ?? "") === adminFilterStage;

        return statusOk && stageOk;
      })
      .sort((a, b) => {
        if (a.stats_finalized !== b.stats_finalized) {
          return a.stats_finalized ? -1 : 1;
        }

        if (a.stats_submitted_for_review !== b.stats_submitted_for_review) {
          return a.stats_submitted_for_review ? -1 : 1;
        }

        const dateA = `${a.match_date} ${a.match_time}`;
        const dateB = `${b.match_date} ${b.match_time}`;

        return dateA.localeCompare(dateB);
      });
  }, [
    matches,
    adminLogged,
    statTrackerLogged,
    adminFilterStatus,
    adminFilterStage,
  ]);

  const roleOptions: SelectOption[] = [
    { label: "Vice Captain", value: "Vice Captain" },
    { label: "Court Captain", value: "Court Captain" },
    { label: "Player", value: "Player" },
  ];

  async function handleApproveStaffApplication(staffId: number) {
    if (!supabase || !adminLogged) return;

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      showNotice("Session expired — please log in again.", true);
      return;
    }

    const response = await fetch("/api/staff-approve", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ staffId }),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      showNotice(result?.error || "Failed to approve application.", true);
      return;
    }

    await reloadStaffApplications();
    const note = result.discordNote
      ? `\nNote: ${result.discordNote}`
      : " Discord role applied automatically.";
    showNotice(`Staff application approved.${note}`, true);
  }

  async function handleStartMatch() {
    if (!startMatchModal) return;
    if (!startMatchLink.trim()) {
      showNotice("Match Link is required.", true);
      return;
    }

    const { data: session } = await supabase!.auth.getSession();
    const token = session?.session?.access_token;
    if (!token) { showNotice("Session expired.", true); return; }

    setStartMatchLoading(true);
    try {
      const res = await fetch("/api/match-start", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          matchId:           startMatchModal.matchId,
          matchLink:         startMatchLink.trim(),
          streamLink:        startStreamLink.trim() || undefined,
          streamerDiscordId: startStreamer.trim()   || undefined,
        }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        showNotice(result?.error || "Failed to start match.", true);
      } else {
        await reloadMatches();
        setStartMatchModal(null);
        setStartMatchLink("");
        setStartStreamLink("");
        setStartStreamer("");
        showNotice("Match started! Discord notifications sent.", true);
      }
    } finally {
      setStartMatchLoading(false);
    }
  }

  async function loadRefereeRatings() {
    if (!supabase || !adminLogged) return;
    const { data: session } = await supabase.auth.getSession();
    const token = session?.session?.access_token;
    if (!token) return;
    const res = await fetch("/api/referee-rating", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      setRefereeRatings(data.ratings || []);
    }
  }

  async function handleDeleteStaffApplication(staffId: number) {
    if (!supabase) return;

    const { error } = await supabase
      .from("staff_applications")
      .delete()
      .eq("id", staffId);

    if (error) {
      showNotice(error.message, true);
      return;
    }

    await reloadStaffApplications();
    await reloadMatches();
    showNotice("Staff application removed.", true);
  }

  async function handleApproveTeam(teamId: number) {
    if (!supabase) return;

    const { error } = await supabase
      .from("teams")
      .update({
        approved: true,
        approved_at: new Date().toISOString(),
      })
      .eq("id", teamId);

    if (error) {
      showNotice(error.message, true);
      return;
    }

    await reloadTeams();
    showNotice("Team approved successfully.", true);
  }

  async function submitTeam(
    payload: {
      country: string;
      captain_name: string;
      captain_discord: string;
      captain_discord_id?: string;
      captain_roblox_id: string;
      brick_color_name: string;
    },
    isAdmin = false,
  ) {
    if (!supabase) {
      showNotice("Supabase is not configured yet.", isAdmin);
      return false;
    }

    if (!isAdmin && !registrationsOpen) {
      showNotice("Team registrations are currently closed.", false);
      return false;
    }

    const selectedCountry = getCountryByName(payload.country);
    if (!selectedCountry) {
      showNotice("Select a valid country.", isAdmin);
      return false;
    }

    const selectedBrickColor = getBrickColorByNumber(payload.brick_color_name);

    if (!selectedBrickColor) {
      showNotice("Select a valid Brick Color.", isAdmin);
      return false;
    }

    if (
      teams.some(
        (team) =>
          normalizeText(team.country) === normalizeText(payload.country),
      )
    ) {
      showNotice("This country is already registered.", isAdmin);
      return false;
    }

    const cleanCaptain = payload.captain_name.trim();
    const cleanDiscord = payload.captain_discord.trim().replace(/^@/, "");
    const cleanRobloxReference = payload.captain_roblox_id.trim();

    if (!/^\d+$/.test(cleanRobloxReference)) {
      showNotice("Enter a valid Roblox User ID (numbers only).", isAdmin);
      return false;
    }

    if (!cleanCaptain || !cleanDiscord || !cleanRobloxReference) {
      showNotice("Fill in all fields before submitting.", isAdmin);
      return false;
    }

    if (
      teams.some(
        (team) => team.brick_color_number === selectedBrickColor.number,
      )
    ) {
      showNotice(
        "This Brick Color is already being used by another team.",
        isAdmin,
      );
      return false;
    }

    const { error } = await supabase.from("teams").insert({
      country: selectedCountry.name,
      code: selectedCountry.code,
      captain_name: cleanCaptain,
      captain_discord: cleanDiscord,
      captain_discord_id: payload.captain_discord_id?.trim() || null,
      captain_roblox_id: cleanRobloxReference,
      approved: isAdmin,
      approved_at: isAdmin ? new Date().toISOString() : null,
      season_id: activeSeasonId,

      brick_color_name: selectedBrickColor.name,
      brick_color_hex: selectedBrickColor.hex,
      brick_color_number: selectedBrickColor.number,
    });

    if (error) {
      showNotice(error.message, isAdmin);
      return false;
    }

    await reloadTeams();

    if (isAdmin) {
      showNotice(`${selectedCountry.name} registered successfully.`, true);
    } else {
      showSuccessDialog(
        "Registration Submitted",
        `${selectedCountry.name} has been submitted successfully and is now awaiting admin approval.`,
      );
    }

    return true;
  }

  async function handleStaffRegisterSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!supabase) {
      showNotice("Supabase is not configured yet.");
      return;
    }

    const cleanRole = staffRegisterForm.role;
    const cleanRobloxUsername = staffRegisterForm.roblox_username.trim();
    const cleanDiscord = staffRegisterForm.discord_username
      .trim()
      .replace(/^@/, "");
    const cleanRobloxUserId = staffRegisterForm.roblox_user_id.trim();

    if (
      !cleanRole ||
      !cleanRobloxUsername ||
      !cleanDiscord ||
      !cleanRobloxUserId
    ) {
      showNotice("Fill in all staff application fields before submitting.");
      return;
    }

    if (!/^\d+$/.test(cleanRobloxUserId)) {
      showNotice("Enter a valid Roblox User ID (numbers only).");
      return;
    }

    if (
      !staffConfirmations.commitment_confirmed ||
      !staffConfirmations.rulebook_confirmed
    ) {
      showNotice("You must accept both confirmations before submitting.");
      return;
    }

    setSubmittingStaffApplication(true);

    const { error } = await supabase.from("staff_applications").insert({
      role: cleanRole,
      roblox_username: cleanRobloxUsername,
      discord_username: cleanDiscord,
      roblox_user_id: cleanRobloxUserId,
      commitment_confirmed: true,
      rulebook_confirmed: true,
      approved: false,
      approved_at: null,
    });

    setSubmittingStaffApplication(false);

    if (error) {
      showNotice(error.message);
      return;
    }

    await reloadStaffApplications();

    setStaffRegisterForm({
      role: "",
      roblox_username: "",
      discord_username: "",
      roblox_user_id: "",
    });

    setStaffConfirmations({
      commitment_confirmed: false,
      rulebook_confirmed: false,
    });

    showSuccessDialog(
      "Application Submitted",
      `Your ${cleanRole} application has been submitted successfully and is now awaiting admin approval.`,
    );
  }

  async function handleRegisterSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!registrationsOpen) {
      showNotice("Team registrations are currently closed.");
      return;
    }

    const {
      country,
      captain_name,
      captain_discord,
      captain_roblox_id,
      brick_color_name,
    } = registerForm;

    if (
      !country ||
      !captain_name.trim() ||
      !captain_discord.trim() ||
      !captain_roblox_id.trim() ||
      !brick_color_name
    ) {
      showNotice("Fill in all fields before submitting.");
      return;
    }

    if (
      !registerConfirmations.captain_commitment ||
      !registerConfirmations.in_discord_server
    ) {
      showNotice(
        "You must confirm captain commitment and Discord server presence before submitting.",
      );
      return;
    }

    setSubmittingTeam(true);
    const ok = await submitTeam(registerForm);
    setSubmittingTeam(false);

    if (ok) {
      setRegisterForm({
        country: "",
        captain_name: "",
        captain_discord: "",
        captain_discord_id: "",
        captain_roblox_id: "",
        brick_color_name: "",
      });

      setRegisterConfirmations({
        captain_commitment: false,
        in_discord_server: false,
      });
    }
  }

  async function handleAdminAddTeam(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const {
      country,
      captain_name,
      captain_discord,
      captain_roblox_id,
      brick_color_name,
    } = adminTeamForm;

    if (
      !country ||
      !captain_name.trim() ||
      !captain_discord.trim() ||
      !captain_roblox_id.trim() ||
      !brick_color_name
    ) {
      showNotice("Fill in all team fields.", true);
      return;
    }

    const ok = await submitTeam(adminTeamForm, true);
    if (ok) {
      setAdminTeamForm({
        country: "",
        captain_name: "",
        captain_discord: "",
        captain_discord_id: "",
        captain_roblox_id: "",
        brick_color_name: "",
      });
    }
  }

  async function handleDeleteTeam(teamId: number) {
    if (!supabase) return;

    setTeamSyncBusy(true);
    try {
      await callTeamSync("delete_team", { teamId });
      await Promise.all([reloadTeams(), reloadTeamPlayers(), reloadTeamTransactions()]);
      showNotice("Team removed from site and Discord roles were cleaned.", true);
    } catch (error: any) {
      showNotice(error?.message || "Unable to remove team.", true);
    } finally {
      setTeamSyncBusy(false);
    }
  }

  async function handleChangeCaptain(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase) return;

    const teamId = Number(captainForm.team_id);
    const cleanCaptainName = captainForm.captain_name.trim();
    const cleanCaptainDiscord = cleanDiscordUsername(captainForm.captain_discord);
    const cleanCaptainDiscordId = captainForm.captain_discord_id.trim();
    const cleanCaptainRobloxId = captainForm.captain_roblox_id.trim();

    if (!teamId || !cleanCaptainName || !cleanCaptainDiscord || !cleanCaptainRobloxId) {
      showNotice("Fill in all captain fields.", true);
      return;
    }

    if (!isNumericId(cleanCaptainRobloxId)) {
      showNotice("Enter a valid Roblox User ID for the new captain.", true);
      return;
    }

    if (cleanCaptainDiscordId && !isNumericId(cleanCaptainDiscordId)) {
      showNotice("Discord User ID must contain numbers only.", true);
      return;
    }

    const team = teams.find((item) => item.id === teamId);
    if (!team) {
      showNotice("Team not found.", true);
      return;
    }

    setSavingCaptainChange(true);
    try {
      await callTeamSync("change_captain", {
        teamId,
        captainName: cleanCaptainName,
        captainDiscord: cleanCaptainDiscord,
        captainDiscordId: cleanCaptainDiscordId || null,
        captainRobloxId: cleanCaptainRobloxId,
        oldCaptainNewRole: captainForm.old_captain_new_role,
      });

      await Promise.all([reloadTeams(), reloadTeamPlayers()]);
      setCaptainForm({
        team_id: "",
        captain_name: "",
        captain_discord: "",
        captain_discord_id: "",
        captain_roblox_id: "",
        old_captain_new_role: "Player",
      });
      showNotice("Captain changed on the site and Discord.", true);
    } catch (error: any) {
      showNotice(error?.message || "Unable to change captain.", true);
    } finally {
      setSavingCaptainChange(false);
    }
  }

  async function handleRemoveCaptain(teamId: number) {
    if (!supabase) return;

    const team = teams.find((item) => item.id === teamId);
    if (!team) {
      showNotice("Team not found.", true);
      return;
    }

    setRemovingCaptain(true);

    const { error } = await supabase
      .from("teams")
      .update({
        captain_name: "",
        captain_discord: "",
        captain_discord_id: "",
        captain_roblox_id: "",
      })
      .eq("id", teamId);

    setRemovingCaptain(false);

    if (error) {
      showNotice(error.message, true);
      return;
    }

    await reloadTeams();
    showNotice("Captain removed successfully.", true);
  }

  async function handleCreateMatch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase) {
      showNotice("Supabase is not configured yet.", true);
      return;
    }

    if (
      !matchForm.home_country ||
      !matchForm.away_country ||
      !matchForm.stage.trim() ||
      !matchForm.match_date ||
      !matchForm.match_time
    ) {
      showNotice("Fill in all match fields.", true);
      return;
    }

    if (matchForm.home_country === matchForm.away_country) {
      showNotice("Home and away teams must be different.", true);
      return;
    }

    if (normalizeText(matchForm.stage).startsWith("playoffs:")) {
      if (
        !playoffQualifiedCountries.has(matchForm.home_country) ||
        !playoffQualifiedCountries.has(matchForm.away_country)
      ) {
        showNotice(
          "Only Qualifiers top 1-8 teams can play Playoffs matches.",
          true,
        );
        return;
      }
    }

    const setsPayload = {
      set1_home: toNullableNumber(matchForm.set1_home),
      set1_away: toNullableNumber(matchForm.set1_away),
      set2_home: toNullableNumber(matchForm.set2_home),
      set2_away: toNullableNumber(matchForm.set2_away),
      set3_home: toNullableNumber(matchForm.set3_home),
      set3_away: toNullableNumber(matchForm.set3_away),
      set4_home: toNullableNumber(matchForm.set4_home),
      set4_away: toNullableNumber(matchForm.set4_away),
      set5_home: toNullableNumber(matchForm.set5_home),
      set5_away: toNullableNumber(matchForm.set5_away),
    };

    const { homeScore, awayScore } = calculateSetWins(setsPayload);

    const winnerCountry = getWinnerCountryFromSets(
      setsPayload,
      matchForm.home_country,
      matchForm.away_country,
      matchForm.status,
    );

    const { data: createdMatch, error } = await supabase.from("matches").insert({
      home_country: matchForm.home_country,
      away_country: matchForm.away_country,
      stage: matchForm.stage.trim(),
      match_date: matchForm.match_date,
      match_time: matchForm.match_time,
      status: matchForm.status,
      home_score: homeScore,
      away_score: awayScore,
      winner_country: winnerCountry,
      referee_id: null,
      media_id: null,
      stat_tracker_id: matchForm.stat_tracker_id
        ? Number(matchForm.stat_tracker_id)
        : null,
      is_star_match: matchForm.is_star_match,
      best_of: matchForm.best_of,
      stats_finalized: false,
      stats_submitted_for_review: false,
      season_id: activeSeasonId,

      ...setsPayload,
    })
      .select("*")
      .single();

    if (error) {
      showNotice(error.message, true);
      return;
    }

    await reloadMatches();
    if (createdMatch) await notifyMatchToDiscord(createdMatch as MatchRow, (createdMatch as MatchRow).status);

    setMatchForm({
      home_country: "",
      away_country: "",
      stage: "",
      match_date: "",
      match_time: "",
      status: "Scheduled",
      is_star_match: false,
      stat_tracker_id: "",
      best_of: 3,

      set1_home: "",
      set1_away: "",
      set2_home: "",
      set2_away: "",
      set3_home: "",
      set3_away: "",
      set4_home: "",
      set4_away: "",
      set5_home: "",
      set5_away: "",
    });

    showNotice("Match created successfully.", true);
  }

  async function saveMatchDraft(matchId: number) {
    if (!supabase) return;

    const current = matches.find((match) => match.id === matchId);
    const draft = matchDrafts[matchId];
    if (!current || !draft) return;

    const canEditAsAdmin = adminLogged;
    const canEditAsTracker = canCurrentStatTrackerEditMatch(current);

    if (!canEditAsAdmin && !canEditAsTracker) {
      showNotice("You can only edit matches assigned to you.", true);
      return;
    }

    if (current.stats_finalized && !canEditAsAdmin) {
      showNotice(
        "Stats for this match are already finalized and cannot be edited.",
        true,
      );
      return;
    }

    if (normalizeText(draft.stage).startsWith("playoffs:")) {
      if (
        !playoffQualifiedCountries.has(current.home_country) ||
        !playoffQualifiedCountries.has(current.away_country)
      ) {
        showNotice(
          "Only Qualifiers top 1-8 teams can play Playoffs matches.",
          true,
        );
        return;
      }
    }

    const baseAdminPayload = {
      status: draft.status,
      stage: draft.stage,
      match_date: draft.match_date,
      match_time: draft.match_time,
      referee_id: draft.referee_id,
      media_id: draft.media_id,
      stat_tracker_id: draft.stat_tracker_id,
      is_star_match: draft.is_star_match,
      best_of: draft.best_of,
    };

    if (current.stats_finalized && canEditAsAdmin) {
      const homeScore = Number.isFinite(draft.home_score) ? draft.home_score : 0;
      const awayScore = Number.isFinite(draft.away_score) ? draft.away_score : 0;

      const { data: updatedMatch, error } = await supabase
        .from("matches")
        .update({
          ...baseAdminPayload,
          home_score: homeScore,
          away_score: awayScore,
          winner_country: getWinnerCountryFromScore(
            homeScore,
            awayScore,
            current.home_country,
            current.away_country,
            draft.status,
          ),
        })
        .eq("id", matchId)
        .select("*")
        .maybeSingle();

      if (error) {
        showNotice(error.message, true);
        return;
      }

      await reloadMatches();
      if (updatedMatch && current.status !== (updatedMatch as MatchRow).status) {
        await notifyMatchToDiscord(updatedMatch as MatchRow, (updatedMatch as MatchRow).status);
      }
      showNotice("Match updated. Finalized stats were kept locked.", true);
      return;
    }

    const { homeScore, awayScore } = calculateSetWins(draft);

    const winnerCountry = getWinnerCountryFromSets(
      draft,
      current.home_country,
      current.away_country,
      draft.status,
    );

    const commonStatsPayload = {
      home_score: homeScore,
      away_score: awayScore,
      winner_country: winnerCountry,

      set1_home: draft.set1_home,
      set1_away: draft.set1_away,
      set2_home: draft.set2_home,
      set2_away: draft.set2_away,
      set3_home: draft.set3_home,
      set3_away: draft.set3_away,
      set4_home: draft.set4_home,
      set4_away: draft.set4_away,
      set5_home: draft.set5_home,
      set5_away: draft.set5_away,

      stats_submitted_for_review: false,
    };

    const adminPayload = {
      ...baseAdminPayload,
      ...commonStatsPayload,
    };

    const trackerPayload = {
      status: draft.status === "Finished" ? "Live" : draft.status,
      ...commonStatsPayload,
    };

    const { data: updatedMatch, error } = await supabase
      .from("matches")
      .update(canEditAsAdmin ? adminPayload : trackerPayload)
      .eq("id", matchId)
      .eq("stats_finalized", false)
      .select("*")
      .maybeSingle();

    if (error) {
      showNotice(error.message, true);
      return;
    }

    await reloadMatches();
    if (canEditAsAdmin && updatedMatch && current.status !== (updatedMatch as MatchRow).status) {
      await notifyMatchToDiscord(updatedMatch as MatchRow, (updatedMatch as MatchRow).status);
    }
    showNotice("Match updated.", true);
  }

  async function submitStatsForReview(matchId: number) {
    if (!supabase) return;

    const current = matches.find((match) => match.id === matchId);

    if (!current) return;

    if (!canCurrentStatTrackerEditMatch(current)) {
      showNotice("You can only submit matches assigned to you.", true);
      return;
    }

    if (current.stats_finalized) {
      showNotice("Stats are already finalized.", true);
      return;
    }

    const { error } = await supabase
      .from("matches")
      .update({
        stats_submitted_for_review: true,
      })
      .eq("id", matchId)
      .eq("stats_finalized", false);

    if (error) {
      showNotice(error.message, true);
      return;
    }

    await reloadMatches();
    showNotice("Stats sent to Admin review.", true);
  }

  async function finishStats(matchId: number) {
    if (!supabase) return;

    if (!adminLogged) {
      showNotice("Only Admin can finish stats.", true);
      return;
    }

    const current = matches.find((match) => match.id === matchId);
    const draft = matchDrafts[matchId];

    if (!current || !draft) return;

    if (current.stats_finalized) {
      showNotice("Stats are already finalized.", true);
      return;
    }

    const { homeScore, awayScore } = calculateSetWins(draft);

    const winnerCountry = getWinnerCountryFromSets(
      draft,
      current.home_country,
      current.away_country,
      "Finished",
    );

    const { data: finishedMatch, error } = await supabase
      .from("matches")
      .update({
        status: "Finished",
        stage: draft.stage,
        match_date: draft.match_date,
        match_time: draft.match_time,
        home_score: homeScore,
        away_score: awayScore,
        winner_country: winnerCountry,
        referee_id: draft.referee_id,
        media_id: draft.media_id,
        stat_tracker_id: draft.stat_tracker_id,
        is_star_match: draft.is_star_match,

        set1_home: draft.set1_home,
        set1_away: draft.set1_away,
        set2_home: draft.set2_home,
        set2_away: draft.set2_away,
        set3_home: draft.set3_home,
        set3_away: draft.set3_away,
        set4_home: draft.set4_home,
        set4_away: draft.set4_away,
        set5_home: draft.set5_home,
        set5_away: draft.set5_away,

        stats_finalized: true,
        stats_submitted_for_review: false,
      })
      .eq("id", matchId)
      .eq("stats_finalized", false)
      .select("*")
      .maybeSingle();

    if (error) {
      showNotice(error.message, true);
      return;
    }

    await reloadMatches();
    if (finishedMatch && current.status !== "Finished") {
      await notifyMatchToDiscord(finishedMatch as MatchRow, "Finished");
    }
    showNotice("Stats finalized.", true);
  }

  async function handleDeleteMatch(matchId: number) {
    if (!supabase) return;

    const { error } = await supabase.from("matches").delete().eq("id", matchId);
    if (error) {
      showNotice(error.message, true);
      return;
    }

    await reloadMatches();
    showNotice("Match removed.", true);
  }

  async function reloadTeamPlayers(seasonId = activeSeasonId) {
    if (!supabase) return;

    if (!seasonId) {
      setTeamPlayers([]);
      return;
    }

    const result = await supabase
      .from("team_players")
      .select("*")
      .eq("season_id", seasonId)
      .order("created_at", { ascending: true });

    if (!result.error && result.data) {
      setTeamPlayers(result.data as TeamPlayer[]);
    }
  }

  async function reloadTeamTransactions() {
    if (!supabase) return;

    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session?.access_token) {
        setTeamTransactions([]);
        return;
      }

      const result = await callTeamSync("list_pending_transfers");
      setTeamTransactions((result.transactions ?? []) as TeamTransaction[]);
    } catch (error) {
      console.warn("Unable to load pending transfers", error);
      setTeamTransactions([]);
    }
  }

  async function reloadStaffApplications() {
    if (!supabase) return;

    const result = await supabase
      .from("staff_applications")
      .select("*")
      .order("created_at", { ascending: true });

    if (!result.error && result.data) {
      setStaffApplications(result.data as StaffApplication[]);
    }
  }

  async function handleAddPlayer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase) return;

    const cleanTeamId = Number(playerForm.team_id);
    const cleanUsername = playerForm.roblox_username.trim();
    const cleanUserId = playerForm.roblox_user_id.trim();
    const cleanDiscord = cleanDiscordUsername(playerForm.discord_username);
    const cleanDiscordId = playerForm.discord_id.trim();

    if (!cleanTeamId || !cleanUsername || !cleanUserId || !cleanDiscord || !playerForm.role) {
      showNotice("Fill in all player fields.", true);
      return;
    }

    if (!isNumericId(cleanUserId)) {
      showNotice("Enter a valid Roblox User ID (numbers only).", true);
      return;
    }

    if (cleanDiscordId && !isNumericId(cleanDiscordId)) {
      showNotice("Discord User ID must contain numbers only.", true);
      return;
    }

    setTeamSyncBusy(true);
    try {
      await callTeamSync("add_player", {
        teamId: cleanTeamId,
        robloxUsername: cleanUsername,
        robloxUserId: cleanUserId,
        discordUsername: cleanDiscord,
        discordId: cleanDiscordId || null,
        role: playerForm.role,
      });

      await reloadTeamPlayers();
      setPlayerForm({
        team_id: "",
        roblox_username: "",
        roblox_user_id: "",
        discord_username: "",
        discord_id: "",
        role: "Player",
      });
      showNotice("Player added to site and Discord roles were applied.", true);
    } catch (error: any) {
      showNotice(error?.message || "Unable to add player.", true);
    } finally {
      setTeamSyncBusy(false);
    }
  }

  async function handleUpdatePlayer(
    playerId: number,
    updated: Partial<TeamPlayer>,
  ) {
    if (!supabase) return;

    const cleanedUpdate: Partial<TeamPlayer> = { ...updated };

    if (typeof cleanedUpdate.roblox_username === "string") {
      cleanedUpdate.roblox_username = cleanedUpdate.roblox_username.trim();
      if (!cleanedUpdate.roblox_username) return;
    }

    if (typeof cleanedUpdate.discord_username === "string") {
      cleanedUpdate.discord_username = cleanedUpdate.discord_username
        .trim()
        .replace(/^@/, "");
      if (!cleanedUpdate.discord_username) return;
    }

    if (typeof cleanedUpdate.roblox_user_id === "string") {
      cleanedUpdate.roblox_user_id = cleanedUpdate.roblox_user_id.trim();
      if (!/^\d+$/.test(cleanedUpdate.roblox_user_id)) return;
    }

    const { error } = await supabase
      .from("team_players")
      .update(cleanedUpdate)
      .eq("id", playerId);

    if (error) {
      showNotice(error.message, true);
      return;
    }

    await reloadTeamPlayers();
    showNotice("Player updated successfully.", true);
  }

  async function handleDeletePlayer(playerId: number) {
    if (!supabase) return;

    setTeamSyncBusy(true);
    try {
      await callTeamSync("remove_player", { playerId });
      await reloadTeamPlayers();
      showNotice("Player removed from site and Discord roles.", true);
    } catch (error: any) {
      showNotice(error?.message || "Unable to remove player.", true);
    } finally {
      setTeamSyncBusy(false);
    }
  }

  async function resolveActiveSeason(preferredSeasonId?: string | null) {
    if (!supabase) return null;

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

  async function reloadLeagueSettings() {
    if (!supabase) return null;

    const { data, error } = await supabase
      .from("league_settings")
      .select("*")
      .eq("id", 1)
      .single();

    let nextActiveSeasonId: string | null = null;

    if (!error && data) {
      setRegistrationsOpen(Boolean(data.registrations_open));
      setAwardsPublic(Boolean(data.awards_public));
      setLeaderboardPublic(Boolean(data.leaderboard_public));
      nextActiveSeasonId = (data.active_season_id as string | null) ?? null;
    }

    return resolveActiveSeason(nextActiveSeasonId);
  }

  async function reloadPlayerStats(seasonId = activeSeasonId) {
    if (!supabase) return;
    setPlayerStatsLoading(true);

    if (!seasonId) {
      setPlayerStats([]);
      setPlayerStatsLoading(false);
      return;
    }

    const result = await supabase
      .from("match_player_stats")
      .select("*")
      .eq("season_id", seasonId)
      .order("match_id", { ascending: true })
      .order("set_number", { ascending: true })
      .order("team_country", { ascending: true })
      .order("player_name", { ascending: true });
    setPlayerStatsLoading(false);
    if (!result.error && result.data) {
      setPlayerStats(result.data as PlayerStat[]);
    }
  }

  async function saveLeagueVisibilitySetting(
    update: Partial<{ awards_public: boolean; leaderboard_public: boolean }>,
  ) {
    if (!supabase) return { error: null };

    const { error } = await supabase
      .from("league_settings")
      .update({
        ...update,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);

    return { error };
  }

  async function handleToggleAwardsPublic() {
    if (!supabase) return;
    setAwardsPublicLoading(true);
    const nextValue = !awardsPublic;
    const { error } = await saveLeagueVisibilitySetting({ awards_public: nextValue });
    setAwardsPublicLoading(false);
    if (error) {
      showNotice(error.message, true);
      return;
    }
    setAwardsPublic(nextValue);
    showNotice(
      nextValue
        ? "Awards are now public. Everyone can see them."
        : "Awards are now hidden from the public.",
      true,
    );
  }

  async function handleToggleLeaderboardPublic() {
    if (!supabase) return;
    setLeaderboardPublicLoading(true);
    const nextValue = !leaderboardPublic;
    const { error } = await saveLeagueVisibilitySetting({ leaderboard_public: nextValue });
    setLeaderboardPublicLoading(false);
    if (error) {
      showNotice(error.message, true);
      return;
    }
    setLeaderboardPublic(nextValue);
    showNotice(
      nextValue
        ? "Leaderboard is now public. Everyone can see it."
        : "Leaderboard is now hidden from the public.",
      true,
    );
  }

  async function handleToggleRegistrations() {
    if (!supabase) return;

    setTogglingRegistrations(true);

    const nextValue = !registrationsOpen;

    const { error } = await supabase
      .from("league_settings")
      .update({
        registrations_open: nextValue,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);

    setTogglingRegistrations(false);

    if (error) {
      showNotice(error.message, true);
      return;
    }

    setRegistrationsOpen(nextValue);
    showNotice(
      nextValue
        ? "Team registrations are now open."
        : "Team registrations are now closed.",
      true,
    );
  }

  async function handleUpdateTeamBrickColor(
    teamId: number,
    brickColorName: string,
  ) {
    if (!supabase) return;

    const selectedBrickColor = getBrickColorByNumber(brickColorName);
    if (!selectedBrickColor) {
      showNotice("Select a valid Brick Color.", true);
      return;
    }

    const { error } = await supabase
      .from("teams")
      .update({
        brick_color_name: selectedBrickColor.name,
        brick_color_hex: selectedBrickColor.hex,
        brick_color_number: selectedBrickColor.number,
      })
      .eq("id", teamId);

    if (error) {
      showNotice(error.message, true);
      return;
    }

    await reloadTeams();
    showNotice("Brick Color updated successfully.", true);
  }

  async function handleAssignTeamGroup(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    if (!supabase) return;

    const teamId = Number(teamGroupForm.team_id);
    const groupLetter = teamGroupForm.group_letter as GroupLetter;

    if (!teamId || !groupLetter) {
      showNotice("Select a team and a group.", true);
      return;
    }

    const { error } = await supabase
      .from("teams")
      .update({
        group_letter: groupLetter,
      })
      .eq("id", teamId);

    if (error) {
      showNotice(error.message, true);
      return;
    }

    await reloadTeams();

    setTeamGroupForm({
      team_id: "",
      group_letter: "",
    });

    showNotice("Team group updated successfully.", true);
  }

  async function handleSetTeamDiscordRole(teamId: number) {
    const discordRoleId = (teamRoleDrafts[teamId] ?? "").trim();
    if (!discordRoleId || !isNumericId(discordRoleId)) {
      showNotice("Enter a valid Discord Role ID for this team.", true);
      return;
    }

    setTeamSyncBusy(true);
    try {
      await callTeamSync("set_team_role", { teamId, discordRoleId });
      await reloadTeams();
      setTeamRoleDrafts((prev) => ({ ...prev, [teamId]: "" }));
      showNotice("Discord role connected to team.", true);
    } catch (error: any) {
      showNotice(error?.message || "Unable to connect Discord role.", true);
    } finally {
      setTeamSyncBusy(false);
    }
  }

  async function handleClearPendingTransfer(transaction: TeamTransaction) {
    setTeamSyncBusy(true);
    try {
      await callTeamSync("clear_transfer", {
        transactionId: transaction.id,
        playerDiscordId: transaction.player_discord_id ?? null,
      });
      await reloadTeamTransactions();
      showNotice("Pending transfer cleared from the site.", true);
    } catch (error: any) {
      showNotice(error?.message || "Unable to clear pending transfer.", true);
    } finally {
      setTeamSyncBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#140D07] text-white selection:bg-orange-400/20 selection:text-white">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#140D07]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <nav className="hidden min-w-0 flex-wrap items-center justify-start gap-1 rounded-2xl border border-orange-400/10 bg-orange-500/[0.06] p-1.5 backdrop-blur-sm md:flex">
              <Link
                href="/"
                className="rounded-xl px-2 py-1 text-sm text-white/80 transition duration-200 hover:-translate-y-0.5 hover:bg-white/10 hover:text-white active:translate-y-0.5"
              >
                Public Site
              </Link>
              <Link
                href="/stats"
                className="rounded-xl px-2 py-1 text-sm text-white/80 transition duration-200 hover:-translate-y-0.5 hover:bg-white/10 hover:text-white active:translate-y-0.5"
              >
                Stats
              </Link>
              <Link
                href="/archives"
                className="rounded-xl px-2 py-1 text-sm text-white/80 transition duration-200 hover:-translate-y-0.5 hover:bg-white/10 hover:text-white active:translate-y-0.5"
              >
                Archives
              </Link>
              <Link
                href="/matchmaking"
                className="rounded-xl px-2 py-1 text-sm text-white/80 transition duration-200 hover:-translate-y-0.5 hover:bg-white/10 hover:text-white active:translate-y-0.5"
              >
                Matchmaking
              </Link>
              <Link
                href="/pickems"
                className="rounded-xl px-2 py-1 text-sm text-white/80 transition duration-200 hover:-translate-y-0.5 hover:bg-white/10 hover:text-white active:translate-y-0.5"
              >
                Pickems
              </Link>
            </nav>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/profile"
              className="inline-flex shrink-0 items-center gap-2 rounded-2xl border border-[#5865F2]/35 bg-[#5865F2]/15 px-4 py-2 text-sm font-black text-white shadow-lg shadow-[#5865F2]/10 transition duration-200 hover:-translate-y-0.5 hover:bg-[#5865F2]/25 active:translate-y-0.5"
            >
              <span>Profile</span>
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-[#AEB6FF]">
                <path d="M20.3 5.37A16.1 16.1 0 0 0 16.34 4c-.17.31-.36.73-.49 1.06a14.9 14.9 0 0 0-4.4 0A8.4 8.4 0 0 0 10.96 4a16.2 16.2 0 0 0-3.98 1.38C4.46 9.13 3.78 12.8 4.12 16.4A16.4 16.4 0 0 0 9 18.9c.4-.54.75-1.11 1.05-1.72-.58-.22-1.14-.49-1.66-.8.14-.1.27-.21.4-.32a11.55 11.55 0 0 0 10.24 0c.13.11.26.22.4.32-.52.31-1.08.58-1.66.8.3.61.66 1.18 1.05 1.72a16.3 16.3 0 0 0 4.88-2.5c.42-4.17-.72-7.8-3.4-11.03ZM9.75 14.17c-.95 0-1.73-.89-1.73-1.98s.76-1.99 1.73-1.99c.97 0 1.75.9 1.73 1.99 0 1.09-.76 1.98-1.73 1.98Zm6.2 0c-.95 0-1.73-.89-1.73-1.98s.76-1.99 1.73-1.99c.97 0 1.75.9 1.73 1.99 0 1.09-.76 1.98-1.73 1.98Z" />
              </svg>
            </Link>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((open) => !open)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white transition hover:bg-white/10 md:hidden"
              aria-label="Open navigation menu"
              aria-expanded={mobileMenuOpen}
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                {mobileMenuOpen ? (
                  <path d="M6 6l12 12M18 6L6 18" />
                ) : (
                  <>
                    <path d="M4 7h16" />
                    <path d="M4 12h16" />
                    <path d="M4 17h16" />
                  </>
                )}
              </svg>
            </button>
          </div>
        </div>

        {mobileMenuOpen ? (
          <div className="border-t border-white/10 bg-[#140D07]/95 px-6 py-4 backdrop-blur md:hidden">
            <div className="mx-auto grid max-w-7xl gap-2 text-sm font-semibold text-white/85">
              <Link href="/" onClick={() => setMobileMenuOpen(false)} className="rounded-2xl px-4 py-3 hover:bg-white/5">Public Site</Link>
              <Link href="/stats" onClick={() => setMobileMenuOpen(false)} className="rounded-2xl px-4 py-3 hover:bg-white/5">Stats</Link>
              <Link href="/archives" onClick={() => setMobileMenuOpen(false)} className="rounded-2xl px-4 py-3 hover:bg-white/5">Archives</Link>
              <Link href="/matchmaking" onClick={() => setMobileMenuOpen(false)} className="rounded-2xl px-4 py-3 hover:bg-white/5">Matchmaking</Link>
              <Link href="/pickems" onClick={() => setMobileMenuOpen(false)} className="rounded-2xl px-4 py-3 hover:bg-white/5">Pickems</Link>
              <Link href="/profile" onClick={() => setMobileMenuOpen(false)} className="rounded-2xl px-4 py-3 hover:bg-white/5">Profile</Link>
            </div>
          </div>
        ) : null}
      </header>

      <main>
        <section id="admin" className="scroll-mt-28 bg-[#140D07] py-12 md:py-16">
          <div className="mx-auto max-w-7xl px-6">
            <div className="mb-8 overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.18),transparent_36%),#21150A] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.25)] md:p-8">
              <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-300">
                    Admin Dashboard
                  </p>
                  <h1 className="mt-2 text-4xl font-black md:text-5xl">
                    League Control Center
                  </h1>
                  <p className="mt-3 max-w-3xl text-white/65">
                    A dedicated page for registrations, public visibility, teams, staff, rosters, matches, and stats review.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Link
                    href="/"
                    className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition duration-200 hover:-translate-y-0.5 hover:bg-white/10 active:translate-y-0.5"
                  >
                    Back to site
                  </Link>
                  {adminLogged ? (
                    <button
                      type="button"
                      onClick={handleAdminLogout}
                      className="rounded-2xl border border-red-400/20 bg-red-400/10 px-5 py-3 text-sm font-semibold text-red-300 transition duration-200 hover:-translate-y-0.5 hover:bg-red-400/15 active:translate-y-0.5"
                    >
                      Lock Admin
                    </button>
                  ) : null}
                </div>
              </div>

              {adminLogged ? (
                <div className="mt-6 grid gap-3 md:grid-cols-5">
                  <a href="#admin-status" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white/75 transition hover:-translate-y-0.5 hover:bg-white/10 hover:text-white">
                    Status
                  </a>
                  <a href="#admin-setup" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white/75 transition hover:-translate-y-0.5 hover:bg-white/10 hover:text-white">
                    Setup & Schedule
                  </a>
                  <a href="#admin-teams-staff" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white/75 transition hover:-translate-y-0.5 hover:bg-white/10 hover:text-white">
                    Teams & Staff
                  </a>
                  <a href="#admin-matches" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white/75 transition hover:-translate-y-0.5 hover:bg-white/10 hover:text-white">
                    Matches & Stats
                  </a>
                  <a href="#admin-users" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white/75 transition hover:-translate-y-0.5 hover:bg-white/10 hover:text-white">
                    Users & Roles
                  </a>
                </div>
              ) : null}
              {refereeLogged && !adminLogged ? (
                <div className="mt-6 grid gap-3 md:grid-cols-2">
                  <a href="#admin-matches" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white/75 transition hover:-translate-y-0.5 hover:bg-white/10 hover:text-white">
                    Matches & Stats
                  </a>
                </div>
              ) : null}
            </div>

            {!adminLogged && !statTrackerLogged && !refereeLogged ? (
              <div className="max-w-xl space-y-4">
                <div className="rounded-[2rem] border border-white/10 bg-[#1C120A] p-6">
                  <p className="text-sm font-medium text-white/70">
                    Owner and anyone with Administrator permission in the Discord server unlock this panel just by logging in.
                  </p>
                  <button
                    type="button"
                    onClick={handleDiscordLoginFromAdmin}
                    className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-[#5865F2] px-5 py-3 text-sm font-black text-white shadow-lg shadow-[#5865F2]/25 transition duration-200 hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0.5"
                  >
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                      <path d="M20.3 5.37A16.1 16.1 0 0 0 16.34 4c-.17.31-.36.73-.49 1.06a14.9 14.9 0 0 0-4.4 0A8.4 8.4 0 0 0 10.96 4a16.2 16.2 0 0 0-3.98 1.38C4.46 9.13 3.78 12.8 4.12 16.4A16.4 16.4 0 0 0 9 18.9c.4-.54.75-1.11 1.05-1.72-.58-.22-1.14-.49-1.66-.8.14-.1.27-.21.4-.32a11.55 11.55 0 0 0 10.24 0c.13.11.26.22.4.32-.52.31-1.08.58-1.66.8.3.61.66 1.18 1.05 1.72a16.3 16.3 0 0 0 4.88-2.5c.42-4.17-.72-7.8-3.4-11.03ZM9.75 14.17c-.95 0-1.73-.89-1.73-1.98s.76-1.99 1.73-1.99c.97 0 1.75.9 1.73 1.99 0 1.09-.76 1.98-1.73 1.98Zm6.2 0c-.95 0-1.73-.89-1.73-1.98s.76-1.99 1.73-1.99c.97 0 1.75.9 1.73 1.99 0 1.09-.76 1.98-1.73 1.98Z" />
                    </svg>
                    Login with Discord
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                <div className={adminLogged ? "space-y-8" : "hidden"}>
                  <div id="admin-status" className="scroll-mt-28 rounded-[2rem] border border-white/10 bg-[#1C120A] p-6">
                    <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                      <div>
                        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-amber-300">
                          Status & public access
                        </p>
                        <h2 className="mt-2 text-2xl font-black text-white">
                          Season control at a glance
                        </h2>
                        <p className="mt-2 max-w-2xl text-sm text-white/60">
                          Use these cards for the most common actions before touching teams, staff, or matches.
                        </p>
                      </div>
                      <span className="rounded-full border border-orange-400/20 bg-orange-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">
                        {activeSeason?.name ?? CURRENT_SEASON_LABEL}
                      </span>
                    </div>

                    <div className="mt-6 grid gap-4 lg:grid-cols-3">
                      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/45">
                          Registrations
                        </p>
                        <div className="mt-3 flex items-center justify-between gap-3">
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
                              registrationsOpen
                                ? "border-orange-400/20 bg-orange-400/10 text-amber-300"
                                : "border-red-400/20 bg-red-400/10 text-red-300"
                            }`}
                          >
                            {registrationsOpen ? "Open" : "Closed"}
                          </span>
                          <button
                            type="button"
                            onClick={handleToggleRegistrations}
                            disabled={togglingRegistrations}
                            className={`rounded-2xl px-4 py-2 text-sm font-semibold transition duration-200 ${
                              registrationsOpen
                                ? "border border-red-400/20 bg-red-400/10 text-red-300 hover:-translate-y-0.5 hover:bg-red-400/15"
                                : "bg-orange-500 text-black hover:-translate-y-0.5 hover:scale-[1.01]"
                            } disabled:cursor-not-allowed disabled:opacity-50`}
                          >
                            {togglingRegistrations
                              ? "Updating..."
                              : registrationsOpen
                                ? "Close"
                                : "Open"}
                          </button>
                        </div>
                        <p className="mt-3 text-sm text-white/55">
                          Controls whether captains can register teams for the active season.
                        </p>
                      </div>

                      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/45">
                          Leaderboard
                        </p>
                        <div className="mt-3 flex items-center justify-between gap-3">
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
                              leaderboardPublic
                                ? "border-orange-400/20 bg-orange-400/10 text-amber-300"
                                : "border-yellow-400/20 bg-yellow-400/10 text-yellow-300"
                            }`}
                          >
                            {leaderboardPublic ? "Public" : "Admin only"}
                          </span>
                          <button
                            type="button"
                            onClick={handleToggleLeaderboardPublic}
                            disabled={leaderboardPublicLoading}
                            className={`rounded-2xl px-4 py-2 text-sm font-semibold transition duration-200 ${
                              leaderboardPublic
                                ? "border border-red-400/20 bg-red-400/10 text-red-300 hover:-translate-y-0.5 hover:bg-red-400/15"
                                : "bg-orange-500 text-black hover:-translate-y-0.5 hover:scale-[1.01]"
                            } disabled:cursor-not-allowed disabled:opacity-50`}
                          >
                            {leaderboardPublicLoading
                              ? "Updating..."
                              : leaderboardPublic
                                ? "Hide"
                                : "Open"}
                          </button>
                        </div>
                        <p className="mt-3 text-sm text-white/55">
                          When public, everyone can see Leaderboard. Otherwise only Admin Access can.
                        </p>
                      </div>

                      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/45">
                          Awards
                        </p>
                        <div className="mt-3 flex items-center justify-between gap-3">
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
                              awardsPublic
                                ? "border-orange-400/20 bg-orange-400/10 text-amber-300"
                                : "border-yellow-400/20 bg-yellow-400/10 text-yellow-300"
                            }`}
                          >
                            {awardsPublic ? "Public" : "Admin only"}
                          </span>
                          <button
                            type="button"
                            onClick={handleToggleAwardsPublic}
                            disabled={awardsPublicLoading}
                            className={`rounded-2xl px-4 py-2 text-sm font-semibold transition duration-200 ${
                              awardsPublic
                                ? "border border-red-400/20 bg-red-400/10 text-red-300 hover:-translate-y-0.5 hover:bg-red-400/15"
                                : "bg-orange-500 text-black hover:-translate-y-0.5 hover:scale-[1.01]"
                            } disabled:cursor-not-allowed disabled:opacity-50`}
                          >
                            {awardsPublicLoading
                              ? "Updating..."
                              : awardsPublic
                                ? "Hide"
                                : "Open"}
                          </button>
                        </div>
                        <p className="mt-3 text-sm text-white/55">
                          When public, everyone can see Awards. Otherwise only Admin Access can.
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-4">
                      <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-white/40">Pending teams</p>
                        <p className="mt-1 text-2xl font-black text-yellow-300">{pendingTeams.length}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-white/40">Approved teams</p>
                        <p className="mt-1 text-2xl font-black text-amber-300">{approvedTeams.length}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-white/40">Staff pending</p>
                        <p className="mt-1 text-2xl font-black text-yellow-300">{pendingStaff.length}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-white/40">Matches</p>
                        <p className="mt-1 text-2xl font-black text-white">{matches.length}</p>
                      </div>
                    </div>
                  </div>

                <div id="admin-setup" className="scroll-mt-28">
                  <div className="mb-4">
                    <p className="text-sm font-semibold uppercase tracking-[0.25em] text-amber-300">
                      Setup & schedule
                    </p>
                    <h2 className="mt-2 text-2xl font-black text-white">
                      Create teams, groups, and matches
                    </h2>
                    <p className="mt-2 text-sm text-white/60">
                      Use this area for manual team entry, group assignment, and new match creation.
                    </p>
                  </div>

                  <div className="grid gap-8 lg:grid-cols-2">
                  <form
                    onSubmit={handleAdminAddTeam}
                    className="rounded-[2rem] border border-white/10 bg-[#1C120A] p-6"
                  >
                    <p className="text-xl font-bold">Add team manually</p>
                    <div className="mt-5 grid gap-4">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-white/70">
                          Team
                        </label>
                        <SelectPicker
                          value={adminTeamForm.country}
                          onChange={(value) =>
                            setAdminTeamForm((prev) => ({
                              ...prev,
                              country: value,
                            }))
                          }
                          options={countryOptions}
                          placeholder="Select a country"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-white/70">
                          Brick Color
                        </label>
                        <SelectPicker
                          value={adminTeamForm.brick_color_name}
                          onChange={(value) =>
                            setAdminTeamForm((prev) => ({
                              ...prev,
                              brick_color_name: value,
                            }))
                          }
                          options={registerBrickColorOptions}
                          placeholder="Select a Brick Color"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-white/70">
                          Captain Roblox Username
                        </label>
                        <input
                          value={adminTeamForm.captain_name}
                          onChange={(e) =>
                            setAdminTeamForm((prev) => ({
                              ...prev,
                              captain_name: e.target.value,
                            }))
                          }
                          className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none transition duration-200 hover:border-orange-400/30 focus:border-orange-400/40"
                          placeholder="Captain Roblox Username"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-white/70">
                          Discord
                        </label>
                        <input
                          value={adminTeamForm.captain_discord}
                          onChange={(e) =>
                            setAdminTeamForm((prev) => ({
                              ...prev,
                              captain_discord: e.target.value,
                            }))
                          }
                          className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none transition duration-200 hover:border-orange-400/30 focus:border-orange-400/40"
                          placeholder="discorduser"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-white/70">
                          Captain Discord User ID <span className="text-white/40">(optional)</span>
                        </label>
                        <input
                          value={adminTeamForm.captain_discord_id}
                          onChange={(e) =>
                            setAdminTeamForm((prev) => ({
                              ...prev,
                              captain_discord_id: e.target.value,
                            }))
                          }
                          className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none transition duration-200 hover:border-orange-400/30 focus:border-orange-400/40"
                          placeholder="Discord numeric ID"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-white/70">
                          Roblox User ID
                        </label>
                        <input
                          value={adminTeamForm.captain_roblox_id}
                          onChange={(e) =>
                            setAdminTeamForm((prev) => ({
                              ...prev,
                              captain_roblox_id: e.target.value,
                            }))
                          }
                          className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none transition duration-200 hover:border-orange-400/30 focus:border-orange-400/40"
                          placeholder="123456789"
                        />
                      </div>

                      <button
                        type="submit"
                        className="rounded-2xl bg-orange-500 px-6 py-3 font-semibold text-black transition duration-200 hover:-translate-y-1 hover:scale-[1.01] active:translate-y-0.5"
                      >
                        Add Team
                      </button>
                    </div>
                  </form>

                  <form
                    onSubmit={handleAssignTeamGroup}
                    className="rounded-[2rem] border border-white/10 bg-[#1C120A] p-6"
                  >
                    <p className="text-xl font-bold">Assign team to group</p>
                    <p className="mt-2 text-sm text-white/60">
                      Add an approved team to Group A, B, C or D.
                    </p>

                    <div className="mt-5 grid gap-4">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-white/70">
                          Approved team
                        </label>
                        <SelectPicker
                          value={teamGroupForm.team_id}
                          onChange={(value) =>
                            setTeamGroupForm((prev) => ({
                              ...prev,
                              team_id: value,
                            }))
                          }
                          options={approvedTeams.map((team) => ({
                            label: `${team.country}${team.group_letter ? ` (Group ${team.group_letter})` : ""}`,
                            value: String(team.id),
                            imageUrl: getFlagUrl(team.code),
                          }))}
                          placeholder="Select a team"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-white/70">
                          Group
                        </label>
                        <SelectPicker
                          value={teamGroupForm.group_letter}
                          onChange={(value) =>
                            setTeamGroupForm((prev) => ({
                              ...prev,
                              group_letter: value,
                            }))
                          }
                          options={groupOptions}
                          placeholder="Select group"
                        />
                      </div>

                      <button
                        type="submit"
                        className="rounded-2xl bg-orange-500 px-6 py-3 font-semibold text-black transition duration-200 hover:-translate-y-1 hover:scale-[1.01] active:translate-y-0.5"
                      >
                        Save Group
                      </button>
                    </div>
                  </form>

                  <form
                    onSubmit={handleCreateMatch}
                    className="rounded-[2rem] border border-white/10 bg-[#1C120A] p-6"
                  >
                    <p className="text-xl font-bold">Create match</p>
                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-white/70">
                          Home Team
                        </label>
                        <SelectPicker
                          value={matchForm.home_country}
                          onChange={(value) =>
                            setMatchForm((prev) => ({
                              ...prev,
                              home_country: value,
                            }))
                          }
                          options={registeredCountryOptions}
                          placeholder="Select home team"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-white/70">
                          Away Team
                        </label>
                        <SelectPicker
                          value={matchForm.away_country}
                          onChange={(value) =>
                            setMatchForm((prev) => ({
                              ...prev,
                              away_country: value,
                            }))
                          }
                          options={registeredCountryOptions}
                          placeholder="Select away team"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="mb-2 block text-sm font-medium text-white/70">
                          Stage
                        </label>
                        <input
                          type="text"
                          name="stage"
                          value={matchForm.stage}
                          onChange={handleMatchFormChange}
                          className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none transition duration-200 hover:border-orange-400/30 focus:border-orange-400/40"
                          placeholder="Qualifiers Round 1"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-white/70">
                          Date
                        </label>
                        <input
                          type="date"
                          name="match_date"
                          value={matchForm.match_date}
                          onChange={handleMatchFormChange}
                          className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none transition duration-200 hover:border-orange-400/30 focus:border-orange-400/40"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-white/70">
                          Time
                        </label>
                        <input
                          type="time"
                          name="match_time"
                          value={matchForm.match_time}
                          onChange={handleMatchFormChange}
                          className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none transition duration-200 hover:border-orange-400/30 focus:border-orange-400/40"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-white/70">
                          Status
                        </label>
                        <SelectPicker
                          value={matchForm.status}
                          onChange={(value) =>
                            setMatchForm((prev) => ({
                              ...prev,
                              status: value as MatchStatus,
                            }))
                          }
                          options={statusOptions}
                          placeholder="Select status"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-white/70">
                          Format
                        </label>
                        <div className="flex gap-2">
                          {([3, 5] as const).map((option) => (
                            <button
                              key={option}
                              type="button"
                              onClick={() =>
                                setMatchForm((prev) => ({
                                  ...prev,
                                  best_of: option,
                                }))
                              }
                              className={`flex-1 rounded-2xl border px-4 py-3 text-sm font-semibold transition duration-200 ${
                                matchForm.best_of === option
                                  ? "border-orange-400/60 bg-orange-500/20 text-orange-200"
                                  : "border-white/10 bg-white/5 text-white/60 hover:border-orange-400/30"
                              }`}
                            >
                              Bo{option}
                            </button>
                          ))}
                        </div>
                        <p className="mt-2 text-xs text-white/45">
                          Controls how many set fields show up on the Pickems
                          prediction form for this match.
                        </p>
                      </div>

                      <div className="md:col-span-2">
                        <label className="flex items-start gap-3 rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-4 text-sm text-yellow-100">
                          <input
                            type="checkbox"
                            checked={matchForm.is_star_match}
                            onChange={(event) =>
                              setMatchForm((prev) => ({
                                ...prev,
                                is_star_match: event.target.checked,
                              }))
                            }
                            className="mt-1 h-4 w-4 rounded border-yellow-400/30 bg-transparent accent-yellow-400"
                          />

                          <span>
                            <span className="block font-semibold text-yellow-300">
                              Star Match
                            </span>
                            Mark this match as a featured match on the public
                            schedule.
                          </span>
                        </label>
                      </div>

                      <div className="md:col-span-2">
                        <label className="mb-3 block text-sm font-medium text-white/70">
                          Set Scores
                        </label>

                        <div className="grid gap-3">
                          {[1, 2, 3, 4, 5].map((setNumber) => (
                            <div
                              key={setNumber}
                              className="grid grid-cols-[90px_1fr_1fr] gap-3 items-end"
                            >
                              <p className="text-sm font-semibold text-white/70">
                                Set {setNumber}
                              </p>

                              <div>
                                <label className="mb-2 block text-xs font-medium text-white/50">
                                  Home
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  name={`set${setNumber}_home`}
                                  value={
                                    matchForm[
                                      `set${setNumber}_home` as keyof typeof matchForm
                                    ] as string
                                  }
                                  onChange={handleMatchFormChange}
                                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none transition duration-200 hover:border-orange-400/30 focus:border-orange-400/40"
                                  placeholder="25"
                                />
                              </div>

                              <div>
                                <label className="mb-2 block text-xs font-medium text-white/50">
                                  Away
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  name={`set${setNumber}_away`}
                                  value={
                                    matchForm[
                                      `set${setNumber}_away` as keyof typeof matchForm
                                    ] as string
                                  }
                                  onChange={handleMatchFormChange}
                                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none transition duration-200 hover:border-orange-400/30 focus:border-orange-400/40"
                                  placeholder="22"
                                />
                              </div>
                            </div>
                          ))}
                        </div>

                        <p className="mt-3 text-xs text-white/45">
                          The set result in matches and standings will be
                          calculated automatically from these values.
                        </p>
                      </div>

                      <div className="md:col-span-2">
                        <button
                          type="submit"
                          className="w-full rounded-2xl bg-orange-500 px-6 py-3 font-semibold text-black transition duration-200 hover:-translate-y-1 hover:scale-[1.01] active:translate-y-0.5"
                        >
                          Create Match
                        </button>
                      </div>
                    </div>
                  </form>
                  </div>
                </div>

                <div id="admin-teams-staff" className="scroll-mt-28">
                  <div className="mb-4">
                    <p className="text-sm font-semibold uppercase tracking-[0.25em] text-amber-300">
                      Teams, rosters & staff
                    </p>
                    <h2 className="mt-2 text-2xl font-black text-white">
                      Approvals and roster management
                    </h2>
                    <p className="mt-2 text-sm text-white/60">
                      Review registrations, approve staff, add roster players, and maintain captains.
                    </p>
                  </div>

                  <div className="grid gap-8 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
                  <div className="rounded-[2rem] border border-white/10 bg-[#1C120A] p-6 xl:col-span-2">
                    <p className="mb-4 text-xl font-bold">Team approvals</p>

                    <div className="space-y-6">
                      <div>
                        <div className="mb-3 flex items-center justify-between">
                          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-yellow-300">
                            Pending Registrations
                          </p>
                          <span className="rounded-full border border-yellow-400/20 bg-yellow-400/10 px-3 py-1 text-xs font-semibold text-yellow-300">
                            {pendingTeams.length}
                          </span>
                        </div>

                        <div className="space-y-4">
                          {pendingTeams.length === 0 ? (
                            <p className="text-white/60">No pending teams.</p>
                          ) : (
                            pendingTeams.map((team) => (
                              <div
                                key={team.id}
                                className="rounded-2xl border border-yellow-400/15 bg-yellow-400/[0.04] p-4"
                              >
                                <div className="flex items-start justify-between gap-4">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-3">
                                      <img
                                        src={getFlagUrl(team.code)}
                                        alt={`${team.country} flag`}
                                        className="h-8 w-11 rounded-md object-cover"
                                      />
                                      <div>
                                        <p className="font-semibold">
                                          {team.country}
                                        </p>
                                        <div className="mt-1 flex items-center gap-2 text-sm text-white/70">
                                          <Avatar
                                            robloxUserId={
                                              team.captain_roblox_id
                                            }
                                            name={team.captain_name}
                                          />
                                          <span className="truncate">
                                            {team.captain_name} • @
                                            {team.captain_discord}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleApproveTeam(team.id)}
                                      className="rounded-2xl bg-orange-500 px-4 py-2 text-sm font-semibold text-black transition duration-200 hover:-translate-y-0.5 hover:scale-[1.01] active:translate-y-0.5"
                                    >
                                      Approve
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        openConfirmDialog({
                                          title: "Reject Registration",
                                          message: `Are you sure you want to reject ${team.country}'s registration?`,
                                          confirmLabel: "Reject",
                                          onConfirm: () =>
                                            handleDeleteTeam(team.id),
                                        })
                                      }
                                      className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-2 text-sm font-semibold text-red-300 transition duration-200 hover:-translate-y-0.5 hover:bg-red-400/15 active:translate-y-0.5"
                                    >
                                      Reject
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        openConfirmDialog({
                                          title: "Remove Captain",
                                          message:
                                            "Are you sure you want to remove the current captain from this team?",
                                          confirmLabel: "Remove Captain",
                                          onConfirm: async () => {
                                            await handleRemoveCaptain(team.id);
                                          },
                                        })
                                      }
                                      className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-400/15"
                                    >
                                      Remove Captain
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div>
                        <div className="mb-3 flex items-center justify-between">
                          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-300">
                            Approved Teams
                          </p>
                          <span className="rounded-full border border-orange-400/20 bg-orange-400/10 px-3 py-1 text-xs font-semibold text-amber-300">
                            {approvedTeams.length}
                          </span>
                        </div>

                        <div className="space-y-4">
                          {approvedTeams.length === 0 ? (
                            <p className="text-white/60">
                              No approved teams yet.
                            </p>
                          ) : (
                            approvedTeams.map((team) => (
                              <div
                                key={team.id}
                                className="rounded-[2rem] border border-white/10 bg-white/5 p-5"
                              >
                                <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,420px)] xl:items-start">
                                  <div className="min-w-0 space-y-4">
                                    <div className="flex min-w-0 items-center gap-3">
                                      <img
                                        src={getFlagUrl(team.code)}
                                        alt={`${team.country} flag`}
                                        className="h-9 w-12 shrink-0 rounded-md object-cover"
                                      />
                                      <div className="min-w-0">
                                        <p className="truncate text-lg font-black text-white">
                                          {team.country}
                                        </p>
                                        <div className="mt-1 flex min-w-0 items-center gap-2 text-sm text-white/70">
                                          <Avatar
                                            robloxUserId={team.captain_roblox_id}
                                            name={team.captain_name}
                                          />
                                          <span className="truncate">
                                            {team.captain_name} • @{team.captain_discord}
                                          </span>
                                        </div>
                                      </div>
                                    </div>

                                    {team.brick_color_name && team.brick_color_hex ? (
                                      <div className="flex w-fit items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-sm text-white/75">
                                        <span
                                          className="h-4 w-4 rounded-full border border-white/20"
                                          style={{ backgroundColor: team.brick_color_hex }}
                                        />
                                        <span>{team.brick_color_name}</span>
                                        {team.brick_color_number ? (
                                          <span className="text-white/45">#{team.brick_color_number}</span>
                                        ) : null}
                                      </div>
                                    ) : null}

                                    <div>
                                      <label className="mb-2 block text-sm font-medium text-white/70">
                                        Brick Color
                                      </label>
                                      <SelectPicker
                                        value={team.brick_color_name ?? ""}
                                        onChange={(value) =>
                                          handleUpdateTeamBrickColor(team.id, value)
                                        }
                                        options={getAdminBrickColorOptions(team.id)}
                                        placeholder="Select a Brick Color"
                                      />
                                    </div>
                                  </div>

                                  <div className="space-y-3 rounded-[1.5rem] border border-[#5865F2]/20 bg-[#5865F2]/10 p-4">
                                    <label className="block text-sm font-medium text-white/70">
                                      Discord Team Role ID
                                    </label>
                                    <div className="flex flex-col gap-2 sm:flex-row">
                                      <input
                                        value={teamRoleDrafts[team.id] ?? team.discord_role_id ?? ""}
                                        onChange={(event) =>
                                          setTeamRoleDrafts((prev) => ({
                                            ...prev,
                                            [team.id]: event.target.value,
                                          }))
                                        }
                                        className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none transition focus:border-[#5865F2]/50"
                                        placeholder="Discord role ID"
                                      />
                                      <button
                                        type="button"
                                        disabled={teamSyncBusy}
                                        onClick={() => handleSetTeamDiscordRole(team.id)}
                                        className="rounded-2xl bg-[#5865F2] px-5 py-3 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        Save Role
                                      </button>
                                    </div>
                                    <p className="text-xs leading-5 text-white/45">
                                      This connects /team create, /team info and site roster actions to the same Discord role.
                                    </p>

                                    <div className="grid gap-2 sm:grid-cols-2">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSelectedAdminTeamId(team.id);
                                          setPlayerForm({
                                            team_id: String(team.id),
                                            roblox_username: "",
                                            roblox_user_id: "",
                                            discord_username: "",
                                            discord_id: "",
                                            role: "Player",
                                          });
                                          scrollToSection("admin");
                                        }}
                                        className="rounded-2xl border border-orange-400/20 bg-orange-400/10 px-4 py-3 text-sm font-semibold text-amber-300 transition duration-200 hover:-translate-y-0.5 hover:bg-orange-400/15 active:translate-y-0.5"
                                      >
                                        Add Player
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() =>
                                          openConfirmDialog({
                                            title: "Remove Team",
                                            message: `Are you sure you want to remove ${team.country}? This action cannot be undone.`,
                                            confirmLabel: "Remove",
                                            onConfirm: () => handleDeleteTeam(team.id),
                                          })
                                        }
                                        className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm font-semibold text-red-300 transition duration-200 hover:-translate-y-0.5 hover:bg-red-400/15 active:translate-y-0.5"
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div>
                        <div className="mb-3 flex items-center justify-between">
                          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-yellow-300">
                            Pending Staff
                          </p>
                          <span className="rounded-full border border-yellow-400/20 bg-yellow-400/10 px-3 py-1 text-xs font-semibold text-yellow-300">
                            {pendingStaff.length}
                          </span>
                        </div>

                        <div className="space-y-4">
                          {pendingStaff.length === 0 ? (
                            <p className="text-white/60">
                              No pending Staff applications.
                            </p>
                          ) : (
                            pendingStaff.map((staff) => (
                              <div
                                key={staff.id}
                                className="rounded-2xl border border-yellow-400/15 bg-yellow-400/[0.04] p-4"
                              >
                                <div className="flex items-start justify-between gap-4">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-3">
                                      <Avatar
                                        robloxUserId={staff.roblox_user_id}
                                        name={staff.roblox_username}
                                      />
                                      <div>
                                        <p className="font-semibold text-white">
                                          {staff.roblox_username}
                                        </p>
                                        <p className="text-sm text-white/70">
                                          @{staff.discord_username}
                                        </p>
                                        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-amber-300">
                                          Pending{" "}
                                          {getStaffRoleLabel(staff.role)}
                                        </p>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleApproveStaffApplication(staff.id)
                                      }
                                      className="rounded-2xl bg-orange-500 px-4 py-2 text-sm font-semibold text-black transition duration-200 hover:-translate-y-0.5 hover:scale-[1.01] active:translate-y-0.5"
                                    >
                                      Approve
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        openConfirmDialog({
                                          title: "Reject Staff Application",
                                          message: `Are you sure you want to reject ${staff.roblox_username}'s ${staff.role} application?`,
                                          confirmLabel: "Reject",
                                          onConfirm: () =>
                                            handleDeleteStaffApplication(
                                              staff.id,
                                            ),
                                        })
                                      }
                                      className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-2 text-sm font-semibold text-red-300 transition duration-200 hover:-translate-y-0.5 hover:bg-red-400/15 active:translate-y-0.5"
                                    >
                                      Reject
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div>
                        <div className="mb-3 flex items-center justify-between">
                          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-300">
                            Approved Staff
                          </p>
                          <span className="rounded-full border border-orange-400/20 bg-orange-400/10 px-3 py-1 text-xs font-semibold text-amber-300">
                            {approvedStaff.length}
                          </span>
                        </div>

                        <div className="space-y-4">
                          {approvedStaff.length === 0 ? (
                            <p className="text-white/60">
                              No approved Staff yet.
                            </p>
                          ) : (
                            approvedStaff.map((staff) => (
                              <div
                                key={staff.id}
                                className="rounded-2xl border border-white/10 bg-white/5 p-4"
                              >
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex min-w-0 items-center gap-3">
                                    <Avatar
                                      robloxUserId={staff.roblox_user_id}
                                      name={staff.roblox_username}
                                    />
                                    <div className="min-w-0">
                                      <p className="font-semibold text-white">
                                        {staff.roblox_username}
                                      </p>
                                      <p className="text-sm text-white/60">
                                        @{staff.discord_username}
                                      </p>
                                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-amber-300">
                                        {staff.role}
                                      </p>
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      openConfirmDialog({
                                        title: "Remove Staff",
                                        message: `Are you sure you want to remove ${staff.roblox_username} from approved staff? Assigned matches will lose this reference.`,
                                        confirmLabel: "Remove",
                                        onConfirm: () =>
                                          handleDeleteStaffApplication(
                                            staff.id,
                                          ),
                                      })
                                    }
                                    className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-2 text-sm font-semibold text-red-300 transition duration-200 hover:-translate-y-0.5 hover:bg-red-400/15 active:translate-y-0.5"
                                  >
                                    Remove
                                  </button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* ── Referee Reputation ───────────────────────────── */}
                      {adminLogged ? (
                        <div>
                          <div className="mb-3 flex items-center justify-between">
                            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-300">
                              Referee Reputation
                            </p>
                            <button
                              type="button"
                              onClick={loadRefereeRatings}
                              className="rounded-full border border-orange-400/20 bg-orange-400/10 px-3 py-1 text-xs font-semibold text-amber-300 transition hover:bg-orange-400/15"
                            >
                              Load Ratings
                            </button>
                          </div>

                          {refereeRatings.length === 0 ? (
                            <p className="text-sm text-white/40">
                              Click "Load Ratings" to see referee evaluations from captains.
                            </p>
                          ) : (() => {
                            // Group ratings by referee
                            const grouped: Record<string, { ratings: any[]; avg: number }> = {};
                            for (const r of refereeRatings) {
                              const key = r.referee_discord_id || "unknown";
                              if (!grouped[key]) grouped[key] = { ratings: [], avg: 0 };
                              grouped[key].ratings.push(r);
                            }
                            for (const key of Object.keys(grouped)) {
                              const sum = grouped[key].ratings.reduce((a: number, r: any) => a + r.rating, 0);
                              grouped[key].avg = sum / grouped[key].ratings.length;
                            }
                            return (
                              <div className="space-y-4">
                                {Object.entries(grouped).map(([discordId, { ratings, avg }]) => (
                                  <div key={discordId} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                    <div className="mb-2 flex items-center justify-between">
                                      <p className="font-semibold text-white">
                                        {discordId}
                                      </p>
                                      <span className="rounded-full bg-amber-400/20 px-3 py-1 text-xs font-bold text-amber-300">
                                        ⭐ {avg.toFixed(1)} / 5 ({ratings.length} vote{ratings.length !== 1 ? "s" : ""})
                                      </span>
                                    </div>
                                    <div className="space-y-2">
                                      {ratings.map((r: any) => (
                                        <div key={r.id} className="rounded-xl border border-white/5 bg-white/5 p-3 text-sm">
                                          <div className="flex items-center gap-2 text-white/70">
                                            <span className="font-semibold text-amber-300">{"⭐".repeat(r.rating)}</span>
                                            <span className="text-white/40">•</span>
                                            <span>Captain {r.captain_discord_id}</span>
                                            {r.matches && (
                                              <>
                                                <span className="text-white/40">•</span>
                                                <span>{r.matches.home_country} vs {r.matches.away_country}</span>
                                              </>
                                            )}
                                          </div>
                                          {r.comment && (
                                            <p className="mt-1 text-white/60 italic">"{r.comment}"</p>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                      ) : null}

                      <div className="rounded-[2rem] border border-yellow-400/15 bg-yellow-400/[0.04] p-6">
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-xl font-bold text-white">Pending transfers</p>
                            <p className="mt-1 text-sm text-white/60">
                              Admin-only clear button for pending /team add transactions mirrored from Discord.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={reloadTeamTransactions}
                            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/75 transition hover:bg-white/10"
                          >
                            Refresh
                          </button>
                        </div>

                        <div className="space-y-3">
                          {teamTransactions.length === 0 ? (
                            <p className="text-sm text-white/55">No pending transfers.</p>
                          ) : (
                            teamTransactions.map((transaction) => (
                              <div key={transaction.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div>
                                    <p className="font-semibold text-white">{transaction.team_name || "Unknown team"}</p>
                                    <p className="mt-1 text-sm text-white/60">
                                      {transaction.player_discord_username || transaction.player_discord_id || "Unknown player"} → {transaction.requested_role || "Player"}
                                    </p>
                                    <p className="mt-1 text-xs text-white/40">
                                      Requested by {transaction.requester_discord_username || transaction.requester_discord_id || "—"}
                                    </p>
                                    <p className="mt-1 text-xs text-white/40">
                                      Created {formatDate(transaction.created_at)}
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    disabled={teamSyncBusy}
                                    onClick={() => handleClearPendingTransfer(transaction)}
                                    className="rounded-2xl border border-yellow-400/25 bg-yellow-400/10 px-4 py-2 text-sm font-semibold text-yellow-200 transition hover:bg-yellow-400/15 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    Clear Transfer
                                  </button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <form
                        onSubmit={handleAddPlayer}
                        className="rounded-[2rem] border border-white/10 bg-[#1C120A] p-6"
                      >
                        <p className="text-xl font-bold">
                          Add player to roster
                        </p>

                        <div className="mt-5 grid gap-4 md:grid-cols-2">
                          <div className="md:col-span-2">
                            <label className="mb-2 block text-sm font-medium text-white/70">
                              Team
                            </label>
                            <SelectPicker
                              value={playerForm.team_id}
                              onChange={(value) =>
                                setPlayerForm((prev) => ({
                                  ...prev,
                                  team_id: value,
                                }))
                              }
                              options={approvedTeams.map((team) => ({
                                label: team.country,
                                value: String(team.id),
                                imageUrl: getFlagUrl(team.code),
                              }))}
                              placeholder="Select approved team"
                            />
                          </div>

                          <div>
                            <label className="mb-2 block text-sm font-medium text-white/70">
                              Roblox Username
                            </label>
                            <input
                              value={playerForm.roblox_username}
                              onChange={(e) =>
                                setPlayerForm((prev) => ({
                                  ...prev,
                                  roblox_username: e.target.value,
                                }))
                              }
                              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none transition duration-200 hover:border-orange-400/30 focus:border-orange-400/40"
                              placeholder="Player Roblox Username"
                            />
                          </div>

                          <div>
                            <label className="mb-2 block text-sm font-medium text-white/70">
                              Discord Username
                            </label>
                            <input
                              value={playerForm.discord_username}
                              onChange={(e) =>
                                setPlayerForm((prev) => ({
                                  ...prev,
                                  discord_username: e.target.value,
                                }))
                              }
                              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none transition duration-200 hover:border-orange-400/30 focus:border-orange-400/40"
                              placeholder="discorduser"
                            />
                          </div>

                          <div>
                            <label className="mb-2 block text-sm font-medium text-white/70">
                              Discord User ID
                            </label>
                            <input
                              value={playerForm.discord_id}
                              onChange={(e) =>
                                setPlayerForm((prev) => ({
                                  ...prev,
                                  discord_id: e.target.value,
                                }))
                              }
                              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none transition duration-200 hover:border-[#5865F2]/40 focus:border-[#5865F2]/50"
                              placeholder="Numeric Discord ID"
                            />
                          </div>

                          <div>
                            <label className="mb-2 block text-sm font-medium text-white/70">
                              Roblox User ID
                            </label>
                            <input
                              value={playerForm.roblox_user_id}
                              onChange={(e) =>
                                setPlayerForm((prev) => ({
                                  ...prev,
                                  roblox_user_id: e.target.value,
                                }))
                              }
                              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none transition duration-200 hover:border-orange-400/30 focus:border-orange-400/40"
                              placeholder="123456789"
                            />
                          </div>

                          <div>
                            <label className="mb-2 block text-sm font-medium text-white/70">
                              Role
                            </label>
                            <SelectPicker
                              value={playerForm.role}
                              onChange={(value) =>
                                setPlayerForm((prev) => ({
                                  ...prev,
                                  role: value as TeamPlayerRole,
                                }))
                              }
                              options={roleOptions}
                              placeholder="Select role"
                            />
                          </div>

                          <div className="md:col-span-2">
                            <button
                              type="submit"
                              className="w-full rounded-2xl bg-orange-500 px-6 py-3 font-semibold text-black transition duration-200 hover:-translate-y-1 hover:scale-[1.01] active:translate-y-0.5"
                            >
                              Add Player
                            </button>
                          </div>
                        </div>
                      </form>

                      <div className="rounded-[1.5rem] border border-white/10 bg-[#1C120A] p-5">
                        <h3 className="text-lg font-bold text-white">
                          Change Team Captain
                        </h3>
                        <p className="mt-1 text-sm text-white/60">
                          Replace the current captain without deleting the team.
                        </p>

                        <form
                          onSubmit={handleChangeCaptain}
                          className="mt-4 space-y-4"
                        >
                          <div>
                            <label className="mb-2 block text-sm font-medium text-white/80">
                              Team
                            </label>
                            <SelectPicker
                              value={captainForm.team_id}
                              onChange={(value) =>
                                setCaptainForm((prev) => ({
                                  ...prev,
                                  team_id: value,
                                }))
                              }
                              options={teams.map((team) => ({
                                label: team.country,
                                value: String(team.id),
                                imageUrl: getFlagUrl(team.code),
                              }))}
                              placeholder="Select a team"
                            />
                          </div>

                          <div>
                            <label className="mb-2 block text-sm font-medium text-white/80">
                              New Captain Name
                            </label>
                            <input
                              type="text"
                              value={captainForm.captain_name}
                              onChange={(event) =>
                                setCaptainForm((prev) => ({
                                  ...prev,
                                  captain_name: event.target.value,
                                }))
                              }
                              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-orange-400/40"
                              placeholder="Roblox username"
                            />
                          </div>

                          <div>
                            <label className="mb-2 block text-sm font-medium text-white/80">
                              New Captain Discord
                            </label>
                            <input
                              type="text"
                              value={captainForm.captain_discord}
                              onChange={(event) =>
                                setCaptainForm((prev) => ({
                                  ...prev,
                                  captain_discord: event.target.value,
                                }))
                              }
                              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-orange-400/40"
                              placeholder="@discorduser"
                            />
                          </div>

                          <div>
                            <label className="mb-2 block text-sm font-medium text-white/80">
                              New Captain Discord User ID
                            </label>
                            <input
                              type="text"
                              value={captainForm.captain_discord_id}
                              onChange={(event) =>
                                setCaptainForm((prev) => ({
                                  ...prev,
                                  captain_discord_id: event.target.value,
                                }))
                              }
                              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-[#5865F2]/50"
                              placeholder="Numeric Discord ID"
                            />
                          </div>

                          <div>
                            <label className="mb-2 block text-sm font-medium text-white/80">
                              New Captain Roblox User ID
                            </label>
                            <input
                              type="text"
                              value={captainForm.captain_roblox_id}
                              onChange={(event) =>
                                setCaptainForm((prev) => ({
                                  ...prev,
                                  captain_roblox_id: event.target.value,
                                }))
                              }
                              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-orange-400/40"
                              placeholder="Numbers only"
                            />
                          </div>

                          <div>
                            <label className="mb-2 block text-sm font-medium text-white/80">
                              Old Captain New Role
                            </label>
                            <SelectPicker
                              value={captainForm.old_captain_new_role}
                              onChange={(value) =>
                                setCaptainForm((prev) => ({
                                  ...prev,
                                  old_captain_new_role: value as TeamPlayerRole,
                                }))
                              }
                              options={roleOptions}
                              placeholder="Select a role"
                            />
                          </div>

                          <button
                            type="submit"
                            disabled={savingCaptainChange}
                            className="rounded-2xl border border-orange-400/30 bg-orange-400/10 px-5 py-3 font-semibold text-amber-300 transition hover:bg-orange-400/15 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {savingCaptainChange
                              ? "Saving..."
                              : "Change Captain"}
                          </button>
                        </form>
                      </div>

                      <div className="rounded-[2rem] border border-white/10 bg-[#1C120A] p-6">
                        <p className="mb-4 text-xl font-bold">
                          Edit team rosters
                        </p>

                        <div className="space-y-4">
                          {approvedTeams.length === 0 ? (
                            <p className="text-white/60">
                              No approved teams yet.
                            </p>
                          ) : (
                            approvedTeams.map((team) => {
                              const players = getPlayersByTeam(team.id);
                              const isOpen = selectedAdminTeamId === team.id;

                              return (
                                <div
                                  key={team.id}
                                  className="rounded-2xl border border-white/10 bg-white/5 p-4"
                                >
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setSelectedAdminTeamId((prev) =>
                                        prev === team.id ? null : team.id,
                                      )
                                    }
                                    className="flex w-full items-center justify-between gap-4 rounded-[1rem] text-left focus:outline-none focus:ring-2 focus:ring-orange-400/40"
                                    aria-expanded={isOpen}
                                    aria-label={
                                      isOpen
                                        ? `Hide roster for ${team.country}`
                                        : `Edit roster for ${team.country}`
                                    }
                                  >
                                    <div className="flex items-center gap-3">
                                      <img
                                        src={getFlagUrl(team.code)}
                                        alt={`${team.country} flag`}
                                        className="h-8 w-11 rounded-md object-cover"
                                      />
                                      <div>
                                        <p className="font-semibold text-white">
                                          {team.country}
                                        </p>
                                        <p className="text-sm text-white/55">
                                          {players.length +
                                            (team.captain_name?.trim() &&
                                            team.captain_discord?.trim() &&
                                            String(
                                              team.captain_roblox_id || "",
                                            ).trim()
                                              ? 1
                                              : 0)}{" "}
                                          roster members
                                        </p>
                                      </div>
                                    </div>

                                    <span className="text-sm text-amber-300">
                                      {isOpen ? "Hide roster" : "Edit roster"}
                                    </span>
                                  </button>

                                  {isOpen ? (
                                    <div className="mt-4 space-y-3">
                                      <div className="rounded-2xl border border-white/10 bg-[#170F08] p-3">
                                        <div className="flex items-center gap-3">
                                          <Avatar
                                            robloxUserId={
                                              team.captain_roblox_id
                                            }
                                            name={team.captain_name}
                                          />
                                          <div>
                                            <p className="font-semibold text-white">
                                              {team.captain_name}
                                            </p>
                                            <p className="text-sm text-white/60">
                                              @{team.captain_discord}
                                            </p>
                                          </div>
                                          <span className="ml-auto rounded-full border border-orange-400/20 bg-orange-400/10 px-3 py-1 text-xs font-semibold text-amber-300">
                                            Captain
                                          </span>
                                        </div>
                                      </div>

                                      {players.length === 0 ? (
                                        <p className="text-sm text-white/60">
                                          No extra players added yet.
                                        </p>
                                      ) : (
                                        players.map((player) => (
                                          <div
                                            key={player.id}
                                            className="rounded-2xl border border-white/10 bg-[#170F08] p-4"
                                          >
                                            <div className="grid gap-3 md:grid-cols-2">
                                              <input
                                                defaultValue={
                                                  player.roblox_username
                                                }
                                                onBlur={(e) =>
                                                  handleUpdatePlayer(
                                                    player.id,
                                                    {
                                                      roblox_username:
                                                        e.target.value.trim(),
                                                    },
                                                  )
                                                }
                                                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none"
                                                placeholder="Roblox Username"
                                              />

                                              <input
                                                defaultValue={
                                                  player.discord_username
                                                }
                                                onBlur={(e) =>
                                                  handleUpdatePlayer(
                                                    player.id,
                                                    {
                                                      discord_username:
                                                        e.target.value
                                                          .trim()
                                                          .replace(/^@/, ""),
                                                    },
                                                  )
                                                }
                                                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none"
                                                placeholder="Discord Username"
                                              />

                                              <input
                                                defaultValue={
                                                  player.roblox_user_id
                                                }
                                                onBlur={(e) =>
                                                  handleUpdatePlayer(
                                                    player.id,
                                                    {
                                                      roblox_user_id:
                                                        e.target.value.trim(),
                                                    },
                                                  )
                                                }
                                                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none"
                                                placeholder="Roblox User ID"
                                              />

                                              <select
                                                defaultValue={player.role}
                                                onChange={(e) =>
                                                  handleUpdatePlayer(
                                                    player.id,
                                                    {
                                                      role: e.target
                                                        .value as TeamPlayerRole,
                                                    },
                                                  )
                                                }
                                                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none"
                                              >
                                                <option value="Vice Captain">
                                                  Vice Captain
                                                </option>
                                                <option value="Court Captain">
                                                  Court Captain
                                                </option>
                                                <option value="Player">
                                                  Player
                                                </option>
                                              </select>
                                            </div>

                                            <div className="mt-3 flex justify-end">
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  openConfirmDialog({
                                                    title: "Remove Player",
                                                    message: `Are you sure you want to remove ${player.roblox_username} from the roster?`,
                                                    confirmLabel: "Remove",
                                                    onConfirm: () =>
                                                      handleDeletePlayer(
                                                        player.id,
                                                      ),
                                                  })
                                                }
                                                className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-2 text-sm font-semibold text-red-300 transition duration-200 hover:bg-red-400/15"
                                              >
                                                Remove Player
                                              </button>
                                            </div>
                                          </div>
                                        ))
                                      )}
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  </div>
                </div>

                <div id="admin-matches" className="scroll-mt-28 rounded-[2rem] border border-white/10 bg-[#1C120A] p-6">
                  <div className="mb-6">
                    <p className="text-sm font-semibold uppercase tracking-[0.25em] text-amber-300">
                      Matches & stats review
                    </p>
                    <h2 className="mt-2 text-2xl font-black text-white">
                      Manage match results
                    </h2>
                    <p className="mt-2 text-sm text-white/60">
                      Filter matches, assign staff, update scores, review submitted stats, and finalize results.
                    </p>
                  </div>
                  <p className="mb-4 text-xl font-bold">Manage matches</p>
                    <div className="space-y-4">
                      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                        <div className="flex flex-col gap-4 md:flex-row md:items-end">
                          <div className="min-w-[220px]">
                            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
                              Filter by status
                            </label>
                            <SelectPicker
                              value={adminFilterStatus}
                              onChange={(value) =>
                                setAdminFilterStatus(
                                  value as "All" | MatchStatus,
                                )
                              }
                              options={[
                                { label: "All statuses", value: "All" },
                                ...statusOptions,
                              ]}
                              placeholder="Select status"
                            />
                          </div>

                          <div className="min-w-[240px]">
                            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
                              Filter by stage
                            </label>
                            <SelectPicker
                              value={adminFilterStage}
                              onChange={setAdminFilterStage}
                              options={[
                                { label: "All stages", value: "All" },
                                ...availableStages.map((stage) => ({
                                  label: stage,
                                  value: stage,
                                })),
                              ]}
                              placeholder="Select stage"
                            />
                          </div>
                        </div>
                      </div>
                      {statTrackMatches.length === 0 ? (
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/60">
                          No matches found with the selected filters.
                        </div>
                      ) : (
                        statTrackMatches.map((match) => {
                          const draft = matchDrafts[match.id];

                          return (
                            <div
                              key={match.id}
                              className={`rounded-2xl border p-4 ${
                                match.stats_finalized
                                  ? "border-orange-400/30 bg-orange-400/10"
                                  : "border-red-400/30 bg-red-400/10"
                              }`}
                            >
                              <div className="grid gap-4">
                                <div className="flex flex-wrap items-center gap-3">
                                  {draft?.stage || match.stage ? (
                                    <span className="rounded-full border border-orange-400/20 bg-orange-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">
                                      {draft?.stage || match.stage}
                                    </span>
                                  ) : null}

                                  <span className="font-semibold">
                                    {match.home_country} vs {match.away_country}
                                  </span>
                                  <span
                                    className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${getStatusBadgeClass(draft?.status ?? match.status)}`}
                                  >
                                    {draft?.status ?? match.status}
                                  </span>
                                  <span
                                    className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${
                                      match.stats_finalized
                                        ? "border-orange-400/30 bg-orange-400/10 text-amber-300"
                                        : "border-red-400/30 bg-red-400/10 text-red-300"
                                    }`}
                                  >
                                    {match.stats_finalized ? "Stats finalized" : "Stats not finalized"}
                                  </span>

                                  {match.stats_submitted_for_review &&
                                  !match.stats_finalized ? (
                                    <span className="rounded-full border border-yellow-400/30 bg-yellow-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-yellow-300">
                                      Waiting admin review
                                    </span>
                                  ) : null}
                                </div>

                                <div>
                                  <label className="mb-2 block text-sm text-white/70">
                                    Stage
                                  </label>
                                  <input
                                    type="text"
                                    disabled={!adminLogged}
                                    value={draft?.stage ?? match.stage ?? ""}
                                    onChange={(e) =>
                                      updateMatchDraft(match.id, {
                                        stage: e.target.value,
                                      })
                                    }
                                    className="w-full rounded-2xl border border-white/10 bg-[#1C120A] px-4 py-3 outline-none transition duration-200 hover:border-orange-400/30"
                                    placeholder="Semifinals"
                                  />
                                </div>

                                <div className="grid gap-3 md:grid-cols-2">
                                  <div>
                                    <label className="mb-2 block text-sm text-white/70">
                                      Status
                                    </label>
                                    <SelectPicker
                                      value={draft?.status ?? match.status}
                                      onChange={(value) =>
                                        updateMatchDraft(match.id, {
                                          status: value as MatchStatus,
                                        })
                                      }
                                      options={statusOptions}
                                      placeholder="Select status"
                                      disabled={!adminLogged}
                                    />
                                  </div>

                                  <div>
                                    <label className="mb-2 block text-sm text-white/70">
                                      Date
                                    </label>
                                    <input
                                      type="date"
                                      disabled={!adminLogged}
                                      value={
                                        draft?.match_date ?? match.match_date
                                      }
                                      onChange={(e) =>
                                        updateMatchDraft(match.id, {
                                          match_date: e.target.value,
                                        })
                                      }
                                      className="w-full rounded-2xl border border-white/10 bg-[#1C120A] px-4 py-3 outline-none transition duration-200 hover:border-orange-400/30"
                                    />
                                  </div>

                                  <div>
                                    <label className="mb-2 block text-sm text-white/70">
                                      Time
                                    </label>
                                    <input
                                      type="time"
                                      disabled={!adminLogged}
                                      value={
                                        draft?.match_time ?? match.match_time
                                      }
                                      onChange={(e) =>
                                        updateMatchDraft(match.id, {
                                          match_time: e.target.value,
                                        })
                                      }
                                      className="w-full rounded-2xl border border-white/10 bg-[#1C120A] px-4 py-3 outline-none transition duration-200 hover:border-orange-400/30"
                                    />
                                  </div>

                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <label className="mb-2 block text-sm text-white/70">
                                        {match.home_country}
                                      </label>
                                      <input
                                        type="number"
                                        min="0"
                                        disabled={
                                          !adminLogged &&
                                          !canCurrentStatTrackerEditMatch(
                                            match,
                                          )
                                        }
                                        value={
                                          draft?.home_score ?? match.home_score
                                        }
                                        onChange={(e) =>
                                          updateMatchDraft(match.id, {
                                            home_score: Number(e.target.value),
                                          })
                                        }
                                        className="w-full rounded-2xl border border-white/10 bg-[#1C120A] px-4 py-3 outline-none transition duration-200 hover:border-orange-400/30"
                                      />
                                    </div>
                                    <div>
                                      <label className="mb-2 block text-sm text-white/70">
                                        {match.away_country}
                                      </label>
                                      <input
                                        type="number"
                                        min="0"
                                        disabled={
                                          !adminLogged &&
                                          !canCurrentStatTrackerEditMatch(
                                            match,
                                          )
                                        }
                                        value={
                                          draft?.away_score ?? match.away_score
                                        }
                                        onChange={(e) =>
                                          updateMatchDraft(match.id, {
                                            away_score: Number(e.target.value),
                                          })
                                        }
                                        className="w-full rounded-2xl border border-white/10 bg-[#1C120A] px-4 py-3 outline-none transition duration-200 hover:border-orange-400/30"
                                      />
                                    </div>
                                  </div>
                                  <div>
                                    <label className="mb-2 block text-sm text-white/70">
                                      Referee
                                    </label>
                                    <SelectPicker
                                      value={
                                        draft?.referee_id
                                          ? String(draft.referee_id)
                                          : ""
                                      }
                                      onChange={(value) =>
                                        updateMatchDraft(match.id, {
                                          referee_id: value
                                            ? Number(value)
                                            : null,
                                        })
                                      }
                                      options={refereeOptions}
                                      placeholder="Select referee"
                                      disabled={!adminLogged}
                                    />
                                  </div>

                                  <div>
                                    <label className="mb-2 block text-sm text-white/70">
                                      Media
                                    </label>
                                    <SelectPicker
                                      value={
                                        draft?.media_id
                                          ? String(draft.media_id)
                                          : ""
                                      }
                                      onChange={(value) =>
                                        updateMatchDraft(match.id, {
                                          media_id: value
                                            ? Number(value)
                                            : null,
                                        })
                                      }
                                      options={mediaOptions}
                                      placeholder="Select media"
                                      disabled={!adminLogged}
                                    />
                                  </div>

                                  <div>
                                    <label className="mb-2 block text-sm font-semibold text-white/70">
                                      Stat Tracker
                                    </label>

                                    <SelectPicker
                                      value={
                                        matchDrafts[match.id]?.stat_tracker_id
                                          ? String(
                                              matchDrafts[match.id]
                                                .stat_tracker_id,
                                            )
                                          : ""
                                      }
                                      onChange={(value) =>
                                        updateMatchDraft(match.id, {
                                          stat_tracker_id: value
                                            ? Number(value)
                                            : null,
                                        })
                                      }
                                      options={[
                                        { label: "No Stat Tracker", value: "" },
                                        ...statTrackerOptions,
                                      ]}
                                      placeholder="Select Stat Tracker"
                                      disabled={!adminLogged}
                                    />
                                  </div>
                                </div>
                                {getStaffById(draft?.referee_id ?? match.referee_id) ||
                                getStaffById(draft?.media_id ?? match.media_id) ||
                                getStaffById(draft?.stat_tracker_id ?? match.stat_tracker_id) ? (
                                  <div className="rounded-2xl border border-white/10 bg-[#170F08] p-4">
                                    <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-amber-300">
                                      Assigned Match Staff
                                    </p>

                                    <div className="space-y-3">
                                      {getStaffById(
                                        draft?.referee_id ?? match.referee_id,
                                      ) ? (
                                        <div className="flex items-center gap-3">
                                          <Avatar
                                            robloxUserId={
                                              getStaffById(
                                                draft?.referee_id ??
                                                  match.referee_id,
                                              )!.roblox_user_id
                                            }
                                            name={
                                              getStaffById(
                                                draft?.referee_id ??
                                                  match.referee_id,
                                              )!.roblox_username
                                            }
                                          />
                                          <div>
                                            <p className="font-semibold text-white">
                                              Referee:{" "}
                                              {
                                                getStaffById(
                                                  draft?.referee_id ??
                                                    match.referee_id,
                                                )!.roblox_username
                                              }
                                            </p>
                                            <p className="text-sm text-white/60">
                                              @
                                              {
                                                getStaffById(
                                                  draft?.referee_id ??
                                                    match.referee_id,
                                                )!.discord_username
                                              }
                                            </p>
                                          </div>
                                        </div>
                                      ) : null}

                                      {getStaffById(
                                        draft?.media_id ?? match.media_id,
                                      ) ? (
                                        <div className="flex items-center gap-3">
                                          <Avatar
                                            robloxUserId={
                                              getStaffById(
                                                draft?.media_id ??
                                                  match.media_id,
                                              )!.roblox_user_id
                                            }
                                            name={
                                              getStaffById(
                                                draft?.media_id ??
                                                  match.media_id,
                                              )!.roblox_username
                                            }
                                          />
                                          <div>
                                            <p className="font-semibold text-white">
                                              Media:{" "}
                                              {
                                                getStaffById(
                                                  draft?.media_id ??
                                                    match.media_id,
                                                )!.roblox_username
                                              }
                                            </p>
                                            <p className="text-sm text-white/60">
                                              @
                                              {
                                                getStaffById(
                                                  draft?.media_id ??
                                                    match.media_id,
                                                )!.discord_username
                                              }
                                            </p>
                                          </div>
                                        </div>
                                      ) : null}
                                      {getStaffById(
                                        draft?.stat_tracker_id ??
                                          match.stat_tracker_id,
                                      ) ? (
                                        <div className="flex items-center gap-3">
                                          <Avatar
                                            robloxUserId={
                                              getStaffById(
                                                draft?.stat_tracker_id ??
                                                  match.stat_tracker_id,
                                              )!.roblox_user_id
                                            }
                                            name={
                                              getStaffById(
                                                draft?.stat_tracker_id ??
                                                  match.stat_tracker_id,
                                              )!.roblox_username
                                            }
                                          />

                                          <div>
                                            <p className="font-semibold text-white">
                                              Stat Tracker:{" "}
                                              {
                                                getStaffById(
                                                  draft?.stat_tracker_id ??
                                                    match.stat_tracker_id,
                                                )!.roblox_username
                                              }
                                            </p>
                                            <p className="text-sm text-white/60">
                                              @
                                              {
                                                getStaffById(
                                                  draft?.stat_tracker_id ??
                                                    match.stat_tracker_id,
                                                )!.discord_username
                                              }
                                            </p>
                                          </div>
                                        </div>
                                      ) : null}
                                    </div>
                                  </div>
                                ) : null}

                                {adminLogged ? (
                                  <label className="flex items-start gap-3 rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-4 text-sm text-yellow-100">
                                  <input
                                    type="checkbox"
                                    disabled={false}
                                    checked={Boolean(
                                      matchDrafts[match.id]?.is_star_match,
                                    )}
                                    onChange={(event) =>
                                      updateMatchDraft(match.id, {
                                        is_star_match: event.target.checked,
                                      })
                                    }
                                    className="mt-1 h-4 w-4 rounded border-yellow-400/30 bg-transparent accent-yellow-400"
                                  />

                                  <span>
                                    <span className="block font-semibold text-yellow-300">
                                      Star Match
                                    </span>
                                    Highlight this match in the public schedule.
                                  </span>
                                </label>
                               ) : null}

                                {adminLogged ? (
                                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                    <p className="mb-3 text-sm font-semibold text-white/70">
                                      Pickems Format
                                    </p>
                                    <div className="flex gap-2">
                                      {([3, 5] as const).map((option) => (
                                        <button
                                          key={option}
                                          type="button"
                                          onClick={() =>
                                            updateMatchDraft(match.id, {
                                              best_of: option,
                                            })
                                          }
                                          className={`flex-1 rounded-2xl border px-4 py-2 text-sm font-semibold transition duration-200 ${
                                            (matchDrafts[match.id]?.best_of ?? 3) === option
                                              ? "border-orange-400/60 bg-orange-500/20 text-orange-200"
                                              : "border-white/10 bg-white/5 text-white/60 hover:border-orange-400/30"
                                          }`}
                                        >
                                          Bo{option}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                ) : null}

                                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                  <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-amber-300">
                                    Set Results
                                  </p>
                                  <p className="mt-3 text-xs text-white/55">
                                    Set scores preview:{" "}
                                    {formatSetScores({
                                      set1_home:
                                        matchDrafts[match.id]?.set1_home ??
                                        null,
                                      set1_away:
                                        matchDrafts[match.id]?.set1_away ??
                                        null,
                                      set2_home:
                                        matchDrafts[match.id]?.set2_home ??
                                        null,
                                      set2_away:
                                        matchDrafts[match.id]?.set2_away ??
                                        null,
                                      set3_home:
                                        matchDrafts[match.id]?.set3_home ??
                                        null,
                                      set3_away:
                                        matchDrafts[match.id]?.set3_away ??
                                        null,
                                      set4_home:
                                        matchDrafts[match.id]?.set4_home ??
                                        null,
                                      set4_away:
                                        matchDrafts[match.id]?.set4_away ??
                                        null,
                                      set5_home:
                                        matchDrafts[match.id]?.set5_home ??
                                        null,
                                      set5_away:
                                        matchDrafts[match.id]?.set5_away ??
                                        null,
                                    }) || "-"}
                                  </p>

                                  <div className="grid gap-4 md:grid-cols-5">
                                    {(
                                      [
                                        {
                                          label: "Set 1",
                                          homeField: "set1_home",
                                          awayField: "set1_away",
                                        },
                                        {
                                          label: "Set 2",
                                          homeField: "set2_home",
                                          awayField: "set2_away",
                                        },
                                        {
                                          label: "Set 3",
                                          homeField: "set3_home",
                                          awayField: "set3_away",
                                        },
                                        {
                                          label: "Set 4",
                                          homeField: "set4_home",
                                          awayField: "set4_away",
                                        },
                                        {
                                          label: "Set 5",
                                          homeField: "set5_home",
                                          awayField: "set5_away",
                                        },
                                      ] as const
                                    ).map((setItem) => (
                                      <div
                                        key={setItem.label}
                                        className="rounded-2xl border border-white/10 bg-[#170F08] p-3"
                                      >
                                        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-white/50">
                                          {setItem.label}
                                        </p>

                                        <div className="grid grid-cols-2 gap-2">
                                          <input
                                            type="number"
                                            min="0"
                                            placeholder="Home"
                                            disabled={
                                              match.stats_finalized ||
                                              (!adminLogged &&
                                                !canCurrentStatTrackerEditMatch(
                                                  match,
                                                ))
                                            }
                                            value={
                                              matchDrafts[match.id]?.[
                                                setItem.homeField
                                              ] ?? ""
                                            }
                                            onChange={(e) =>
                                              updateMatchDraftNumber(
                                                match.id,
                                                setItem.homeField,
                                                e.target.value,
                                              )
                                            }
                                            className="h-14 w-full rounded-2xl border border-white/10 bg-white/5 px-3 text-center text-white placeholder:text-white/25 outline-none transition duration-200 hover:border-orange-400/30 focus:border-orange-400/40 disabled:cursor-not-allowed disabled:opacity-50"
                                          />

                                          <input
                                            type="number"
                                            min="0"
                                            placeholder="Away"
                                            disabled={
                                              match.stats_finalized ||
                                              (!adminLogged && !canCurrentStatTrackerEditMatch(match))
                                            }
                                            value={
                                              matchDrafts[match.id]?.[
                                                setItem.awayField
                                              ] ?? ""
                                            }
                                            onChange={(e) =>
                                              updateMatchDraftNumber(
                                                match.id,
                                                setItem.awayField,
                                                e.target.value,
                                              )
                                            }
                                            className="h-14 w-full rounded-2xl border border-white/10 bg-white/5 px-3 text-center text-white placeholder:text-white/25 outline-none transition duration-200 hover:border-orange-400/30 focus:border-orange-400/40 disabled:cursor-not-allowed disabled:opacity-50"
                                          />
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                <div className="flex flex-wrap gap-3">
                                  {/* Start Match button — visible to admin and referee assigned to this match,
                                      only when status is Scheduled */}
                                  {match.status === "Scheduled" && (adminLogged || refereeLogged) ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setStartMatchModal({ matchId: match.id, home: match.home_country, away: match.away_country });
                                        setStartMatchLink("");
                                        setStartStreamLink("");
                                        setStartStreamer("");
                                      }}
                                      className="rounded-2xl bg-green-500 px-4 py-2 text-sm font-semibold text-black transition duration-200 hover:-translate-y-0.5 hover:scale-[1.01] active:translate-y-0.5"
                                    >
                                      ▶ Start Match
                                    </button>
                                  ) : null}

                                  {adminLogged ||
                                  canCurrentStatTrackerEditMatch(match) ? (
                                    <button
                                      type="button"
                                      onClick={() => saveMatchDraft(match.id)}
                                      className="rounded-2xl bg-orange-500 px-4 py-2 text-sm font-semibold text-black transition duration-200 hover:-translate-y-0.5 hover:scale-[1.01] active:translate-y-0.5"
                                    >
                                      Save Changes
                                    </button>
                                  ) : null}

                                  {canCurrentStatTrackerEditMatch(match) &&
                                  !match.stats_finalized ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        openConfirmDialog({
                                          title: "Submit Stats",
                                          message: `Send stats for ${match.home_country} vs ${match.away_country} to Admin review?`,
                                          confirmLabel: "Submit Stats",
                                          onConfirm: () =>
                                            submitStatsForReview(match.id),
                                        })
                                      }
                                      className="rounded-2xl border border-yellow-400/20 bg-yellow-400/10 px-4 py-2 text-sm font-semibold text-yellow-300 transition duration-200 hover:-translate-y-0.5 hover:bg-yellow-400/15 active:translate-y-0.5"
                                    >
                                      Submit Stats
                                    </button>
                                  ) : null}

                                  {adminLogged && !match.stats_finalized ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        openConfirmDialog({
                                          title: "Finish Stats",
                                          message: `Are you sure you want to finish stats for ${match.home_country} vs ${match.away_country}? After this, the stats cannot be edited.`,
                                          confirmLabel: "Finish Stats",
                                          onConfirm: () =>
                                            finishStats(match.id),
                                        })
                                      }
                                      className="rounded-2xl border border-orange-400/20 bg-orange-400/10 px-4 py-2 text-sm font-semibold text-amber-300 transition duration-200 hover:-translate-y-0.5 hover:bg-orange-400/15 active:translate-y-0.5"
                                    >
                                      Finish Stats
                                    </button>
                                  ) : null}

                                  {adminLogged ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        openConfirmDialog({
                                          title: "Delete Match",
                                          message: `Are you sure you want to delete ${match.home_country} vs ${match.away_country}?`,
                                          confirmLabel: "Delete",
                                          onConfirm: () =>
                                            handleDeleteMatch(match.id),
                                        })
                                      }
                                      className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-2 text-sm font-semibold text-red-300 transition duration-200 hover:-translate-y-0.5 hover:bg-red-400/15 active:translate-y-0.5"
                                    >
                                      Delete Match
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>

                {adminLogged ? (
                  <div id="admin-users" className="scroll-mt-28 rounded-[2rem] border border-white/10 bg-[#1C120A] p-6">
                    <div className="mb-6">
                      <p className="text-sm font-semibold uppercase tracking-[0.25em] text-amber-300">
                        Discord-based access
                      </p>
                      <h2 className="mt-2 text-2xl font-black text-white">
                        Users &amp; Roles
                      </h2>
                      <p className="mt-2 max-w-2xl text-sm text-white/60">
                        Anyone who has logged in with Discord on the site shows up here. The Owner and anyone
                        with the <strong>Administrator</strong> permission in the Discord server always have full
                        access automatically. Use the toggles below to grant extra roles to anyone else:{" "}
                        <strong>Administrator</strong> (full panel access), <strong>Stat Tracker</strong>,{" "}
                        <strong>Referee</strong>, or <strong>Media</strong>.
                      </p>
                    </div>

                    {!sortedSiteUsers ? (
                      <p className="text-sm text-white/50">Loading users…</p>
                    ) : sortedSiteUsers.length === 0 ? (
                      <p className="text-sm text-white/50">Nobody has logged in with Discord yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {sortedSiteUsers.map((u) => (
                          <div
                            key={u.id}
                            className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:flex-row md:items-center md:justify-between"
                          >
                            <div className="flex items-center gap-3">
                              {u.avatar_url ? (
                                <img src={u.avatar_url} alt="" className="h-10 w-10 rounded-full border border-white/10 object-cover" />
                              ) : (
                                <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/10 text-sm">
                                  {(u.discord_global_name || u.discord_username || "?").slice(0, 1).toUpperCase()}
                                </span>
                              )}
                              <div>
                                <p className="font-semibold text-white">
                                  {u.discord_global_name || u.discord_username || u.discord_id}
                                </p>
                                <p className="text-xs text-white/40">{u.discord_id}</p>
                              </div>
                              {u.isOwner ? (
                                <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-amber-300">
                                  Owner
                                </span>
                              ) : null}
                            </div>

                            {u.isOwner ? (
                              <p className="text-xs text-white/40">Always has full access — nothing to toggle.</p>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {(["administrator", "stat_tracker", "referee", "media"] as const).map((role) => {
                                  const active = u.roles.includes(role);
                                  const labels: Record<string, string> = {
                                    administrator: "Administrator",
                                    stat_tracker: "Stat Tracker",
                                    referee: "Referee",
                                    media: "Media",
                                  };

                                  // Only the Owner can grant or revoke the Administrator role
                                  const isAdminRole = role === "administrator";
                                  const currentUserIsOwner = siteAccess?.isOwner === true;
                                  if (isAdminRole && !currentUserIsOwner) {
                                    return (
                                      <span
                                        key={role}
                                        title="Only the Owner can grant or revoke Administrator"
                                        className={`cursor-not-allowed select-none rounded-2xl border px-3 py-2 text-xs font-semibold opacity-40 ${
                                          active
                                            ? "border-orange-400/30 bg-orange-400/15 text-amber-300"
                                            : "border-white/10 bg-white/5 text-white/60"
                                        }`}
                                      >
                                        {active ? `✓ ${labels[role]}` : labels[role]}
                                      </span>
                                    );
                                  }

                                  return (
                                    <button
                                      key={role}
                                      type="button"
                                      disabled={siteUsersBusyId === u.id}
                                      onClick={() => toggleSiteRole(u, role)}
                                      className={`rounded-2xl border px-3 py-2 text-xs font-semibold transition duration-200 disabled:opacity-50 ${
                                        active
                                          ? "border-orange-400/30 bg-orange-400/15 text-amber-300 hover:bg-orange-400/20"
                                          : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                                      }`}
                                    >
                                      {active ? `✓ ${labels[role]}` : labels[role]}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}

              </div>
            )}
          </div>
        </section>

      </main>

      <footer className="border-t border-white/10 bg-[#160E08]">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-8 text-sm text-white/60 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-semibold text-white">NVL Admin</p>
            <p>National Volleyball League Control Center</p>
          </div>

          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-orange-400/10 bg-orange-500/[0.06] p-2 backdrop-blur-sm">
            <Link
              href="/"
              className="rounded-xl px-2 py-1 text-sm text-white/80 transition duration-200 hover:-translate-y-0.5 hover:bg-white/10 hover:text-white active:translate-y-0.5"
            >
              Public Site
            </Link>
            <Link
              href="/stats"
              className="rounded-xl px-2 py-1 text-sm text-white/80 transition duration-200 hover:-translate-y-0.5 hover:bg-white/10 hover:text-white active:translate-y-0.5"
            >
              Stats
            </Link>
            <Link
              href="/archives"
              className="rounded-xl px-2 py-1 text-sm text-white/80 transition duration-200 hover:-translate-y-0.5 hover:bg-white/10 hover:text-white active:translate-y-0.5"
            >
              Archives
            </Link>
            <Link
              href="/matchmaking"
              className="rounded-xl px-2 py-1 text-sm text-white/80 transition duration-200 hover:-translate-y-0.5 hover:bg-white/10 hover:text-white active:translate-y-0.5"
            >
              Matchmaking
            </Link>
            <Link
              href="/pickems"
              className="rounded-xl px-2 py-1 text-sm text-white/80 transition duration-200 hover:-translate-y-0.5 hover:bg-white/10 hover:text-white active:translate-y-0.5"
            >
              Pickems
            </Link>
            <Link
              href="/profile"
              className="rounded-xl px-2 py-1 text-sm text-white/80 transition duration-200 hover:-translate-y-0.5 hover:bg-white/10 hover:text-white active:translate-y-0.5"
            >
              Profile
            </Link>
          </div>
        </div>
      </footer>
      {adminNotice ? (
        <div className="fixed inset-x-4 bottom-6 z-[100] mx-auto flex max-w-md justify-center sm:inset-x-0">
          <div className="w-full rounded-2xl border border-orange-400/25 bg-[#21150A] px-5 py-4 text-center text-sm font-medium text-amber-200 shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
            {adminNotice}
          </div>
        </div>
      ) : null}
      {successDialog.open ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[2rem] border border-orange-400/25 bg-[#21150A] p-6 shadow-[0_20px_80px_rgba(249,115,22,0.18)]">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-orange-400/25 bg-orange-400/15">
                <svg
                  viewBox="0 0 24 24"
                  className="h-6 w-6 text-amber-300"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="text-xl font-black text-white">
                  {successDialog.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-white/75">
                  {successDialog.message}
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() =>
                  setSuccessDialog({
                    open: false,
                    title: "",
                    message: "",
                  })
                }
                className="rounded-2xl bg-orange-500 px-5 py-3 text-sm font-semibold text-black transition duration-200 hover:-translate-y-0.5 hover:scale-[1.01] active:translate-y-0"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {confirmDialog.open ? (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/55 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[2rem] border border-red-400/20 bg-[#21150A] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
            <h3 className="text-xl font-black text-white">
              {confirmDialog.title}
            </h3>
            <p className="mt-3 text-sm leading-6 text-white/75">
              {confirmDialog.message}
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() =>
                  setConfirmDialog({
                    open: false,
                    title: "",
                    message: "",
                    confirmLabel: "Confirm",
                    onConfirm: null,
                  })
                }
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition duration-200 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-orange-400/40"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={async () => {
                  const action = confirmDialog.onConfirm;
                  setConfirmDialog({
                    open: false,
                    title: "",
                    message: "",
                    confirmLabel: "Confirm",
                    onConfirm: null,
                  });
                  if (action) await action();
                }}
                className="rounded-2xl border border-red-400/20 bg-red-400/10 px-5 py-3 text-sm font-semibold text-red-300 transition duration-200 hover:bg-red-400/15 focus:outline-none focus:ring-2 focus:ring-red-400/40"
              >
                {confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Start Match Modal ────────────────────────────────────────── */}
      {startMatchModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#111] p-6 shadow-2xl">
            <h2 className="mb-1 text-lg font-bold text-white">Start Match</h2>
            <p className="mb-4 text-sm text-white/50">
              {startMatchModal.home} vs {startMatchModal.away}
            </p>

            <div className="mb-3">
              <label className="mb-1 block text-xs font-semibold text-white/70">
                Match Link <span className="text-red-400">*</span>
              </label>
              <input
                type="url"
                placeholder="https://www.roblox.com/games/..."
                value={startMatchLink}
                onChange={(e) => setStartMatchLink(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-orange-400/50"
              />
            </div>

            <div className="mb-3">
              <label className="mb-1 block text-xs font-semibold text-white/70">
                Live Stream Link <span className="text-white/30">(optional)</span>
              </label>
              <input
                type="url"
                placeholder="https://www.youtube.com/watch?v=..."
                value={startStreamLink}
                onChange={(e) => setStartStreamLink(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-orange-400/50"
              />
            </div>

            <div className="mb-5">
              <label className="mb-1 block text-xs font-semibold text-white/70">
                Streamer Discord ID <span className="text-white/30">(optional — numbers only)</span>
              </label>
              <input
                type="text"
                placeholder="123456789012345678"
                value={startStreamer}
                onChange={(e) => setStartStreamer(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-orange-400/50"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStartMatchModal(null)}
                className="flex-1 rounded-xl border border-white/10 py-2 text-sm text-white/60 transition hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStartMatch}
                disabled={startMatchLoading}
                className="flex-1 rounded-xl bg-green-500 py-2 text-sm font-semibold text-black transition hover:bg-green-400 disabled:opacity-50"
              >
                {startMatchLoading ? "Starting…" : "Start & Notify Discord"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}