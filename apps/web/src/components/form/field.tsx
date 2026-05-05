import type { ReactNode } from "react";
import { ErrorText } from "@/components/form/error-text";

type FieldProps = {
  label: string;
  htmlFor: string;
  required?: boolean;
  error?: string | null;
  hint?: ReactNode;
  children: ReactNode;
};

export function Field({
  label,
  htmlFor,
  required,
  error,
  hint,
  children,
}: FieldProps) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-black">
        {label}
        {required && <span className="ml-0.5 text-red-600">*</span>}
      </label>
      <div className="mt-2">{children}</div>
      {hint && !error && (
        <p className="mt-1 text-xs text-gray-500">{hint}</p>
      )}
      <ErrorText id={`${htmlFor}-error`} message={error} />
    </div>
  );
}
