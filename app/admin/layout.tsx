import AdminConsole from "./AdminConsole";

// Admin panel shell. AdminConsole holds the shared data (teams, matches,
// drafts, staff...) and the admin sidebar; it stays mounted while navigating
// between /admin, /admin/setup, /admin/teams, /admin/matches and
// /admin/users, and shows the view that matches the route and the person's
// role (Admin: everything, Referee / Stat Tracker: Matches only).
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminConsole>{children}</AdminConsole>;
}
