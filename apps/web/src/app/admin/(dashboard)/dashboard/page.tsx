"use client";

import { useTranslations } from "next-intl";

type StatKey = "activeCalls" | "users" | "trunks" | "numberingPlans";

const STATS: { key: StatKey; value: string; icon: React.ReactNode }[] = [
  {
    key: "activeCalls",
    value: "0",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
        <path d="M5 4h3l2 5-2 1a11 11 0 0 0 6 6l1-2 5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    key: "users",
    value: "0",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: "trunks",
    value: "0",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
        <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: "numberingPlans",
    value: "0",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M9 8v8M15 8v8M4 12h16" />
      </svg>
    ),
  },
];

export default function AdminDashboardPage() {
  const t = useTranslations("Dashboard");

  return (
    <div className="mx-auto max-w-6xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-black">
          {t("title")}
        </h1>
        <p className="mt-2 text-sm text-gray-600">{t("subtitle")}</p>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STATS.map((s) => (
          <div
            key={s.key}
            className="rounded-md border border-gray-200 bg-white p-5"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">{t(s.key)}</p>
              <span className="text-gray-400" aria-hidden="true">
                {s.icon}
              </span>
            </div>
            <p className="mt-3 text-3xl font-bold tracking-tight text-black">
              {s.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-md border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-black">
          {t("recentActivity")}
        </h2>
        <p className="mt-1 text-sm text-gray-600">{t("noActivity")}</p>
      </div>
    </div>
  );
}
