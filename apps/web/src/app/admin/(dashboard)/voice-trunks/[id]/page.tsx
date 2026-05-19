"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import type {
  VoiceTrunkDetail,
  VoiceTrunkListItem,
  VoiceTrunkStatus,
} from "@audiotext/shared";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { DetailHeader } from "@/components/layout/detail-header";
import { NOT_FOUND_ERROR, useResource } from "@/hooks/useResource";
import { api } from "@/lib/api-client";
import { VoiceTrunkFormModal } from "@/components/features/voice-trunks/voice-trunk-form-modal";
import { VoiceTrunkIpsModal } from "@/components/features/voice-trunks/voice-trunk-ips-modal";

const STATUS_TONES: Record<VoiceTrunkStatus, "success" | "warn" | "neutral"> = {
  active: "success",
  testing: "warn",
  inactive: "neutral",
};

function detailToListItem(trunk: VoiceTrunkDetail): VoiceTrunkListItem {
  return {
    id: trunk.id,
    name: trunk.name,
    status: trunk.status,
    carrierId: trunk.carrierId,
    carrierName: trunk.carrierName,
    voiceRateSheetId: trunk.voiceRateSheetId,
    voiceRateSheetName: trunk.voiceRateSheetName,
    ipCount: trunk.ipCount,
    ips: trunk.ips,
    createdAt: trunk.createdAt,
    updatedAt: trunk.updatedAt,
    deletedAt: null,
  };
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white">
      <header className="border-b border-gray-200 px-4 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">
          {title}
        </h2>
      </header>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 p-4 sm:grid-cols-2">
        {children}
      </dl>
    </section>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </dt>
      <dd className="text-sm text-gray-800">{children}</dd>
    </div>
  );
}

function valueOrDash(v: string | null | undefined) {
  if (v === null || v === undefined || v === "") {
    return <span className="text-gray-400">—</span>;
  }
  return <span>{v}</span>;
}

function numberOrDash(v: number | null | undefined) {
  if (v === null || v === undefined) {
    return <span className="text-gray-400">—</span>;
  }
  return <span className="tabular-nums">{v.toLocaleString()}</span>;
}

