import SiteHub from "./SiteHub";

// The league hub (/, /teams, /schedule, /groups, /standings, /stat-track,
// /register) shares one data layer: teams, matches, season, staff and the
// registration/captain tools. It lives in this layout so it is loaded once and
// stays mounted while moving between these routes; each route's page.tsx only
// decides WHICH view is shown (SiteHub reads the pathname).
export default function HubLayout({ children }: { children: React.ReactNode }) {
  return <SiteHub>{children}</SiteHub>;
}
