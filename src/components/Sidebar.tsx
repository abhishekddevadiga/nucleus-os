"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { BRAND } from "@/lib/brand";

export interface NavItem {
  href: string;
  label: string;
  icon: string; // geometric glyph keeps the app dependency-free
}

function Wordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <img src="/logo.svg" alt="" className="h-[26px] w-[26px] rounded-lg object-contain" />
      <span className="text-[15px] font-semibold tracking-tight text-slate-900">{BRAND.name}</span>
      <span className="text-[15px] font-normal tracking-tight text-slate-400">OS</span>
    </span>
  );
}

function NavLink({ item, active, onNavigate }: { item: NavItem; active: boolean; onNavigate?: () => void }) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`group relative flex items-center gap-3 rounded-lg px-3 py-[7px] text-[13px] font-medium tracking-tight transition-colors duration-150 ${
        active ? "bg-brand-50 text-brand-700" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
      }`}
    >
      <span
        className={`absolute left-0 top-1/2 h-4 w-[2.5px] -translate-y-1/2 rounded-full bg-brand-500 transition-opacity duration-150 ${
          active ? "opacity-100" : "opacity-0"
        }`}
      />
      <span className={`w-5 text-center text-[15px] leading-none transition-colors ${active ? "text-brand-500" : "text-slate-400 group-hover:text-slate-600"}`}>
        {item.icon}
      </span>
      {item.label}
    </Link>
  );
}

export default function Sidebar({
  items,
  user,
}: {
  items: NavItem[];
  user: { name: string; title: string | null; avatarColor: string };
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const initials = user.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  const nav = (onNavigate?: () => void) => (
    <nav className="flex flex-1 flex-col gap-0.5 px-3">
      {items.map((item) => (
        <NavLink key={item.href} item={item} active={isActive(item.href)} onNavigate={onNavigate} />
      ))}
    </nav>
  );

  const userCard = (
    <div className="flex items-center gap-3">
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ring-2 ring-white"
        style={{ backgroundColor: user.avatarColor }}
      >
        {initials}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-slate-800">{user.name}</p>
        <p className="truncate text-[11px] text-slate-500">{user.title ?? "Team member"}</p>
      </div>
      <button
        onClick={logout}
        title="Sign out"
        aria-label="Sign out"
        className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      </button>
    </div>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-canvas/85 px-4 py-3 backdrop-blur-xl md:hidden">
        <Link href="/" onClick={() => setOpen(false)}><Wordmark /></Link>
        <button
          onClick={() => setOpen(!open)}
          className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
          aria-label="Menu"
        >
          {open ? "✕" : "☰"}
        </button>
      </div>
      {open && (
        <div className="animate-page border-b border-slate-200 bg-canvas-raised pb-4 md:hidden">
          <div className="pt-3">{nav(() => setOpen(false))}</div>
          <div className="mx-3 mt-3 border-t border-slate-200 px-3 pt-3">{userCard}</div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-slate-200 bg-canvas-raised py-5 md:flex">
        <Link href="/" className="mb-5 px-5"><Wordmark /></Link>
        {nav()}
        <div className="mx-3 mt-4 border-t border-slate-200 px-2 pt-4">{userCard}</div>
      </aside>
    </>
  );
}
