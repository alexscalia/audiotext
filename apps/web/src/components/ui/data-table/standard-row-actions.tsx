"use client";

import { EyeIcon, PencilIcon, TrashIcon } from "@/components/ui/icons";
import {
  ActionsCell,
  type RowAction,
} from "@/components/ui/data-table/actions-cell";

type ActionTranslate = (
  key: "open" | "view" | "edit" | "delete" | string,
) => string;

type StandardRowActionsProps = {
  itemName: string;
  t: ActionTranslate;
  onView?: () => void;
  onEdit?: () => void;
  onRemove?: () => void;
  viewHref?: string;
};

const noop = () => {};

export function StandardRowActions({
  itemName,
  t,
  onView,
  onEdit,
  onRemove,
  viewHref,
}: StandardRowActionsProps) {
  const view: RowAction = viewHref
    ? { icon: <EyeIcon />, label: t("view"), href: viewHref }
    : { icon: <EyeIcon />, label: t("view"), onSelect: onView ?? noop };

  const actions: RowAction[] = [
    view,
    {
      icon: <PencilIcon />,
      label: t("edit"),
      onSelect: onEdit ?? noop,
    },
    {
      icon: <TrashIcon />,
      label: t("delete"),
      tone: "danger",
      onSelect: onRemove ?? noop,
    },
  ];

  return (
    <ActionsCell
      triggerLabel={`${t("open")} — ${itemName}`}
      actions={actions}
    />
  );
}