export default function VoiceTrunkDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";

  const t = useTranslations("VoiceTrunks");
  const tDetail = useTranslations("VoiceTrunks.detail");
  const tFields = useTranslations("VoiceTrunks.detail.fields");
  const tValues = useTranslations("VoiceTrunks.detail.values");
  const tSections = useTranslations("VoiceTrunks.detail.sections");
  const tActions = useTranslations("VoiceTrunks.actions");
  const tStatus = useTranslations("VoiceTrunks.status");

  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [ipsOpen, setIpsOpen] = useState(false);

  const {
    data: trunk,
    loading,
    error,
  } = useResource<VoiceTrunkDetail>({
    queryKey: ["voice-trunk", id],
    enabled: !!id,
    notFoundMessage: tDetail("notFound"),
    errorMessage: t("loadError"),
    queryFn: async (signal) => {
      const res = await api.api.admin["voice-trunks"][":id"].$get(
        { param: { id } },
        { init: { signal, credentials: "include" } },
      );
      if (res.status === 404) throw new Error(NOT_FOUND_ERROR);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as VoiceTrunkDetail;
    },
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["voice-trunk", id] });

  const needsCreds =
    trunk?.authType === "userpass" || trunk?.authType === "both";

  return (
    <div className="mx-auto max-w-6xl">
      <DetailHeader
        backHref="/admin/voice-trunks"
        backLabel={tDetail("backToTrunks")}
        title={trunk?.name ?? tDetail("notFound")}
        loading={loading}
        error={error}
        meta={
          trunk && (
            <>
              <StatusBadge
                status={trunk.status}
                tones={STATUS_TONES}
                label={tStatus(trunk.status)}
              />
              <Badge tone="neutral">
                {tValues(`direction.${trunk.direction}`)}
              </Badge>
              <span className="text-gray-600">{trunk.carrierName}</span>
              {trunk.voiceRateSheetId && trunk.voiceRateSheetName ? (
                <Link
                  href={`/admin/rate-sheets/voice/${trunk.voiceRateSheetId}`}
                  className="text-gray-700 underline decoration-gray-300 underline-offset-2 hover:text-black hover:decoration-black"
                >
                  {trunk.voiceRateSheetName}
                </Link>
              ) : (
                <span className="text-gray-400">{t("noRateSheet")}</span>
              )}
            </>
          )
        }
      />

      {trunk && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Button onClick={() => setEditOpen(true)}>{tActions("edit")}</Button>
            <Button variant="secondary" onClick={() => setIpsOpen(true)}>
              {tActions("manageIps", { count: trunk.ipCount })}
            </Button>
          </div>

          <div className="space-y-4">
            <Section title={tSections("identity")}>
              <Row label={tFields("carrier")}>
                {valueOrDash(trunk.carrierName)}
              </Row>
              <Row label={tFields("rateSheet")}>
                {trunk.voiceRateSheetId && trunk.voiceRateSheetName ? (
                  <Link
                    href={`/admin/rate-sheets/voice/${trunk.voiceRateSheetId}`}
                    className="text-gray-800 underline decoration-gray-300 underline-offset-2 hover:text-black hover:decoration-black"
                  >
                    {trunk.voiceRateSheetName}
                  </Link>
                ) : (
                  <span className="text-gray-400">{t("noRateSheet")}</span>
                )}
              </Row>
              <Row label={tFields("status")}>
                <StatusBadge
                  status={trunk.status}
                  tones={STATUS_TONES}
                  label={tStatus(trunk.status)}
                />
              </Row>
              <Row label={tFields("direction")}>
                {tValues(`direction.${trunk.direction}`)}
              </Row>
              <Row label={tFields("ipCount")}>{numberOrDash(trunk.ipCount)}</Row>
            </Section>

            <Section title={tSections("sip")}>
              <Row label={tFields("protocol")}>
                {tValues(`protocol.${trunk.protocol}`)}
              </Row>
              <Row label={tFields("transport")}>
                {tValues(`transport.${trunk.transport}`)}
              </Row>
              <Row label={tFields("authType")}>
                {tValues(`authType.${trunk.authType}`)}
              </Row>
              <Row label={tFields("register")}>
                {tValues(`registerEnabled.${trunk.registerEnabled}`)}
              </Row>
              {needsCreds && (
                <>
                  <Row label={tFields("username")}>
                    {valueOrDash(trunk.username)}
                  </Row>
                  <Row label={tFields("password")}>
                    {trunk.hasPassword ? (
                      <span className="font-mono">•••••••</span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </Row>
                </>
              )}
              <Row label={tFields("realm")}>{valueOrDash(trunk.realm)}</Row>
              <Row label={tFields("fromUser")}>
                {valueOrDash(trunk.fromUser)}
              </Row>
              <Row label={tFields("fromDomain")}>
                {valueOrDash(trunk.fromDomain)}
              </Row>
              <Row label={tFields("expiresSeconds")}>
                {numberOrDash(trunk.expiresSeconds)}
              </Row>
              <Row label={tFields("qualifySeconds")}>
                {numberOrDash(trunk.qualifySeconds)}
              </Row>
              <Row label={tFields("dtmfMode")}>
                {tValues(`dtmfMode.${trunk.dtmfMode}`)}
              </Row>
              <Row label={tFields("natMode")}>
                {tValues(`natMode.${trunk.natMode}`)}
              </Row>
              <Row label={tFields("codecs")}>
                {trunk.codecs.length > 0 ? (
                  <span className="font-mono text-sm">
                    {trunk.codecs.join(", ")}
                  </span>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </Row>
            </Section>

            <Section title={tSections("capacity")}>
              <Row label={tFields("maxChannels")}>
                {numberOrDash(trunk.maxChannels)}
              </Row>
              <Row label={tFields("cpsLimit")}>
                {numberOrDash(trunk.cpsLimit)}
              </Row>
              <Row label={tFields("maxCallDuration")}>
                {numberOrDash(trunk.maxCallDurationSeconds)}
              </Row>
              <Row label={tFields("capacityLines")}>
                {numberOrDash(trunk.capacityLines)}
              </Row>
              <Row label={tFields("rtpTimeout")}>
                {numberOrDash(trunk.rtpTimeoutSeconds)}
              </Row>
            </Section>
          </div>

          <VoiceTrunkFormModal
            open={editOpen}
            mode="edit"
            trunk={trunk}
            onClose={() => setEditOpen(false)}
            onSaved={() => {
              setEditOpen(false);
              invalidate();
            }}
          />

          <VoiceTrunkIpsModal
            open={ipsOpen}
            trunk={detailToListItem(trunk)}
            onClose={() => setIpsOpen(false)}
            onMutate={invalidate}
          />
        </>
      )}
    </div>
  );
}
