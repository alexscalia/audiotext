"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { signOut, useSession } from "@/lib/auth-client";
import { LocaleSwitcher } from "@/components/shell/locale-switcher";

type HeaderProps = {
  collapsed?: boolean;
  mobileOpen?: boolean;
  onToggleDesktop?: () => void;
  onToggleMobile?: () => void;
};

export function Header({
  collapsed = false,
  mobileOpen = false,
  onToggleDesktop,
  onToggleMobile,
}: HeaderProps) {
  const router = useRouter();
  const t = useTranslations("Header");
  const { data: session } = useSession();
  const name = session?.user?.name ?? session?.user?.email ?? "Admin";
  const email = session?.user?.email ?? "";
  const initial = name.charAt(0).toUpperCase();

  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function onSignOut() {
    setOpen(false);
    await signOut();
    router.push("/admin/login");
  }

  return (
    <header className="flex h-16 items-center justify-between gap-3 border-b border-gray-200 bg-white px-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleMobile}
          aria-label={mobileOpen ? t("closeMenu") : t("openMenu")}
          aria-expanded={mobileOpen}
          aria-controls="admin-mobile-nav"
          className="cursor-pointer rounded-md p-2 text-gray-600 transition-colors duration-150 hover:bg-gray-100 hover:text-black focus:outline-none focus:ring-1 focus:ring-black md:hidden motion-reduce:transition-none"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            className="h-5 w-5"
            aria-hidden="true"
          >
            <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
          </svg>
        </button>

        <button
          type="button"
          onClick={onToggleDesktop}
          aria-label={collapsed ? t("expandSidebar") : t("collapseSidebar")}
          aria-expanded={!collapsed}
          className="hidden cursor-pointer rounded-md p-2 text-gray-600 transition-colors duration-150 hover:bg-gray-100 hover:text-black focus:outline-none focus:ring-1 focus:ring-black md:flex motion-reduce:transition-none"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            className={`h-5 w-5 transition-transform duration-200 motion-reduce:transition-none ${
              collapsed ? "" : "rotate-180"
            }`}
            aria-hidden="true"
          >
            <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <div className="flex items-center gap-3">
        <LocaleSwitcher />

        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-label={t("userMenu")}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-black text-xs font-semibold text-white transition-colors duration-150 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 motion-reduce:transition-none"
          >
            {initial}
          </button>

          {open && (
            <div
              role="menu"
              className="absolute right-0 mt-2 w-56 rounded-md border border-gray-200 bg-white shadow-lg z-50"
            >
              <div className="border-b border-gray-100 px-4 py-3">
                <p className="text-sm font-medium text-black truncate">{name}</p>
                {email && (
                  <p className="text-xs text-gray-600 truncate">{email}</p>
                )}
              </div>
              <button
                role="menuitem"
                onClick={onSignOut}
                className="flex w-full cursor-pointer items-center gap-2 px-4 py-2 text-sm text-gray-700 transition-colors duration-150 hover:bg-gray-100 hover:text-black motion-reduce:transition-none"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4 text-gray-500">
                  <path d="M15 17l5-5-5-5M20 12H9M12 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {t("signOut")}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
