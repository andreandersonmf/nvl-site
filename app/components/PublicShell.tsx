"use client";

import Link from "next/link";
import {
  Archive,
  BarChart3,
  CalendarDays,
  ClipboardList,
  Home,
  LayoutGrid,
  ListOrdered,
  Medal,
  Shield,
  Swords,
  Target,
  User,
  Users,
} from "lucide-react";
import Sidebar, { type SidebarGroup } from "./Sidebar";

export const PUBLIC_NAV: SidebarGroup[] = [
  {
    items: [
      { label: "Home", href: "/", icon: Home, exact: true },
      { label: "Teams", href: "/teams", icon: Users },
      { label: "Schedule", href: "/schedule", icon: CalendarDays },
      { label: "Groups", href: "/groups", icon: LayoutGrid },
      { label: "Standings", href: "/standings", icon: ListOrdered },
      { label: "Stats", href: "/stats", icon: BarChart3 },
      { label: "Leaderboard", href: "/stat-track", icon: Medal },
      { label: "Archives", href: "/archives", icon: Archive },
    ],
  },
  {
    title: "Play",
    items: [
      { label: "Matchmaking", href: "/matchmaking", icon: Swords },
      { label: "Pickems", href: "/pickems", icon: Target },
      { label: "Register", href: "/register", icon: ClipboardList },
    ],
  },
  {
    title: "Account",
    items: [
      { label: "Profile", href: "/profile", icon: User, matchPrefixes: ["/login"] },
    ],
  },
];

export default function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <Sidebar
      groups={PUBLIC_NAV}
      title="NVL"
      subtitle="National Volleyball League"
      footer={(collapsed) => (
        <Link
          href="/admin"
          title={collapsed ? "Staff panel" : undefined}
          className={`flex items-center rounded-2xl py-2.5 text-sm font-semibold text-white/60 transition hover:bg-white/5 hover:text-white ${
            collapsed ? "justify-center px-0" : "gap-3 px-3"
          }`}
        >
          <Shield className="h-[18px] w-[18px] text-white/45" aria-hidden="true" />
          <span className={collapsed ? "sr-only" : undefined}>Staff panel</span>
        </Link>
      )}
    >
      {children}
    </Sidebar>
  );
}
