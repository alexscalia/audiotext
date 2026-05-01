"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useSession } from "@/lib/auth-client";
import { Sidebar } from "@/components/admin/sidebar";
import { Header } from "@/components/admin/header";

export default function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const t = useTranslations("Header");
  const { data: session, isPending } = useSession();
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("admin-sidebar-collapsed") === "1";
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!isPending && !session) {
      router.replace("/admin/login");
    }
  }, [isPending, session, router]);

  function onToggleDesktop() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("admin-sidebar-collapsed", next ? "1" : "0");
      return next;
    });
  }

  function onToggleMobile() {
    setMobileOpen((v) => !v);
  }

  if (isPending || !session) {
    return (
      <div
        className="flex min-h-screen bg-white"
        role="status"
        aria-live="polite"
        aria-label="Loading"
      >
        <div className="hidden md:block md:w-64 md:border-r md:border-gray-200">
          <div className="h-16 border-b border-gray-200" />
          <div className="space-y-2 p-4">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-9 rounded-md bg-gray-100" />
            ))}
          </div>
        </div>
        <div className="flex flex-1 flex-col">
          <div className="h-16 border-b border-gray-200 bg-white" />
          <div className="flex-1 bg-gray-50 px-6 py-8 lg:px-10">
            <div className="mx-auto max-w-6xl space-y-6">
              <div className="h-9 w-48 rounded bg-gray-100" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-24 rounded-md bg-gray-100" />
                ))}
              </div>
              <div className="h-32 rounded-md bg-gray-100" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-white">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-black focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:ring-2 focus:ring-black focus:ring-offset-2"
      >
        {t("skipToContent")}
      </a>
      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className="flex flex-1 flex-col">
        <Header
          collapsed={collapsed}
          mobileOpen={mobileOpen}
          onToggleDesktop={onToggleDesktop}
          onToggleMobile={onToggleMobile}
        />
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 overflow-y-auto bg-gray-50 px-6 py-8 lg:px-10"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
