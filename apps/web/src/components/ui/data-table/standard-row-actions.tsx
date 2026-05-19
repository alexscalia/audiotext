"use client";

import {
  EyeIcon,
  PencilIcon,
  RestoreIcon,
  TrashIcon,
} from "@/components/ui/icons";
import {
  ActionsCell,
  type RowAction,
} from "@/components/ui/data-table/actions-cell";

type ActionTranslate = (
  key: "open" | "view" | "edit" | "trash" | "restore" | string,
) => string;

type StandardRowActionsProps = {
  itemName: string;
  t: ActionTranslate;
  onView?: () => void;
  onEdit?: () => void;
  onRemove?: () => void;
  onRestore?: () => void;
  viewHref?: string;
};

const noop = () => {};

export function StandardRowActions({
  itemName,
  t,
  onView,
  onEdit,
  onRemove,
  onRestore,
  viewHref,
}: StandardRowActionsProps) {
  const view: RowAction = viewHref
    ? { icon: <EyeIcon />, label: t("view"), href: viewHref }
    : { icon: <EyeIcon />, label: t("view"), onSelect: onView ?? noop };

  const actions: RowAction[] = [view];

  if (onEdit !== undefined) {
    actions.push({
      icon: <PencilIcon />,
      label: t("edit"),
      onSelect: onEdit,
    });
  }

  if (onRestore !== undefined) {
    actions.push({
      icon: <RestoreIcon />,
      label: t("restore"),
      onSelect: onRestore,
    });
  } else {
    actions.push({
      icon: <TrashIcon />,
      label: t("trash"),
      tone: "danger",
      onSelect: onRemove ?? noop,
    });
  }

  return (
    <ActionsCell
      triggerLabel={`${t("open")} — ${itemName}`}
      actions={actions}
    />
  );
}
