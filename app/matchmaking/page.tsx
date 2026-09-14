"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";

type LeaderboardRow = {
  discord_id: string;
  display_name: string | null;
  avatar_url: string | null;
  elo: number;
  matches: number;
  wins: number;
  losses: number;
  win_mvp: number;
  vip_tier: "vip" | "vip_plus" | null;
};

type LeaderboardResponse = {
  leaderboard: LeaderboardRow[];
  activeSeason: { number: number; started_at: string | null } | null;
  finishedMatches: number;
};

const TIERS: {
  key: "vip" | "vip_plus";
  name: string;
  price: string;
  accent: string;
  perks: string[];
}[] = [
  {
    key: "vip",
    name: "VIP",
    price: "R$ 5.00",
    accent: "from-orange-400 to-orange-600",
    perks: [
      "+10% ELO gained on wins",
      "Exclusive Discord role + VIP badge on the leaderboard",
      "Access to the VIP queue channel - wins there are worth 2x ELO",
    ],
  },
  {
    key: "vip_plus",
    name: "VIP+",
    price: "R$ 10.00",
    accent: "from-amber-300 to-amber-500",
    perks: [
      "+20% ELO gained on wins",
      "Priority queue join - take any position, even a full one, while the queue isn't full and picks haven't started",
      "Exclusive Discord role + VIP badge on the leaderboard",
      "Access to the VIP queue channel - wins there are worth 2x ELO",
    ],
  },
];

function vipBadge(tier: "vip" | "vip_plus" | null) {
  if (!tier) return null;
  const isPlus = tier === "vip_plus";
  return (
    <span
      className={`ml-2 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
        isPlus
          ? "border-amber-400/30 bg-amber-400/10 text-amber-300"
          : "border-orange-400/30 bg-orange-400/10 text-amber-300"
      }`}
    >
      {isPlus ? "VIP+" : "VIP"}
    </span>
  );
}

