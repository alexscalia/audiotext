import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("PageTitles");
  return { title: t("voiceTrunks") };
}

export default function VoiceTrunksLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
