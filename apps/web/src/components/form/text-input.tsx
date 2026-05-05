import { forwardRef, type InputHTMLAttributes } from "react";

type TextInputProps = InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
};

const BASE =
  "block w-full rounded-md border bg-white px-3 py-2.5 text-sm text-black placeholder-gray-400 focus:outline-none focus:ring-1";

const VALID = "border-gray-300 focus:border-black focus:ring-black";
const INVALID = "border-red-500 focus:border-red-500 focus:ring-red-500";

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  function TextInput({ invalid = false, className = "", type = "text", ...rest }, ref) {
    return (
      <input
        ref={ref}
        type={type}
        className={`${BASE} ${invalid ? INVALID : VALID} ${className}`}
        aria-invalid={invalid || undefined}
        {...rest}
      />
    );
  },
);