export default function MatchmakingPage() {
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [discordId, setDiscordId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loadingTier, setLoadingTier] = useState<"vip" | "vip_plus" | null>(null);
  const [checkoutNotice, setCheckoutNotice] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/matchmaking/leaderboard");
        const json = await res.json();
        setData(json);
      } catch {
        setData({ leaderboard: [], activeSeason: null, finishedMatches: 0 });
      } finally {
        setLoading(false);
      }
    }
    load();

    const params = new URLSearchParams(window.location.search);
    if (params.get("vip") === "success") {
      setCheckoutNotice("Payment confirmed! Your VIP is activated as soon as Stripe confirms it (may take a few moments) and the role appears automatically on Discord.");
    } else if (params.get("vip") === "cancelled") {
      setCheckoutNotice("Payment cancelled. You can try again whenever you like.");
    }
  }, []);

  useEffect(() => {
    async function autofillDiscordId() {
      if (!supabase) return;
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      if (!user) return;

      const identity = user.identities?.find((item: { provider: string }) => item.provider === "discord");
      const identityData = (identity as { identity_data?: Record<string, unknown> } | undefined)?.identity_data ?? {};
      const metadata = (user.user_metadata as Record<string, unknown>) ?? {};
      const source = { ...metadata, ...identityData } as Record<string, unknown>;
      const rawId =
        (identity as { provider_id?: string } | undefined)?.provider_id ??
        (source.provider_id as string | undefined) ??
        (source.sub as string | undefined) ??
        (source.user_id as string | undefined);

      if (rawId) setDiscordId(String(rawId));
    }
    autofillDiscordId();
  }, []);

  async function handleBuy(tier: "vip" | "vip_plus") {
    setError(null);

    if (!/^\d{5,25}$/.test(discordId.trim())) {
      setError("Enter your Discord ID (numbers only) so we can link the purchase to your account.");
      return;
    }

    setLoadingTier(tier);
    try {
      const res = await fetch("/api/vip/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier, discordId: discordId.trim() }),
      });
      const json = await res.json();
      if (!res.ok || !json.checkoutUrl) {
        setError(json.error ?? "Could not start the payment. Please try again.");
        return;
      }
      window.location.href = json.checkoutUrl;
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoadingTier(null);
    }
  }

  const leaderboard = data?.leaderboard ?? [];

  return (
    <div className="min-h-screen bg-[#140D07] text-white selection:bg-orange-400/20 selection:text-white">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#140D07]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <Link href="/" className="text-sm font-semibold uppercase tracking-[0.25em] text-amber-300">
            NVL
          </Link>
          <nav className="flex flex-wrap gap-2 rounded-2xl border border-orange-400/10 bg-orange-500/[0.06] p-1.5 text-sm text-white/70 backdrop-blur-sm">
            <Link href="/" className="rounded-xl border border-white/10 px-4 py-2 hover:bg-white/10">Home</Link>
            <Link href="/matchmaking" className="rounded-xl border border-orange-400/30 bg-orange-400/10 px-4 py-2 text-amber-300">Matchmaking</Link>
            <Link href="/pickems" className="rounded-xl border border-white/10 px-4 py-2 hover:bg-white/10">Pickems</Link>
            <Link href="/archives" className="rounded-xl border border-white/10 px-4 py-2 hover:bg-white/10">Archives</Link>
            <Link href="/profile" className="rounded-xl border border-white/10 px-4 py-2 hover:bg-white/10">Profile</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-16">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-300">Ranked Pickup</p>
        <h1 className="mt-2 text-4xl font-black md:text-5xl">Matchmaking</h1>
        <p className="mt-4 max-w-2xl text-white/65">
          Ranked matches with an ELO system, captains chosen by draft and their own seasons —{" "}
          {data?.activeSeason ? `season #${data.activeSeason.number} in progress.` : "no active season right now."}
        </p>

        {checkoutNotice ? (
          <div className="mt-6 rounded-2xl border border-orange-400/25 bg-orange-400/10 px-5 py-4 text-sm text-amber-200">
            {checkoutNotice}
          </div>
        ) : null}

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-[1.5rem] border border-white/10 bg-[#1C120A] p-5">
            <p className="text-sm text-white/50">Finished matches</p>
            <p className="mt-2 text-3xl font-black">{data?.finishedMatches ?? 0}</p>
          </div>
          <div className="rounded-[1.5rem] border border-white/10 bg-[#1C120A] p-5">
            <p className="text-sm text-white/50">Ranked players</p>
            <p className="mt-2 text-3xl font-black">{leaderboard.length}</p>
          </div>
          <div className="rounded-[1.5rem] border border-white/10 bg-[#1C120A] p-5">
            <p className="text-sm text-white/50">Season</p>
            <p className="mt-2 text-3xl font-black">{data?.activeSeason ? `#${data.activeSeason.number}` : "—"}</p>
          </div>
        </div>

        <h2 className="mt-16 text-3xl font-black">Leaderboard</h2>
        <div className="mt-6 overflow-x-auto rounded-[1.5rem] border border-white/10 bg-[#1C120A] p-5">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="text-white/50">
              <tr>
                <th className="py-2">#</th>
                <th className="py-2">Player</th>
                <th className="py-2 text-center">ELO</th>
                <th className="py-2 text-center">Matches</th>
                <th className="py-2 text-center">W-L</th>
                <th className="py-2 text-center">Winrate</th>
                <th className="py-2 text-center">MVPs (W)</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-white/40">Loading...</td>
                </tr>
              ) : leaderboard.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-white/40">No ranked matches recorded yet.</td>
                </tr>
              ) : (
                leaderboard.map((p, i) => {
                  const winrate = p.matches > 0 ? Math.round((p.wins / p.matches) * 100) : 0;
                  return (
                    <tr key={p.discord_id} className="border-t border-white/5">
                      <td className="py-3 font-bold text-white/40">{i + 1}</td>
                      <td className="py-3 font-semibold">
                        <span className="inline-flex items-center">
                          {p.avatar_url ? (
                            <img src={p.avatar_url} alt="" className="mr-2 h-6 w-6 rounded-full border border-white/10 object-cover" />
                          ) : null}
                          {p.display_name || `Player ${p.discord_id.slice(-4)}`}
                          {vipBadge(p.vip_tier)}
                        </span>
                      </td>
                      <td className="py-3 text-center font-black text-amber-300">{p.elo}</td>
                      <td className="py-3 text-center">{p.matches}</td>
                      <td className="py-3 text-center">{p.wins}-{p.losses}</td>
                      <td className="py-3 text-center">{winrate}%</td>
                      <td className="py-3 text-center">{p.win_mvp}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <section id="vip" className="mt-16">
          <h2 className="text-3xl font-black">Buy VIP</h2>
          <p className="mt-2 text-white/60">
            Payment securely processed by Stripe. Valid for 30 days from confirmation.
            Your VIP/VIP+ Discord role is applied automatically as soon as the payment is confirmed.
          </p>

          <div className="mt-6 max-w-sm">
            <label className="text-sm text-white/60">Your Discord ID</label>
            <input
              value={discordId}
              onChange={(e) => setDiscordId(e.target.value)}
              placeholder="e.g. 123456789012345678"
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-orange-400"
            />
            <p className="mt-1 text-xs text-white/40">
              Turn on Developer Mode on Discord (Settings → Advanced) to copy your ID, or{" "}
              <Link href="/login" className="text-amber-300 underline decoration-amber-300/30">
                log in with Discord
              </Link>{" "}
              to fill it in automatically.
            </p>
          </div>

          {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}

          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
            {TIERS.map((tier) => (
              <div key={tier.key} className="relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#1C120A] p-6">
                <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${tier.accent}`} />
                <div className="flex items-baseline justify-between">
                  <h3 className="text-2xl font-black">{tier.name}</h3>
                  <span className="text-2xl font-black text-amber-300">{tier.price}</span>
                </div>
                <p className="text-sm text-white/50">for 30 days</p>

                <ul className="mt-5 space-y-2 text-sm text-white/70">
                  {tier.perks.map((perk) => (
                    <li key={perk} className="flex gap-2">
                      <span className="text-orange-400">✓</span> {perk}
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  disabled={loadingTier !== null}
                  onClick={() => handleBuy(tier.key)}
                  className={`mt-6 w-full rounded-2xl px-5 py-3 text-sm font-black transition duration-200 hover:-translate-y-0.5 active:translate-y-0.5 disabled:opacity-60 ${
                    tier.key === "vip_plus"
                      ? "border border-amber-400/30 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20"
                      : "bg-orange-500 text-black hover:brightness-110"
                  }`}
                >
                  {loadingTier === tier.key ? "Redirecting..." : `Buy ${tier.name}`}
                </button>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-[#160E08]">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8 text-sm text-white/60 md:flex-row md:items-center md:justify-between">
          <p>National Volleyball League — Matchmaking</p>
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-orange-400/10 bg-orange-500/[0.06] p-2 backdrop-blur-sm">
            <Link href="/" className="rounded-xl px-2 py-1 hover:bg-white/10 hover:text-white">Home</Link>
            <Link href="/archives" className="rounded-xl px-2 py-1 hover:bg-white/10 hover:text-white">Archives</Link>
            <Link href="/admin" className="rounded-xl px-2 py-1 hover:bg-white/10 hover:text-white">Admin</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
