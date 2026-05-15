"use client";

import type { ReactNode } from "react";
import { ActionsMenu, ActionsMenuItem } from "@/components/ui/actions-menu";

type CommonAction = {
  icon: ReactNode;
  label: string;
  tone?: "default" | "danger";
};

export type RowAction =
  | (CommonAction & { onSelect: () => void; href?: never })
  | (CommonAction & { href: string; onSelect?: never });

type ActionsCellProps = {
  triggerLabel: string;
  actions: ReadonlyArray<RowAction>;
};

export function ActionsCell({ triggerLabel, actions }: ActionsCellProps) {
  return (
    <div className="flex items-center justify-end">
      <ActionsMenu triggerLabel={triggerLabel}>
        {actions.map((action, i) => (
          <ActionsMenuItem key={i} {...action} />
        ))}
      </ActionsMenu>
    </div>
  );
}
