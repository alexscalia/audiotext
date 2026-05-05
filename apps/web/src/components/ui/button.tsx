import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
};

const VARIANT: Record<Variant, string> = {
  primary:
    "bg-black text-white hover:bg-gray-800 focus:ring-2 focus:ring-black focus:ring-offset-2",
  secondary:
    "border border-gray-300 bg-white text-black hover:bg-gray-100 focus:ring-2 focus:ring-black focus:ring-offset-2",
  ghost:
    "text-gray-700 hover:bg-gray-100 hover:text-black focus:ring-1 focus:ring-black",
  danger:
    "bg-red-600 text-white hover:bg-red-700 focus:ring-2 focus:ring-red-600 focus:ring-offset-2",
};

const SIZE: Record<Size, string> = {
  sm: "px-3 py-1 text-sm",
  md: "px-4 py-2 text-sm",
};

const BASE =
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-md font-semibold transition-colors duration-150 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none";

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    leadingIcon,
    trailingIcon,
    className = "",
    type = "button",
    children,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`${BASE} ${VARIANT[variant]} ${SIZE[size]} ${className}`}
      {...rest}
    >
      {leadingIcon}
      {children}
      {trailingIcon}
    </button>
  );
});
