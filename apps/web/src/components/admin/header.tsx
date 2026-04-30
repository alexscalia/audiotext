"use client";

import { useSession } from "@/lib/auth-client";

type HeaderProps = {
  collapsed?: boolean;
  onToggleSidebar?: () => void;
};

export function Header({ collapsed = false, onToggleSidebar }: HeaderProps) {
  const { data: session } = useSession();
  const name = session?.user?.name ?? session?.user?.email ?? "Admin";
  const initial = name.charAt(0).toUpperCase();

  return (
    <header className="flex h-16 items-center justify-between gap-3 border-b border-gray-200 bg-white px-4">
      <div className="flex flex-1 items-center gap-2">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-black focus:outline-none focus:ring-1 focus:ring-black"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
            <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
          </svg>
        </button>

        <div className="relative w-full max-w-md">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            placeholder="Search"
            className="block w-full rounded-md border border-gray-300 bg-white pl-9 pr-3 py-2 text-sm text-black placeholder-gray-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          aria-label="Notifications"
          className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-black"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
            <path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M10 21a2 2 0 0 0 4 0" strokeLinecap="round" />
          </svg>
        </button>

        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-black text-xs font-semibold text-white">
          {initial}
        </div>
      </div>
    </header>
  );
}
