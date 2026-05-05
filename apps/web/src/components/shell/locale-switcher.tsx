"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { setLocale } from "@/i18n/actions";
import { locales, type Locale } from "@/i18n/config";

const LABELS: Record<Locale, { native: string; flag: string }> = {
  en: { native: "English", flag: "EN" },
  it: { native: "Italiano", flag: "IT" },
};

export function LocaleSwitcher({
  align = "right",
}: {
  align?: "left" | "right";
}) {
  const current = useLocale() as Locale;
  const t = useTranslations("Common");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
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

  function pick(locale: Locale) {
    if (locale === current) {
      setOpen(false);
      return;
    }
    startTransition(async () => {
      await setLocale(locale);
      setOpen(false);
    });
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("language")}
        disabled={pending}
        className="flex cursor-pointer items-center gap-1.5 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-black hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-black disabled:opacity-60"
      >
        <span>{LABELS[current].flag}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3 w-3 text-gray-500">
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className={`absolute mt-2 w-40 rounded-md border border-gray-200 bg-white shadow-lg z-50 ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {locales.map((l) => {
            const active = l === current;
            return (
              <button
                key={l}
                role="menuitem"
                onClick={() => pick(l)}
                className={`flex w-full cursor-pointer items-center justify-between px-3 py-2 text-sm hover:bg-gray-100 ${
                  active ? "text-black font-medium" : "text-gray-700"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-500 w-6">
                    {LABELS[l].flag}
                  </span>
                  {LABELS[l].native}
                </span>
                {active && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4 text-black">
                    <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
