import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("PageTitles");
  return { title: t("numberingPlansVoice") };
}

export default function NumberingPlansVoiceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
