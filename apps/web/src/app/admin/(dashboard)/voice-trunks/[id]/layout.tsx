import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const [t, tCommon] = await Promise.all([
    getTranslations("PageTitles"),
    getTranslations("Common"),
  ]);
  return {
    title: { absolute: `${t("voiceTrunkDetail")} · ${tCommon("appName")}` },
  };
}

export default function VoiceTrunkDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
