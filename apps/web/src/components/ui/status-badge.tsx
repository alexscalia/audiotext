import type { ReactNode } from "react";
import { Badge, type Tone } from "@/components/ui/badge";

type StatusBadgeProps<S extends string> = {
  status: S;
  tones: Record<S, Tone>;
  label: ReactNode;
};

export function StatusBadge<S extends string>({
  status,
  tones,
  label,
}: StatusBadgeProps<S>) {
  return (
    <Badge tone={tones[status]} withDot>
      {label}
    </Badge>
  );
}
