import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("PageTitles");
  return { title: t("rateSheetVoiceDetail") };
}

export default function RateSheetVoiceDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
