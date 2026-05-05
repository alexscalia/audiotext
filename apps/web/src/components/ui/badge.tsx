import type { ReactNode } from "react";

type Tone = "success" | "neutral" | "warn" | "danger" | "info";

type BadgeProps = {
  tone?: Tone;
  withDot?: boolean;
  children: ReactNode;
};

const TONE: Record<Tone, { wrapper: string; dot: string }> = {
  success: {
    wrapper: "bg-green-50 text-green-700 ring-1 ring-inset ring-green-200",
    dot: "bg-green-500",
  },
  neutral: {
    wrapper: "bg-gray-100 text-gray-700 ring-1 ring-inset ring-gray-200",
    dot: "bg-gray-400",
  },
  warn: {
    wrapper: "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200",
    dot: "bg-amber-500",
  },
  danger: {
    wrapper: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200",
    dot: "bg-red-500",
  },
  info: {
    wrapper: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200",
    dot: "bg-blue-500",
  },
};

export function Badge({ tone = "neutral", withDot = false, children }: BadgeProps) {
  const t = TONE[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${t.wrapper}`}
    >
      {withDot && (
        <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />
      )}
      {children}
    </span>
  );
}
