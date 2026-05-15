import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("PageTitles");
  return { title: t("carriers") };
}

export default function CarriersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
