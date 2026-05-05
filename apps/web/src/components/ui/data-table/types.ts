export type ColumnAlign = "left" | "right";

export type ColumnMeta = {
  align?: ColumnAlign;
};

export function alignClass(meta: unknown): string {
  const m = meta as ColumnMeta | undefined;
  return m?.align === "right" ? "text-right" : "";
}
