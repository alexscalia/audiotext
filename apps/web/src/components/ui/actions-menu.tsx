"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";

type ActionsMenuProps = {
  triggerLabel: string;
  children: ReactNode;
};

const MENU_OFFSET = 4;
const ESTIMATED_MENU_HEIGHT = 132;

export function ActionsMenu({ triggerLabel, children }: ActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; right: number } | null>(
    null,
  );
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();

  const close = useCallback(() => setOpen(false), []);

  const reposition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const placeAbove =
      spaceBelow < ESTIMATED_MENU_HEIGHT && rect.top > ESTIMATED_MENU_HEIGHT;
    const top = placeAbove
      ? rect.top - MENU_OFFSET - ESTIMATED_MENU_HEIGHT
      : rect.bottom + MENU_OFFSET;
    const right = window.innerWidth - rect.right;
    setCoords({ top, right });
  }, []);

  useEffect(() => {
    if (!open) return;
    reposition();

    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      close();
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open, close, reposition]);

  const menu =
    open && coords && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            style={{ top: coords.top, right: coords.right, position: "fixed" }}
            className="z-50 min-w-[10rem] overflow-hidden rounded-md border border-gray-200 bg-white py-1 text-left shadow-md"
            onClick={close}
          >
            {children}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={triggerLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
        className="cursor-pointer rounded-md p-2 text-gray-500 transition-colors duration-150 hover:bg-gray-100 hover:text-black focus:outline-none focus:ring-1 focus:ring-black motion-reduce:transition-none"
      >
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          className="h-4 w-4"
          aria-hidden="true"
        >
          <circle cx="12" cy="5" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="12" cy="19" r="1.6" />
        </svg>
      </button>
      {menu}
    </>
  );
}

type CommonItemProps = {
  icon: ReactNode;
  label: string;
  tone?: "default" | "danger";
};

type ActionsMenuItemProps =
  | (CommonItemProps & { onSelect: () => void; href?: never })
  | (CommonItemProps & { href: string; onSelect?: never });

export function ActionsMenuItem(props: ActionsMenuItemProps) {
  const { icon, label, tone = "default" } = props;
  const toneClass =
    tone === "danger"
      ? "text-red-600 hover:bg-red-50 hover:text-red-700"
      : "text-gray-700 hover:bg-gray-100 hover:text-black";
  const className = `flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-sm transition-colors duration-150 focus:outline-none focus:bg-gray-100 motion-reduce:transition-none ${toneClass}`;

  if ("href" in props && props.href) {
    return (
      <Link role="menuitem" href={props.href} className={className}>
        <span aria-hidden="true" className="flex h-4 w-4 items-center justify-center">
          {icon}
        </span>
        <span>{label}</span>
      </Link>
    );
  }

  return (
    <button
      type="button"
      role="menuitem"
      onClick={props.onSelect}
      className={className}
    >
      <span aria-hidden="true" className="flex h-4 w-4 items-center justify-center">
        {icon}
      </span>
      <span>{label}</span>
    </button>
  );
}

export { EyeIcon, PencilIcon, TrashIcon } from "@/components/ui/icons";
