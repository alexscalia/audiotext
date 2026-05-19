"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import type {
  VoiceTrunkIp,
  VoiceTrunkIpListResponse,
  VoiceTrunkIpStatus,
  VoiceTrunkListItem,
} from "@audiotext/shared";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/form/field";
import { TextInput } from "@/components/form/text-input";
import { Select } from "@/components/form/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { CheckIcon, PencilIcon, TrashIcon, XIcon } from "@/components/ui/icons";
import type { Tone } from "@/components/ui/badge";
import { api } from "@/lib/api-client";

const STATUS_TONES: Record<VoiceTrunkIpStatus, Tone> = {
  active: "success",
  inactive: "danger",
};

const ROW_GRID_STYLE = {
  gridTemplateColumns: "minmax(0,1fr) 140px 140px 100px",
} as const;

const STATUS_VALUES: readonly VoiceTrunkIpStatus[] = ["active", "inactive"];

const MAX_CIDR_HOSTS = 256;

const errMsg = {
  required: "required",
  ipInvalid: "ipInvalid",
  tooLong: "tooLong",
  cidrInvalid: "cidrInvalid",
  cidrTooLarge: "cidrTooLarge",
} as const;

function looksLikeCidr(v: string): boolean {
  return v.trim().includes("/");
}

function cidrCount(input: string): number | null {
  const trimmed = input.trim();
  const slash = trimmed.indexOf("/");
  if (slash === -1) return null;
  const prefix = Number(trimmed.slice(slash + 1));
  if (!Number.isInteger(prefix) || prefix < 0) return null;
  const addr = trimmed.slice(0, slash);
  if (z.ipv4().safeParse(addr).success) {
    if (prefix < 0 || prefix > 32) return null;
    return 2 ** (32 - prefix);
  }
  if (z.ipv6().safeParse(addr).success) {
    if (prefix < 0 || prefix > 128) return null;
    const bits = 128 - prefix;
    if (bits > 30) return Number.MAX_SAFE_INTEGER;
    return 2 ** bits;
  }
  return null;
}

const addFormSchema = z
  .object({
    input: z.string().trim().min(1, errMsg.required),
    prefix: z.string().trim().max(64, errMsg.tooLong).optional(),
    status: z.enum(["active", "inactive"]),
  })
  .superRefine((val, ctx) => {
    const v = val.input;
    if (looksLikeCidr(v)) {
      if (!/^[0-9a-fA-F.:]+\/\d{1,3}$/.test(v)) {
        ctx.addIssue({
          code: "custom",
          path: ["input"],
          message: errMsg.cidrInvalid,
        });
        return;
      }
      const count = cidrCount(v);
      if (count === null) {
        ctx.addIssue({
          code: "custom",
          path: ["input"],
          message: errMsg.cidrInvalid,
        });
        return;
      }
      if (count > MAX_CIDR_HOSTS) {
        ctx.addIssue({
          code: "custom",
          path: ["input"],
          message: errMsg.cidrTooLarge,
        });
      }
    } else {
      const ok =
        z.ipv4().safeParse(v).success || z.ipv6().safeParse(v).success;
      if (!ok) {
        ctx.addIssue({
          code: "custom",
          path: ["input"],
          message: errMsg.ipInvalid,
        });
      }
    }
  });
type AddFormValues = z.infer<typeof addFormSchema>;

const editFormSchema = z.object({
  prefix: z.string().trim().max(64, errMsg.tooLong),
  status: z.enum(["active", "inactive"]),
});
type EditFormValues = z.infer<typeof editFormSchema>;

type ConflictPayload = {
  error:
    | "duplicate_ip"
    | "ip_owned_by_other_carrier"
    | "cidr_too_large"
    | "cidr_invalid";
  existingCarrierName?: string;
  conflictingIp?: string;
  detail?: string;
};

type Props = {
  open: boolean;
  trunk: VoiceTrunkListItem | null;
  onClose: () => void;
  onMutate: () => void;
};

