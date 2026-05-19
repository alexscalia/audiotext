"use client";

import type { ReactNode } from "react";

export type IconToggleOption<T extends string> = {
  value: T;
  label: string;
  icon: ReactNode;
};

type IconToggleProps<T extends string> = {
  value: T;
  onChange: (next: T) => void;
  options: readonly IconToggleOption<T>[];
  ariaLabel: string;
  className?: string;
};

export function IconToggle<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  className,
}: IconToggleProps<T>) {
  return (
    <div
      className={
        "inline-flex rounded-md border border-gray-200 bg-white p-0.5" +
        (className ? " " + className : "")
      }
      role="tablist"
      aria-label={ariaLabel}
    >
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-label={opt.label}
            title={opt.label}
            onClick={() => onChange(opt.value)}
            className={
              selected
                ? "cursor-pointer rounded p-1.5 bg-black text-white"
                : "cursor-pointer rounded p-1.5 text-gray-600 hover:bg-gray-100 hover:text-black"
            }
          >
            {opt.icon}
          </button>
        );
      })}
    </div>
  );
}
