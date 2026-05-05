import { forwardRef, type InputHTMLAttributes } from "react";
import { SearchIcon } from "@/components/ui/icons";

type SearchInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
  containerClassName?: string;
};

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  function SearchInput(
    { label, className = "", containerClassName = "", ...rest },
    ref,
  ) {
    return (
      <label className={`relative block ${containerClassName}`}>
        <span className="sr-only">{label}</span>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400"
        >
          <SearchIcon />
        </span>
        <input
          ref={ref}
          type="search"
          placeholder={label}
          className={`w-full rounded-md border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-black placeholder:text-gray-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black sm:max-w-xs ${className}`}
          {...rest}
        />
      </label>
    );
  },
);
