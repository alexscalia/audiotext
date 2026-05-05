import { forwardRef, type SelectHTMLAttributes } from "react";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  invalid?: boolean;
};

const BASE =
  "block w-full cursor-pointer rounded-md border bg-white px-3 py-2.5 text-sm text-black focus:outline-none focus:ring-1";

const VALID = "border-gray-300 focus:border-black focus:ring-black";
const INVALID = "border-red-500 focus:border-red-500 focus:ring-red-500";

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { invalid = false, className = "", children, ...rest },
  ref,
) {
  return (
    <select
      ref={ref}
      className={`${BASE} ${invalid ? INVALID : VALID} ${className}`}
      aria-invalid={invalid || undefined}
      {...rest}
    >
      {children}
    </select>
  );
});
