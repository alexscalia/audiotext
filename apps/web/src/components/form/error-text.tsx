type ErrorTextProps = {
  id?: string;
  message?: string | null;
};

export function ErrorText({ id, message }: ErrorTextProps) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1 text-sm text-red-600">
      {message}
    </p>
  );
}
