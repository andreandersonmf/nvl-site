import PublicShell from "@/app/components/PublicShell";

// Every public page (home, teams, schedule, groups, standings, stats,
// archives, matchmaking, pickems, profile, register...) shares the same
// sidebar. The route group "(site)" does not change any URL.
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <PublicShell>{children}</PublicShell>;
}
