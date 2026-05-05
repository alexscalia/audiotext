"use client";

import { useTranslations } from "next-intl";
import type { CarrierStatus } from "@audiotext/shared";
import { Badge } from "@/components/ui/badge";

type StatusBadgeProps = {
  status: CarrierStatus;
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const t = useTranslations("Carriers.status");
  const isActive = status === "active";
  return (
    <Badge tone={isActive ? "success" : "neutral"} withDot>
      {isActive ? t("active") : t("inactive")}
    </Badge>
  );
}