export function VoiceTrunkIpsModal({ open, trunk, onClose, onMutate }: Props) {
  const t = useTranslations("VoiceTrunks.ipsModal");
  const tStatus = useTranslations("VoiceTrunks.ipsModal.status");
  const tErrors = useTranslations("VoiceTrunks.ipsModal.errors");
  const tFields = useTranslations("VoiceTrunks.ipsModal.fields");
  const tCols = useTranslations("VoiceTrunks.ipsModal.columns");
  const tActions = useTranslations("VoiceTrunks.actions");

  const trunkId = trunk?.id ?? "";
  const queryClient = useQueryClient();
  const ipsQuery = useQuery({
    queryKey: ["voice-trunk-ips", trunkId] as const,
    enabled: !!trunkId && open,
    queryFn: async ({ signal }) => {
      const res = await api.api.admin["voice-trunks"][":id"].ips.$get(
        { param: { id: trunkId } },
        { init: { signal, credentials: "include" } },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as VoiceTrunkIpListResponse;
      return json.ips;
    },
  });

  const ips: VoiceTrunkIp[] = ipsQuery.data ?? [];

  const [statusTab, setStatusTab] = useState<"all" | VoiceTrunkIpStatus>("all");

  const counts = useMemo(() => {
    let active = 0;
    let inactive = 0;
    for (const ip of ips) {
      if (ip.status === "active") active++;
      else if (ip.status === "inactive") inactive++;
    }
    return { all: ips.length, active, inactive };
  }, [ips]);

  const filteredIps = useMemo(
    () =>
      statusTab === "all" ? ips : ips.filter((ip) => ip.status === statusTab),
    [ips, statusTab],
  );

  const { standalone, groups } = useMemo(() => {
    const standalone: VoiceTrunkIp[] = [];
    const groups = new Map<string, VoiceTrunkIp[]>();
    for (const ip of filteredIps) {
      if (ip.sourceCidr) {
        const arr = groups.get(ip.sourceCidr) ?? [];
        arr.push(ip);
        groups.set(ip.sourceCidr, arr);
      } else {
        standalone.push(ip);
      }
    }
    return {
      standalone,
      groups: Array.from(groups.entries())
        .map(([cidr, members]) => ({ cidr, members }))
        .sort((a, b) => a.cidr.localeCompare(b.cidr)),
    };
  }, [filteredIps]);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["voice-trunk-ips", trunkId] });

  const onChanged = () => {
    invalidate();
    onMutate();
  };

  return (
    <Modal
      open={open && !!trunk}
      onClose={onClose}
      title={trunk ? trunk.name : ""}
      description={t("subtitle")}
      closeLabel={tActions("open")}
      size="2xl"
      footer={
        <Button variant="secondary" onClick={onClose}>
          {t("cancel")}
        </Button>
      }
    >
      <div className="space-y-6">
        {trunkId && (
          <AddIpOrCidrForm
            trunkId={trunkId}
            onAdded={onChanged}
            tFields={tFields}
            tErrors={tErrors}
            tStatus={tStatus}
            tLabels={{
              add: t("add"),
              adding: t("adding"),
              addCidr: t("addCidr"),
            }}
          />
        )}

        <div className="rounded-md border border-gray-200">
          <div
            role="tablist"
            aria-label={t("filterByStatus")}
            className="flex gap-1 border-b border-gray-200 px-3 pt-2"
          >
            {(
              [
                { id: "all" as const, label: t("tabs.all"), count: counts.all },
                {
                  id: "active" as const,
                  label: t("tabs.active"),
                  count: counts.active,
                },
                {
                  id: "inactive" as const,
                  label: t("tabs.inactive"),
                  count: counts.inactive,
                },
              ]
            ).map((tab) => {
              const selected = statusTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setStatusTab(tab.id)}
                  className={`-mb-px cursor-pointer border-b-2 px-3 py-2 text-sm font-medium transition-colors duration-150 motion-reduce:transition-none focus:outline-none focus-visible:ring-1 focus-visible:ring-black ${
                    selected
                      ? "border-black text-black"
                      : "border-transparent text-gray-600 hover:text-black"
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    {tab.label}
                    <span
                      className={`inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-xs font-semibold ${
                        selected
                          ? "bg-black text-white"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {tab.count}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <div
            style={ROW_GRID_STYLE}
            className="grid items-center gap-3 border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-600"
          >
            <span className="text-left">{tCols("ip")}</span>
            <span className="text-center">{tCols("prefix")}</span>
            <span className="text-center">{tCols("status")}</span>
            <span className="text-center">{tCols("actions")}</span>
          </div>

          {ipsQuery.isPending && (
            <div className="px-3 py-4 text-sm text-gray-500">{t("loading")}</div>
          )}
          {ipsQuery.isError && (
            <div className="px-3 py-4 text-sm text-red-600">
              {t("loadError")}
            </div>
          )}
          {!ipsQuery.isPending &&
            !ipsQuery.isError &&
            standalone.length === 0 &&
            groups.length === 0 && (
              <div className="px-3 py-4 text-sm text-gray-500">{t("empty")}</div>
            )}

          <ul className="divide-y divide-gray-100">
            {standalone.map((ip) => (
              <IpRow
                key={ip.id}
                trunkId={trunkId}
                ip={ip}
                onChanged={onChanged}
                tStatus={tStatus}
                tErrors={tErrors}
                t={t}
              />
            ))}
            {groups.map((g) => (
              <CidrGroupRow
                key={g.cidr}
                trunkId={trunkId}
                cidr={g.cidr}
                members={g.members}
                onChanged={onChanged}
                tStatus={tStatus}
                tErrors={tErrors}
                t={t}
              />
            ))}
          </ul>
        </div>
      </div>
    </Modal>
  );
}

type AddFormProps = {
  trunkId: string;
  onAdded: () => void;
  tFields: ReturnType<typeof useTranslations>;
  tErrors: ReturnType<typeof useTranslations>;
  tStatus: ReturnType<typeof useTranslations>;
  tLabels: { add: string; adding: string; addCidr: string };
};

function AddIpOrCidrForm({
  trunkId,
  onAdded,
  tFields,
  tErrors,
  tStatus,
  tLabels,
}: AddFormProps) {
  const formId = useId();
  const [conflict, setConflict] = useState<ConflictPayload | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<AddFormValues>({
    resolver: zodResolver(addFormSchema),
    defaultValues: { input: "", prefix: "", status: "active" },
    mode: "onBlur",
  });

  const inputValue = watch("input");
  const isCidr = inputValue ? looksLikeCidr(inputValue) : false;

  const mutation = useMutation({
    mutationFn: async (values: AddFormValues) => {
      const v = values.input.trim();
      const sharedPrefix =
        values.prefix && values.prefix.length > 0
          ? values.prefix.trim()
          : undefined;
      const payload = looksLikeCidr(v)
        ? {
            kind: "cidr" as const,
            cidr: v,
            ...(sharedPrefix ? { prefix: sharedPrefix } : {}),
            status: values.status,
          }
        : {
            kind: "single" as const,
            ip: v,
            ...(sharedPrefix ? { prefix: sharedPrefix } : {}),
            status: values.status,
          };
      const res = await api.api.admin["voice-trunks"][":id"].ips.$post(
        { param: { id: trunkId }, json: payload },
        { init: { credentials: "include" } },
      );
      if (res.status === 409 || res.status === 422) {
        const body = (await res.json()) as ConflictPayload;
        throw body;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    onSuccess: () => {
      reset({ input: "", prefix: "", status: "active" });
      setConflict(null);
      onAdded();
    },
    onError: (err) => {
      if (
        err &&
        typeof err === "object" &&
        "error" in err &&
        typeof (err as ConflictPayload).error === "string"
      ) {
        setConflict(err as ConflictPayload);
      } else {
        setConflict({ error: "duplicate_ip" });
      }
    },
  });

  const translateError = (key?: string) =>
    key ? tErrors(key as Parameters<typeof tErrors>[0]) : null;

  const conflictMessage = (() => {
    if (!conflict) return null;
    switch (conflict.error) {
      case "ip_owned_by_other_carrier":
        return tErrors("ownedByOtherCarrier", {
          carrier: conflict.existingCarrierName ?? "—",
          ip: conflict.conflictingIp ?? "",
        });
      case "cidr_too_large":
        return tErrors("cidrTooLarge");
      case "cidr_invalid":
        return tErrors("cidrInvalid");
      case "duplicate_ip":
      default:
        return tErrors("duplicate");
    }
  })();

  const submitLabel = mutation.isPending
    ? tLabels.adding
    : isCidr
      ? tLabels.addCidr
      : tLabels.add;

  return (
    <form
      id={formId}
      onSubmit={handleSubmit((values) => {
        setConflict(null);
        mutation.mutate(values);
      })}
      className="space-y-3"
      noValidate
    >
      <div className="grid items-start gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <Field
          label={tFields("ipOrCidr")}
          required
          error={translateError(errors.input?.message)}
          htmlFor={`${formId}-input`}
        >
          <TextInput
            id={`${formId}-input`}
            autoComplete="off"
            placeholder={tFields("ipOrCidrPlaceholder")}
            invalid={!!errors.input}
            {...register("input")}
          />
        </Field>
        <Field
          label={tFields("prefix")}
          error={translateError(errors.prefix?.message)}
          htmlFor={`${formId}-prefix`}
        >
          <TextInput
            id={`${formId}-prefix`}
            autoComplete="off"
            placeholder={tFields("prefixPlaceholder")}
            invalid={!!errors.prefix}
            {...register("prefix")}
          />
        </Field>
        <Field label={tFields("status")} htmlFor={`${formId}-status`}>
          <Select id={`${formId}-status`} {...register("status")}>
            {STATUS_VALUES.map((s) => (
              <option key={s} value={s}>
                {tStatus(s)}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {conflictMessage && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {conflictMessage}
        </div>
      )}
      <div className="flex justify-end">
        <Button type="submit" disabled={mutation.isPending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

type IpRowProps = {
  trunkId: string;
  ip: VoiceTrunkIp;
  onChanged: () => void;
  tStatus: ReturnType<typeof useTranslations>;
  tErrors: ReturnType<typeof useTranslations>;
  t: ReturnType<typeof useTranslations>;
};

function IpRow({ trunkId, ip, onChanged, tStatus, tErrors, t }: IpRowProps) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
    },
    [],
  );

  const updateMutation = useMutation({
    mutationFn: async (values: EditFormValues) => {
      const payload = {
        prefix: values.prefix.length > 0 ? values.prefix.trim() : null,
        status: values.status,
      };
      const res = await api.api.admin["voice-trunks"][":id"].ips[":ipId"].$patch(
        { param: { id: trunkId, ipId: ip.id }, json: payload },
        { init: { credentials: "include" } },
      );
      if (res.status === 409) {
        const body = (await res.json()) as ConflictPayload;
        throw body;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    onSuccess: () => {
      setEditing(false);
      setError(null);
      onChanged();
    },
    onError: (err) => setError(formatRowError(err, tErrors)),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await api.api.admin["voice-trunks"][":id"].ips[
        ":ipId"
      ].$delete(
        { param: { id: trunkId, ipId: ip.id } },
        { init: { credentials: "include" } },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    },
    onSuccess: () => {
      setError(null);
      onChanged();
    },
    onError: () => setError(tErrors("saveError")),
  });

  const editForm = useForm<EditFormValues>({
    resolver: zodResolver(editFormSchema),
    defaultValues: { prefix: ip.prefix ?? "", status: ip.status },
    mode: "onBlur",
  });

  useEffect(() => {
    editForm.reset({ prefix: ip.prefix ?? "", status: ip.status });
  }, [ip.prefix, ip.status, editForm]);

  const onDeleteClick = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      confirmTimer.current = setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    setConfirmDelete(false);
    deleteMutation.mutate();
  };

  if (editing) {
    return (
      <li className="px-3 py-2">
        <form
          onSubmit={editForm.handleSubmit((values) =>
            updateMutation.mutate(values),
          )}
          style={ROW_GRID_STYLE}
          className="grid items-center gap-3"
          noValidate
        >
          <span className="truncate font-mono text-sm text-gray-700">
            {ip.ip}
          </span>
          <TextInput
            autoComplete="off"
            invalid={!!editForm.formState.errors.prefix}
            {...editForm.register("prefix")}
          />
          <Select {...editForm.register("status")}>
            {STATUS_VALUES.map((s) => (
              <option key={s} value={s}>
                {tStatus(s)}
              </option>
            ))}
          </Select>
          <div className="flex items-center justify-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              aria-label={t("cancel")}
              title={t("cancel")}
              onClick={() => {
                setEditing(false);
                setError(null);
                editForm.reset({
                  prefix: ip.prefix ?? "",
                  status: ip.status,
                });
              }}
            >
              <XIcon className="h-4 w-4" />
            </Button>
            <Button
              type="submit"
              size="sm"
              aria-label={updateMutation.isPending ? t("saving") : t("save")}
              title={updateMutation.isPending ? t("saving") : t("save")}
              disabled={updateMutation.isPending}
            >
              <CheckIcon className="h-4 w-4" />
            </Button>
          </div>
        </form>
        {error && (
          <div
            role="alert"
            className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </div>
        )}
      </li>
    );
  }

  return (
    <li className="px-3 py-2">
      <div style={ROW_GRID_STYLE} className="grid items-center gap-3">
        <span className="truncate font-mono text-sm text-gray-800">
          {ip.ip}
        </span>
        <span className="truncate text-center text-sm text-gray-700">
          {ip.prefix ?? "—"}
        </span>
        <span className="justify-self-center">
          <StatusBadge
            status={ip.status}
            tones={STATUS_TONES}
            label={tStatus(ip.status)}
          />
        </span>
        <div className="flex items-center justify-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            aria-label={t("edit")}
            title={t("edit")}
            onClick={() => {
              setEditing(true);
              setError(null);
            }}
          >
            <PencilIcon className="h-4 w-4" />
          </Button>
          <Button
            variant={confirmDelete ? "danger" : "ghost"}
            size="sm"
            aria-label={confirmDelete ? t("confirmDelete") : t("delete")}
            title={confirmDelete ? t("confirmDelete") : t("delete")}
            onClick={onDeleteClick}
            disabled={deleteMutation.isPending}
          >
            <TrashIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {error && (
        <div
          role="alert"
          className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </div>
      )}
    </li>
  );
}

type CidrGroupRowProps = {
  trunkId: string;
  cidr: string;
  members: VoiceTrunkIp[];
  onChanged: () => void;
  tStatus: ReturnType<typeof useTranslations>;
  tErrors: ReturnType<typeof useTranslations>;
  t: ReturnType<typeof useTranslations>;
};

function CidrGroupRow({
  trunkId,
  cidr,
  members,
  onChanged,
  tStatus,
  tErrors,
  t,
}: CidrGroupRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
    },
    [],
  );

  // Derive group summary: prefix/status are shared if all members agree.
  const sharedPrefix = useMemo(() => {
    const first = members[0]?.prefix ?? null;
    return members.every((m) => m.prefix === first) ? first : null;
  }, [members]);
  const sharedStatus = useMemo<VoiceTrunkIpStatus | "mixed">(() => {
    const first = members[0]?.status ?? "active";
    return members.every((m) => m.status === first) ? first : "mixed";
  }, [members]);

  const editForm = useForm<EditFormValues>({
    resolver: zodResolver(editFormSchema),
    defaultValues: {
      prefix: sharedPrefix ?? "",
      status: sharedStatus === "mixed" ? "active" : sharedStatus,
    },
    mode: "onBlur",
  });

  useEffect(() => {
    editForm.reset({
      prefix: sharedPrefix ?? "",
      status: sharedStatus === "mixed" ? "active" : sharedStatus,
    });
  }, [sharedPrefix, sharedStatus, editForm]);

  const updateMutation = useMutation({
    mutationFn: async (values: EditFormValues) => {
      const payload = {
        sourceCidr: cidr,
        prefix: values.prefix.length > 0 ? values.prefix.trim() : null,
        status: values.status,
      };
      const res = await api.api.admin["voice-trunks"][":id"].ips.range.$patch(
        { param: { id: trunkId }, json: payload },
        { init: { credentials: "include" } },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    onSuccess: () => {
      setEditing(false);
      setError(null);
      onChanged();
    },
    onError: (err) => setError(formatRowError(err, tErrors)),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await api.api.admin["voice-trunks"][":id"].ips.range.$delete(
        { param: { id: trunkId }, json: { sourceCidr: cidr } },
        { init: { credentials: "include" } },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    onSuccess: () => {
      setError(null);
      onChanged();
    },
    onError: () => setError(tErrors("saveError")),
  });

  const onDeleteClick = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      confirmTimer.current = setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    setConfirmDelete(false);
    deleteMutation.mutate();
  };

  const statusBadge =
    sharedStatus === "mixed" ? (
      <StatusBadge
        status="mixed"
        tones={{ mixed: "warn" }}
        label={t("statusMixed")}
      />
    ) : (
      <StatusBadge
        status={sharedStatus}
        tones={STATUS_TONES}
        label={tStatus(sharedStatus)}
      />
    );
  const prefixLabel = sharedPrefix ?? (members.length > 0 ? t("prefixMixed") : "—");

  if (editing) {
    return (
      <li className="bg-gray-50 px-3 py-2">
        <form
          onSubmit={editForm.handleSubmit((values) =>
            updateMutation.mutate(values),
          )}
          style={ROW_GRID_STYLE}
          className="grid items-center gap-3"
          noValidate
        >
          <span className="truncate font-mono text-sm font-semibold text-gray-800">
            {cidr}
          </span>
          <TextInput
            autoComplete="off"
            placeholder={t("prefixSharedPlaceholder")}
            invalid={!!editForm.formState.errors.prefix}
            {...editForm.register("prefix")}
          />
          <Select {...editForm.register("status")}>
            {STATUS_VALUES.map((s) => (
              <option key={s} value={s}>
                {tStatus(s)}
              </option>
            ))}
          </Select>
          <div className="flex items-center justify-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              aria-label={t("cancel")}
              title={t("cancel")}
              onClick={() => {
                setEditing(false);
                setError(null);
                editForm.reset({
                  prefix: sharedPrefix ?? "",
                  status: sharedStatus === "mixed" ? "active" : sharedStatus,
                });
              }}
            >
              <XIcon className="h-4 w-4" />
            </Button>
            <Button
              type="submit"
              size="sm"
              aria-label={updateMutation.isPending ? t("saving") : t("save")}
              title={updateMutation.isPending ? t("saving") : t("save")}
              disabled={updateMutation.isPending}
            >
              <CheckIcon className="h-4 w-4" />
            </Button>
          </div>
        </form>
        <p className="mt-1 text-xs text-gray-500">
          {t("rangeEditHint", { count: members.length })}
        </p>
        {error && (
          <div
            role="alert"
            className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </div>
        )}
      </li>
    );
  }

  return (
    <li className="bg-gray-50">
      <div
        style={ROW_GRID_STYLE}
        className="grid items-center gap-3 px-3 py-2"
      >
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex min-w-0 items-center gap-2 text-left"
          aria-expanded={expanded}
          aria-label={expanded ? t("collapse") : t("expand")}
        >
          <span
            aria-hidden="true"
            className={`inline-block h-3 w-3 shrink-0 transition-transform ${
              expanded ? "rotate-90" : ""
            }`}
          >
            ▶
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-mono text-sm font-semibold text-gray-900">
              {cidr}
            </span>
            <span className="text-xs text-gray-500">
              {t("memberCount", { count: members.length })}
            </span>
          </span>
        </button>
        <span className="truncate text-center text-sm text-gray-700">
          {prefixLabel}
        </span>
        <span className="justify-self-center">{statusBadge}</span>
        <div className="flex items-center justify-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            aria-label={t("editRange")}
            title={t("editRange")}
            onClick={() => {
              setEditing(true);
              setError(null);
            }}
          >
            <PencilIcon className="h-4 w-4" />
          </Button>
          <Button
            variant={confirmDelete ? "danger" : "ghost"}
            size="sm"
            aria-label={confirmDelete ? t("confirmDelete") : t("deleteRange")}
            title={confirmDelete ? t("confirmDelete") : t("deleteRange")}
            onClick={onDeleteClick}
            disabled={deleteMutation.isPending}
          >
            <TrashIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {error && (
        <div
          role="alert"
          className="mx-3 mb-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </div>
      )}
      {expanded && (
        <ul className="divide-y divide-gray-100 border-t border-gray-200 bg-white">
          {members.map((m) => (
            <li
              key={m.id}
              style={ROW_GRID_STYLE}
              className="grid items-center gap-3 px-3 py-1.5"
            >
              <span className="truncate pl-5 font-mono text-xs text-gray-700">
                {m.ip}
              </span>
              <span className="truncate text-center text-xs text-gray-600">
                {m.prefix ?? "—"}
              </span>
              <span className="justify-self-center">
                <StatusBadge
                  status={m.status}
                  tones={STATUS_TONES}
                  label={tStatus(m.status)}
                />
              </span>
              <span />
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function formatRowError(
  err: unknown,
  tErrors: ReturnType<typeof useTranslations>,
): string {
  if (err && typeof err === "object" && "error" in err) {
    const e = err as ConflictPayload;
    switch (e.error) {
      case "ip_owned_by_other_carrier":
        return tErrors("ownedByOtherCarrier", {
          carrier: e.existingCarrierName ?? "—",
          ip: e.conflictingIp ?? "",
        });
      case "cidr_too_large":
        return tErrors("cidrTooLarge");
      case "cidr_invalid":
        return tErrors("cidrInvalid");
      case "duplicate_ip":
      default:
        return tErrors("duplicate");
    }
  }
  return tErrors("saveError");
}
