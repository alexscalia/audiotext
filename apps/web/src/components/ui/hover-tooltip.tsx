import type { ReactNode } from "react";

type HoverTooltipProps = {
  children: ReactNode;
  tooltip: ReactNode;
  /** Extra classes for the wrapping span. */
  className?: string;
  /** Extra classes for the tooltip bubble (override placement, width, etc.). */
  tooltipClassName?: string;
};

const TOOLTIP_BASE =
  "pointer-events-none invisible absolute right-full top-1/2 z-20 mr-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-black px-2 py-1 text-xs font-normal text-white opacity-0 shadow-lg transition-opacity duration-100 group-hover:visible group-hover:opacity-100 motion-reduce:transition-none";

export function HoverTooltip({
  children,
  tooltip,
  className,
  tooltipClassName,
}: HoverTooltipProps) {
  return (
    <span
      className={`group relative inline-flex cursor-help ${className ?? ""}`}
    >
      {children}
      <span
        role="tooltip"
        className={`${TOOLTIP_BASE} ${tooltipClassName ?? ""}`}
      >
        {tooltip}
      </span>
    </span>
  );
}
