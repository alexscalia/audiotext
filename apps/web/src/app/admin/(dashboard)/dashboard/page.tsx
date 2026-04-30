"use client";

import { useTranslations } from "next-intl";

export default function AdminDashboardPage() {
  const t = useTranslations("Dashboard");

  const stats = [
    { key: "activeCalls" as const, value: "0" },
    { key: "users" as const, value: "0" },
    { key: "trunks" as const, value: "0" },
    { key: "numberingPlans" as const, value: "0" },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-black">
          {t("title")}
        </h1>
        <p className="mt-2 text-sm text-gray-500">{t("subtitle")}</p>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.key}
            className="rounded-md border border-gray-200 bg-white p-5"
          >
            <p className="text-sm text-gray-500">{t(s.key)}</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-black">
              {s.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-md border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-black">
          {t("recentActivity")}
        </h2>
        <p className="mt-1 text-sm text-gray-500">{t("noActivity")}</p>
      </div>
    </div>
  );
}
