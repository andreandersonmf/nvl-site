"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/app/lib/supabaseClient";

function cleanDiscordUsername(value?: string | null) {
  return String(value ?? "").trim().replace(/^@/, "").replace(/#0$/, "");
}

type PlayerProfile = {
  id: string;
  auth_user_id?: string | null;
  discord_id?: string | null;
  discord_username?: string | null;
  discord_global_name?: string | null;
  roblox_username?: string | null;
  roblox_user_id?: string | null;
  avatar_url?: string | null;
  site_role?: string | null;
};

type TeamMembership = {
  id: number;
  team_id: number;
  team_name?: string | null;
  roblox_username?: string | null;
  role?: string | null;
  isCaptain?: boolean;
  isManager?: boolean;
};

type TeamTransaction = {
  id: string;
  team_id?: number | null;
  team_name?: string | null;
  transaction_type?: string | null;
  requested_role?: string | null;
  status?: string | null;
  source?: string | null;
  player_discord_id?: string | null;
  player_discord_username?: string | null;
  requester_discord_id?: string | null;
  requester_discord_username?: string | null;
  handled_by_discord_id?: string | null;
  handled_by_discord_username?: string | null;
  handled_at?: string | null;
  roblox_username?: string | null;
  roblox_user_id?: string | null;
  reason?: string | null;
  created_at?: string | null;
};

function getDiscordIdentity(session: Session | null) {
  const user = session?.user;
  if (!user) return null;

  const identity = user.identities?.find((item) => item.provider === "discord") as any;
  const identityData = identity?.identity_data ?? {};
  const metadata = user.user_metadata ?? {};
  const source = { ...metadata, ...identityData } as Record<string, any>;

  const discordId =
    identity?.provider_id ??
    source.provider_id ??
    source.sub ??
    source.id ??
    source.user_id ??
    null;

  const username =
    source.preferred_username ??
    source.user_name ??
    source.username ??
    source.name ??
    user.email ??
    null;

  const globalName = source.global_name ?? source.full_name ?? source.name ?? null;
  const avatarUrl = source.avatar_url ?? source.picture ?? null;

  return {
    discordId: discordId ? String(discordId) : null,
    username: username ? cleanDiscordUsername(String(username)) : null,
    globalName: globalName ? String(globalName) : null,
    avatarUrl: avatarUrl ? String(avatarUrl) : null,
  };
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("en", {
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function RobloxAvatar({ userId, name }: { userId?: string | null; name?: string | null }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const cleanUserId = String(userId ?? "").trim();

    if (!/^\d+$/.test(cleanUserId)) {
      setImageUrl(null);
      return;
    }

    fetch(`/api/roblox-avatar?userId=${encodeURIComponent(cleanUserId)}`)
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) setImageUrl(data?.imageUrl ?? null);
      })
      .catch(() => {
        if (!cancelled) setImageUrl(null);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (imageUrl) {
    return <img src={imageUrl} alt={name || "Roblox avatar"} className="h-14 w-14 rounded-2xl border border-white/10 bg-black/20 object-cover" />;
  }

  return (
    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-orange-400/10 text-sm font-black text-amber-200">
      {(name || "?").slice(0, 1).toUpperCase()}
    </div>
  );
}

export default function ProfilePage() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [transactions, setTransactions] = useState<TeamTransaction[]>([]);
  const [membership, setMembership] = useState<TeamMembership | null>(null);
  const [leavingTeam, setLeavingTeam] = useState(false);
  const [robloxUsername, setRobloxUsername] = useState("");
  const [robloxUserId, setRobloxUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const discordIdentity = useMemo(() => getDiscordIdentity(session), [session]);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await syncProfile(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession);
      await syncProfile(nextSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabase || !profile) return;

    const interval = window.setInterval(() => {
      loadProfileContext();
    }, 15000);

    return () => window.clearInterval(interval);
  }, [profile?.id]);

  async function syncProfile(currentSession: Session | null) {
    if (!supabase || !currentSession?.user) return;

    const identity = getDiscordIdentity(currentSession);
    const token = currentSession.access_token;

    if (!identity?.discordId && !identity?.username) {
      setNotice("Discord identity was not detected. Log out and login with Discord again.");
      return;
    }

    const response = await fetch("/api/profile-sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        discordId: identity?.discordId,
        discordUsername: identity?.username,
        discordGlobalName: identity?.globalName,
        avatarUrl: identity?.avatarUrl,
      }),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setNotice(`Profile sync failed: ${result?.error || response.statusText}`);
      return;
    }

    const nextProfile = result.profile as PlayerProfile;
    setProfile(nextProfile);
    setRobloxUsername(nextProfile.roblox_username ?? "");
    setRobloxUserId(nextProfile.roblox_user_id ?? "");
    await loadProfileContext(token);
  }

  async function loadProfileContext(tokenOverride?: string | null) {
    if (!supabase) return null;

    const token = tokenOverride ?? (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) {
      setTransactions([]);
      setMembership(null);
      return null;
    }

    const response = await fetch("/api/profile-transactions", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setNotice(`Transactions could not be loaded: ${result?.error || response.statusText}`);
      return null;
    }

    const nextMembership = (result.membership ?? null) as TeamMembership | null;
    setMembership(nextMembership);
    setTransactions((result.transactions ?? []) as TeamTransaction[]);
    return nextMembership;
  }

  async function loadTransactions(_discordId?: string | null, _discordUsername?: string | null) {
    await loadProfileContext();
  }

  async function loadMembership(_discordId: string | null, _discordUsername: string | null) {
    return await loadProfileContext();
  }

  async function leaveCurrentTeam() {
    if (!supabase || !profile) return;

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setNotice("Login session expired. Log in again before leaving your team.");
      return;
    }

    setLeavingTeam(true);
    const response = await fetch("/api/team-sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action: "leave_team" }),
    });

    const result = await response.json().catch(() => ({}));
    setLeavingTeam(false);

    if (!response.ok) {
      setNotice(result?.error || "Unable to leave team.");
      return;
    }

    setNotice(`You left ${result.team || "your team"}.`);
    await loadProfileContext(token);
  }

  async function saveRoblox(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !profile) return;

    const cleanUsername = robloxUsername.trim();
    const cleanUserId = robloxUserId.trim();

    if (!cleanUsername || !/^\d+$/.test(cleanUserId)) {
      setNotice("Enter a Roblox username and numeric User ID.");
      return;
    }

    const { data: authData } = await supabase.auth.getSession();
    const token = authData.session?.access_token;
    if (!token) {
      setNotice("Login session expired. Log in again before saving Roblox.");
      return;
    }

    setSaving(true);
    const response = await fetch("/api/profile-sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        discordId: profile.discord_id ?? discordIdentity?.discordId,
        discordUsername: profile.discord_username ?? discordIdentity?.username,
        discordGlobalName: profile.discord_global_name ?? discordIdentity?.globalName,
        avatarUrl: profile.avatar_url ?? discordIdentity?.avatarUrl,
        robloxUsername: cleanUsername,
        robloxUserId: cleanUserId,
      }),
    });

    const result = await response.json().catch(() => ({}));
    setSaving(false);

    if (!response.ok) {
      setNotice(result?.error || "Unable to save Roblox account.");
      return;
    }

    setProfile(result.profile as PlayerProfile);
    setNotice("Roblox account linked successfully.");
    await loadProfileContext(token);
  }

  async function logout() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setTransactions([]);
    setMembership(null);
  }

  const isManagerProfile = Boolean(
    membership?.isManager || membership?.isCaptain || membership?.role === "Vice Captain" || membership?.role === "Court Captain"
  );
  const transactionsTitle = isManagerProfile
    ? "Your Transactions (Captain, Vice Captain & Court Captain)"
    : "Your Transactions (Player)";

  if (loading) {
    return <main className="min-h-screen bg-[#140D07] p-10 text-white">Loading profile...</main>;
  }

  if (!session) {
    return (
      <main className="min-h-screen bg-[#140D07] px-6 py-10 text-white">
        <div className="mx-auto max-w-2xl rounded-[2rem] border border-white/10 bg-[#1C120A] p-8">
          <h1 className="text-4xl font-black">Profile</h1>
          <p className="mt-4 text-white/70">You need to log in with Discord before opening your NVL profile.</p>
          <Link href="/login" className="mt-6 inline-flex rounded-2xl bg-[#5865F2] px-6 py-3 font-bold text-white">
            Login with Discord
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#140D07] px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <nav className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-sm font-semibold uppercase tracking-[0.25em] text-amber-300">NVL Profile</h1>
          <div className="flex flex-wrap gap-2 text-sm text-white/70">
            <Link href="/admin" className="rounded-xl border border-white/10 px-4 py-2 hover:bg-white/5">Admin</Link>
            <button onClick={logout} className="rounded-xl border border-red-400/20 px-4 py-2 text-red-200 hover:bg-red-400/10">Log Out</button>
          </div>
        </nav>

        <section className="mt-10 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="rounded-[2rem] border border-white/10 bg-[#1C120A] p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-300">Discord Identity</p>
            <div className="mt-5 flex items-center gap-4">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Discord avatar" className="h-16 w-16 rounded-full border border-white/10 object-cover" />
              ) : (
                <div className="h-16 w-16 rounded-full border border-white/10 bg-white/10" />
              )}
              <div>
                <h1 className="text-2xl font-black">{profile?.discord_global_name || profile?.discord_username || discordIdentity?.username || "Discord User"}</h1>
                <p className="text-sm text-white/50">Discord ID: {profile?.discord_id || discordIdentity?.discordId || "Not detected"}</p>
              </div>
            </div>

            <form onSubmit={saveRoblox} className="mt-8 rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/50">Linked Roblox</p>
              <div className="mt-4 space-y-4">
                <label className="block text-sm text-white/70">
                  Roblox Username
                  <input value={robloxUsername} onChange={(e) => setRobloxUsername(e.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-[#140D07] px-4 py-3 outline-none focus:border-orange-400/40" placeholder="xImTutu" />
                </label>
                <label className="block text-sm text-white/70">
                  Roblox User ID
                  <input value={robloxUserId} onChange={(e) => setRobloxUserId(e.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-[#140D07] px-4 py-3 outline-none focus:border-orange-400/40" placeholder="123456789" />
                </label>
                <button disabled={saving} className="rounded-2xl bg-orange-500 px-5 py-3 font-bold text-black disabled:opacity-50">
                  {saving ? "Saving..." : "Save Roblox Link"}
                </button>
              </div>
            </form>

            {notice ? <p className="mt-4 rounded-2xl border border-orange-400/20 bg-orange-400/10 p-4 text-sm text-amber-200">{notice}</p> : null}
          </div>

          <div className="space-y-6">
            <div className="rounded-[2rem] border border-white/10 bg-[#1C120A] p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#AEB6FF]">Team Control</p>
              <h2 className="mt-2 text-3xl font-black">Your Current Team</h2>
              {membership ? (
                <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
                  <p className="text-xl font-bold text-white">{membership.team_name || "Registered Team"}</p>
                  <p className="mt-1 text-sm text-white/60">{membership.roblox_username || "Player"} • {membership.role || "Player"}</p>
                  {membership.isCaptain ? (
                    <p className="mt-4 rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-4 text-sm text-yellow-100">
                      Captains cannot leave directly from Profile. Ask an Admin to change captain or delete the team.
                    </p>
                  ) : (
                    <button
                      type="button"
                      disabled={leavingTeam}
                      onClick={leaveCurrentTeam}
                      className="mt-4 rounded-2xl border border-red-400/25 bg-red-400/10 px-5 py-3 text-sm font-bold text-red-200 transition hover:bg-red-400/15 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {leavingTeam ? "Leaving..." : "Leave Team"}
                    </button>
                  )}
                </div>
              ) : (
                <p className="mt-4 rounded-[1.5rem] border border-white/10 bg-white/5 p-5 text-white/60">
                  You are not currently registered as a roster player. Captains are changed by Admin from the admin panel.
                </p>
              )}
            </div>

          <div className="rounded-[2rem] border border-white/10 bg-[#1C120A] p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-300">Transactions</p>
                <h2 className="mt-2 text-3xl font-black">{transactionsTitle}</h2>
              </div>
              <button onClick={() => loadProfileContext()} className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-white/75 hover:bg-white/10">
                Refresh
              </button>
            </div>

            <div className="mt-6 space-y-4">
              {transactions.length === 0 ? (
                <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5 text-white/60">
                  {isManagerProfile ? "No team transactions found yet." : "No player transactions found yet."}
                </div>
              ) : (
                transactions.map((item) => (
                  <article key={item.id} className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-4">
                        <RobloxAvatar userId={item.roblox_user_id} name={item.roblox_username || item.player_discord_username} />
                        <div className="min-w-0">
                          <p className="text-sm uppercase tracking-[0.2em] text-white/40">{item.transaction_type || "transaction"}</p>
                          <h3 className="mt-1 truncate text-xl font-bold">{item.team_name || "Unknown Team"}</h3>
                          <p className="mt-1 text-sm text-white/55">{item.roblox_username || item.player_discord_username || item.player_discord_id || "Unknown player"}</p>
                        </div>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] ${item.status === "accepted" ? "bg-orange-400/15 text-amber-300" : item.status === "denied" ? "bg-red-400/15 text-red-300" : "bg-yellow-400/15 text-yellow-200"}`}>
                        {item.status || "pending"}
                      </span>
                    </div>
                    <div className="mt-4 grid gap-2 text-sm text-white/65 md:grid-cols-2">
                      <p>Player Discord: {item.player_discord_username || item.player_discord_id || "—"}</p>
                      <p>Role: {item.requested_role || "—"}</p>
                      <p>Roblox ID: {item.roblox_user_id || "—"}</p>
                      <p>Requested by: {item.requester_discord_username || item.requester_discord_id || "—"}</p>
                      <p>Handled by: {item.handled_by_discord_username || item.handled_by_discord_id || "—"}</p>
                      <p>Created: {formatDate(item.created_at)}</p>
                      <p>Handled at: {formatDate(item.handled_at)}</p>
                    </div>
                    {item.reason ? <p className="mt-3 rounded-xl bg-red-400/10 p-3 text-sm text-red-200">{item.reason}</p> : null}
                  </article>
                ))
              )}
            </div>
          </div>
          </div>
        </section>
      </div>
    </main>
  );
}
