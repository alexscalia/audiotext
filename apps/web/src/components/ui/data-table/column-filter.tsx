"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

export type ColumnFilterOption = {
  value: string;
  label: string;
};

type ColumnFilterDropdownProps = {
  label: string;
  triggerLabel: string;
  options: readonly ColumnFilterOption[];
  selected: readonly string[];
  onChange: (next: string[]) => void;
  applyLabel: string;
  clearLabel: string;
};

const POPOVER_OFFSET = 4;
const ESTIMATED_HEIGHT = 220;

export function ColumnFilterDropdown({
  label,
  triggerLabel,
  options,
  selected,
  onChange,
  applyLabel,
  clearLabel,
}: ColumnFilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(
    null,
  );
  const [draft, setDraft] = useState<Set<string>>(() => new Set(selected));
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const popoverId = useId();
  const active = selected.length > 0;

  const close = useCallback(() => setOpen(false), []);

  const reposition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const placeAbove =
      spaceBelow < ESTIMATED_HEIGHT && rect.top > ESTIMATED_HEIGHT;
    const top = placeAbove
      ? rect.top - POPOVER_OFFSET - ESTIMATED_HEIGHT
      : rect.bottom + POPOVER_OFFSET;
    const left = rect.left;
    setCoords({ top, left });
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
  }, [open, reposition, close]);

  function openMenu() {
    setDraft(new Set(selected));
    setOpen(true);
  }

  function toggle(value: string) {
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  function apply() {
    onChange(Array.from(draft));
    close();
  }

  function clear() {
    onChange([]);
    close();
  }

  const popover =
    open && coords && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={menuRef}
            id={popoverId}
            role="dialog"
            style={{ top: coords.top, left: coords.left, position: "fixed" }}
            className="z-50 min-w-[12rem] overflow-hidden rounded-md border border-gray-200 bg-white py-2 text-left text-gray-700 shadow-md"
          >
            <ul className="max-h-56 overflow-y-auto px-1">
              {options.map((opt) => {
                const checked = draft.has(opt.value);
                return (
                  <li key={opt.value}>
                    <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm normal-case tracking-normal hover:bg-gray-100">
                      <input
                        type="checkbox"
                        className="h-4 w-4 cursor-pointer accent-black"
                        checked={checked}
                        onChange={() => toggle(opt.value)}
                      />
                      <span>{opt.label}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
            <div className="mt-1 flex items-center justify-between gap-2 border-t border-gray-200 px-3 py-2">
              <button
                type="button"
                onClick={clear}
                className="cursor-pointer text-xs font-medium normal-case tracking-normal text-gray-600 hover:text-black focus:outline-none focus:ring-1 focus:ring-black"
              >
                {clearLabel}
              </button>
              <button
                type="button"
                onClick={apply}
                className="cursor-pointer rounded-md bg-black px-3 py-1 text-xs font-medium normal-case tracking-normal text-white hover:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-black"
              >
                {applyLabel}
              </button>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <span className="inline-flex items-center gap-1">
      <span>{label}</span>
      <button
        ref={triggerRef}
        type="button"
        aria-label={triggerLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        onClick={() => (open ? close() : openMenu())}
        className={`inline-flex h-5 w-5 cursor-pointer items-center justify-center rounded transition-colors duration-150 hover:bg-gray-200 focus:outline-none focus:ring-1 focus:ring-black motion-reduce:transition-none ${
          active ? "text-black" : "text-gray-400 hover:text-black"
        }`}
      >
        <FilterIcon active={active} />
      </button>
      {popover}
    </span>
  );
}

function FilterIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3.5 w-3.5">
      <path
        d="M2.5 3h11l-4.25 5.25V13l-2.5 1V8.25L2.5 3z"
        fill={active ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
