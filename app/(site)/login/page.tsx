"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/app/lib/supabaseClient";

export default function LoginPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function loginWithDiscord() {
    if (!supabase) {
      setNotice("Supabase is not configured yet.");
      return;
    }

    const redirectTo = `${window.location.origin}/profile`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "discord",
      options: {
        redirectTo,
        scopes: "identify email",
      },
    });

    if (error) setNotice(error.message);
  }

  async function logout() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setSession(null);
  }

  return (
    <main className="min-h-screen bg-[#140D07] px-6 py-10 text-white">
      <div className="mx-auto max-w-3xl">
        <section className="mt-12 rounded-[2rem] border border-white/10 bg-[#1C120A] p-8 shadow-2xl shadow-black/20">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-300">
            NVL Account
          </p>
          <h1 className="mt-3 text-4xl font-black md:text-5xl">Login with Discord</h1>
          <p className="mt-4 max-w-2xl text-white/70">
            Use Discord as your NVL identity. After logging in, you can link your Roblox username/User ID and follow your team activity from your profile.
          </p>

          <div className="mt-8 rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
            {loading ? (
              <p className="text-white/60">Checking session...</p>
            ) : session ? (
              <div>
                <p className="font-semibold text-amber-300">You are logged in.</p>
                <p className="mt-2 text-sm text-white/60">Continue to your profile to link Roblox and view your transactions.</p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Link href="/profile" className="rounded-2xl bg-orange-500 px-5 py-3 font-semibold text-black transition hover:-translate-y-0.5">
                    Open Profile
                  </Link>
                  <button onClick={logout} className="rounded-2xl border border-white/10 px-5 py-3 font-semibold text-white/80 transition hover:bg-white/10">
                    Log Out
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={loginWithDiscord} className="rounded-2xl bg-[#5865F2] px-6 py-3 font-bold text-white transition hover:-translate-y-0.5 hover:brightness-110">
                Continue with Discord
              </button>
            )}

            {notice ? <p className="mt-4 text-sm text-red-300">{notice}</p> : null}
          </div>
        </section>
      </div>
    </main>
  );
}
