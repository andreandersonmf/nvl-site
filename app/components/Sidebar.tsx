"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Menu, X, type LucideIcon } from "lucide-react";

export type SidebarItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  // Extra path prefixes that should also highlight this item.
  matchPrefixes?: string[];
  // Items with exact: true only match their own path (used for "/" and "/admin").
  exact?: boolean;
};

export type SidebarGroup = { title?: string; items: SidebarItem[] };

function isActive(pathname: string, item: SidebarItem) {
  if (item.exact) return pathname === item.href;
  const prefixes = [item.href, ...(item.matchPrefixes ?? [])];
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function NavList({
  groups,
  pathname,
  onNavigate,
}: {
  groups: SidebarGroup[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Main navigation" className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {groups.map((group, index) => (
        <div key={group.title ?? index} className="space-y-1">
          {group.title ? (
            <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.3em] text-white/35">
              {group.title}
            </p>
          ) : null}
          {group.items.map((item) => {
            const active = isActive(pathname, item);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={`group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition duration-200 ${
                  active
                    ? "bg-orange-500/15 text-amber-300 shadow-[inset_0_0_0_1px_rgba(251,146,60,0.25)]"
                    : "text-white/70 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon
                  aria-hidden="true"
                  className={`h-[18px] w-[18px] shrink-0 ${active ? "text-amber-300" : "text-white/50 group-hover:text-white/80"}`}
                />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

// Shared layout used by the public site and by /admin. Desktop: fixed sidebar
// on the left + content beside it. Mobile: top bar with a hamburger that opens
// a drawer. The active item comes from the Next.js router (usePathname).
export default function Sidebar({
  groups,
  title,
  subtitle,
  homeHref = "/",
  footer,
  headerActions,
  children,
}: {
  groups: SidebarGroup[];
  title: string;
  subtitle?: string;
  homeHref?: string;
  footer?: ReactNode;
  headerActions?: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname() || "/";
  // The drawer is "open" only for the path it was opened on, so it closes by
  // itself as soon as the route changes (link click, back button...).
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const open = openedOn === pathname;
  const setOpen = (value: boolean) => setOpenedOn(value ? pathname : null);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const brand = (
    <Link href={homeHref} className="flex items-center gap-3" onClick={() => setOpen(false)}>
      <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-[#140D07]">
        <Image src="/nvl-logo-black.png" alt="NVL logo" fill sizes="40px" className="object-cover" />
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-sm font-black text-white">{title}</span>
        {subtitle ? (
          <span className="block truncate text-[10px] font-semibold uppercase tracking-[0.25em] text-amber-300">
            {subtitle}
          </span>
        ) : null}
      </span>
    </Link>
  );

  return (
    <div className="min-h-screen bg-[#140D07] text-white selection:bg-orange-400/20 selection:text-white">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-white/10 bg-[#120B06] md:flex">
        <div className="border-b border-white/10 px-5 py-5">{brand}</div>
        <NavList groups={groups} pathname={pathname} />
        {footer ? <div className="border-t border-white/10 p-3">{footer}</div> : null}
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-white/10 bg-[#140D07]/95 px-4 py-3 backdrop-blur md:hidden">
        {brand}
        <div className="flex shrink-0 items-center gap-2">
          {headerActions}
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={open}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white transition hover:bg-white/10"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* Mobile drawer */}
      {open ? (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <div className="absolute inset-y-0 left-0 flex w-[min(20rem,85vw)] flex-col border-r border-white/10 bg-[#120B06] shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-4">
              {brand}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close navigation menu"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white hover:bg-white/10"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <NavList groups={groups} pathname={pathname} onNavigate={() => setOpen(false)} />
            {footer ? <div className="border-t border-white/10 p-3">{footer}</div> : null}
          </div>
        </div>
      ) : null}

      {/* Content: min-w-0 + overflow-x-clip so wide tables can't push the page sideways */}
      <div className="min-w-0 overflow-x-clip md:pl-64">{children}</div>
    </div>
  );
}
