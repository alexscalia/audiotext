"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import type {
  CarrierListResponse,
  VoiceRateSheetListResponse,
  VoiceTrunkDetail,
} from "@audiotext/shared";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/form/field";
import { TextInput } from "@/components/form/text-input";
import { Select } from "@/components/form/select";
import { api } from "@/lib/api-client";

const errMsg = {
  required: "required",
  tooLong: "tooLong",
  intRequired: "intRequired",
  minOne: "minOne",
  invalidCodec: "invalidCodec",
  rateSheetRequired: "rate_sheet_required",
} as const;

const CODEC_REGEX = /^[a-z0-9]+$/;

const formSchema = z
  .object({
    carrierId: z.string().min(1, errMsg.required),
    voiceRateSheetId: z.string(),
    name: z.string().trim().min(1, errMsg.required).max(128, errMsg.tooLong),
    status: z.enum(["active", "inactive", "testing"]),
    direction: z.enum(["inbound", "outbound", "both"]),
    protocol: z.enum(["sip", "sips"]),
    transport: z.enum(["udp", "tcp", "tls"]),
    authType: z.enum(["ip", "userpass", "both"]),
    username: z.string().trim().max(128, errMsg.tooLong),
    password: z.string().max(256, errMsg.tooLong),
    changePassword: z.boolean(),
    realm: z.string().trim().max(255, errMsg.tooLong),
    fromUser: z.string().trim().max(128, errMsg.tooLong),
    fromDomain: z.string().trim().max(255, errMsg.tooLong),
    registerEnabled: z.boolean(),
    expiresSeconds: z.string(),
    qualifySeconds: z.string(),
    maxChannels: z.string(),
    cpsLimit: z.string(),
    maxCallDurationSeconds: z.string(),
    capacityLines: z.string(),
    rtpTimeoutSeconds: z.string(),
    codecs: z
      .array(z.string())
      .refine((arr) => arr.every((c) => CODEC_REGEX.test(c)), {
        message: errMsg.invalidCodec,
      }),
    dtmfMode: z.enum(["rfc2833", "inband", "info"]),
    natMode: z.enum(["no", "yes", "force_rport", "comedia"]),
  })
  .superRefine((val, ctx) => {
    const needsCreds = val.authType === "userpass" || val.authType === "both";
    if (needsCreds && val.username.trim().length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["username"],
        message: errMsg.required,
      });
    }
    if (needsCreds && val.changePassword && val.password.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["password"],
        message: errMsg.required,
      });
    }
    if (val.status === "active" && val.voiceRateSheetId.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["voiceRateSheetId"],
        message: errMsg.rateSheetRequired,
      });
    }
  });

type FormValues = z.infer<typeof formSchema>;

type Mode = "create" | "edit";

type Props = {
  open: boolean;
  mode: Mode;
  trunk: VoiceTrunkDetail | null;
  onClose: () => void;
  onSaved: () => void;
};

const STATUS_VALUES = ["active", "inactive", "testing"] as const;
const DIRECTION_VALUES = ["inbound", "outbound", "both"] as const;
const PROTOCOL_VALUES = ["sip", "sips"] as const;
const TRANSPORT_VALUES = ["udp", "tcp", "tls"] as const;
const AUTH_VALUES = ["ip", "userpass", "both"] as const;
const DTMF_VALUES = ["rfc2833", "inband", "info"] as const;
const NAT_VALUES = ["no", "yes", "force_rport", "comedia"] as const;

const EMPTY: FormValues = {
  carrierId: "",
  voiceRateSheetId: "",
  name: "",
  status: "active",
  direction: "both",
  protocol: "sip",
  transport: "udp",
  authType: "ip",
  username: "",
  password: "",
  changePassword: true,
  realm: "",
  fromUser: "",
  fromDomain: "",
  registerEnabled: false,
  expiresSeconds: "",
  qualifySeconds: "",
  maxChannels: "",
  cpsLimit: "",
  maxCallDurationSeconds: "",
  capacityLines: "",
  rtpTimeoutSeconds: "",
  codecs: [],
  dtmfMode: "rfc2833",
  natMode: "no",
};

function fromTrunk(t: VoiceTrunkDetail): FormValues {
  return {
    carrierId: t.carrierId,
    voiceRateSheetId: t.voiceRateSheetId ?? "",
    name: t.name,
    status: t.status,
    direction: t.direction,
    protocol: t.protocol,
    transport: t.transport,
    authType: t.authType,
    username: t.username ?? "",
    password: "",
    changePassword: false,
    realm: t.realm ?? "",
    fromUser: t.fromUser ?? "",
    fromDomain: t.fromDomain ?? "",
    registerEnabled: t.registerEnabled,
    expiresSeconds: t.expiresSeconds?.toString() ?? "",
    qualifySeconds: t.qualifySeconds?.toString() ?? "",
    maxChannels: t.maxChannels?.toString() ?? "",
    cpsLimit: t.cpsLimit?.toString() ?? "",
    maxCallDurationSeconds: t.maxCallDurationSeconds?.toString() ?? "",
    capacityLines: t.capacityLines?.toString() ?? "",
    rtpTimeoutSeconds: t.rtpTimeoutSeconds?.toString() ?? "",
    codecs: t.codecs,
    dtmfMode: t.dtmfMode,
    natMode: t.natMode,
  };
}

function parseIntOpt(s: string): number | undefined {
  const t = s.trim();
  if (t.length === 0) return undefined;
  const n = Number(t);
  if (!Number.isInteger(n) || n <= 0) return undefined;
  return n;
}

function parseIntOrNull(s: string): number | null {
  const t = s.trim();
  if (t.length === 0) return null;
  const n = Number(t);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

type ServerError = { error?: string };

export function VoiceTrunkFormModal({
  open,
  mode,
  trunk,
  onClose,
  onSaved,
}: Props) {
  const t = useTranslations("VoiceTrunks");
  const tForm = useTranslations("VoiceTrunks.form");
  const tFields = useTranslations("VoiceTrunks.form.fields");
  const tSections = useTranslations("VoiceTrunks.form.sections");
  const tStatus = useTranslations("VoiceTrunks.status");
  const tErrors = useTranslations("VoiceTrunks.form.errors");
  const tActions = useTranslations("VoiceTrunks.actions");

  const formId = useId();
  const [serverError, setServerError] = useState<string | null>(null);
  const [codecDraft, setCodecDraft] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: EMPTY,
    mode: "onBlur",
  });

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && trunk) {
      reset(fromTrunk(trunk));
    } else {
      reset(EMPTY);
    }
    setServerError(null);
    setCodecDraft("");
  }, [open, mode, trunk, reset]);

  const authType = watch("authType");
  const changePassword = watch("changePassword");
  const codecs = watch("codecs");
  const needsCreds = authType === "userpass" || authType === "both";

  const carriersQuery = useQuery({
    queryKey: ["carriers-picker"],
    enabled: open,
    queryFn: async ({ signal }) => {
      const res = await api.api.admin.carriers.$get(
        { query: { pageSize: "100", sortBy: "name", sortDir: "asc" } },
        { init: { signal, credentials: "include" } },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as CarrierListResponse;
    },
  });

  const rateSheetsQuery = useQuery({
    queryKey: ["voice-rate-sheets-picker"],
    enabled: open,
    queryFn: async ({ signal }) => {
      const res = await api.api.admin["voice-rate-sheets"].$get(
        { query: { pageSize: "100", sortBy: "name", sortDir: "asc" } },
        { init: { signal, credentials: "include" } },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as VoiceRateSheetListResponse;
    },
  });

  const carriers = carriersQuery.data?.carriers ?? [];
  const rateSheets = rateSheetsQuery.data?.rateSheets ?? [];

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const sendCreds = needsCreds;
      const base = {
        carrierId: values.carrierId,
        voiceRateSheetId:
          values.voiceRateSheetId.length > 0 ? values.voiceRateSheetId : null,
        name: values.name.trim(),
        status: values.status,
        direction: values.direction,
        protocol: values.protocol,
        transport: values.transport,
        realm: values.realm.trim() || undefined,
        fromUser: values.fromUser.trim() || undefined,
        fromDomain: values.fromDomain.trim() || undefined,
        registerEnabled: values.registerEnabled,
        expiresSeconds: parseIntOpt(values.expiresSeconds),
        qualifySeconds: parseIntOpt(values.qualifySeconds),
        maxChannels: parseIntOpt(values.maxChannels),
        cpsLimit: parseIntOpt(values.cpsLimit),
        maxCallDurationSeconds: parseIntOpt(values.maxCallDurationSeconds),
        capacityLines: parseIntOpt(values.capacityLines),
        rtpTimeoutSeconds: parseIntOpt(values.rtpTimeoutSeconds),
        codecs: values.codecs,
        dtmfMode: values.dtmfMode,
        natMode: values.natMode,
      };

      if (mode === "create") {
        const payload =
          values.authType === "ip"
            ? { ...base, authType: "ip" as const }
            : {
                ...base,
                authType: values.authType,
                username: values.username.trim(),
                password: values.password,
              };
        const res = await api.api.admin["voice-trunks"].$post(
          { json: payload },
          { init: { credentials: "include" } },
        );
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as ServerError;
          throw body;
        }
        return res.json();
      }

      if (!trunk) throw new Error("missing trunk");
      const patch: Record<string, unknown> = { ...base, authType: values.authType };
      if (sendCreds) {
        patch.username = values.username.trim();
        if (values.changePassword && values.password.length > 0) {
          patch.password = values.password;
        }
      }
      const res = await api.api.admin["voice-trunks"][":id"].$patch(
        { param: { id: trunk.id }, json: patch },
        { init: { credentials: "include" } },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as ServerError;
        throw body;
      }
      return res.json();
    },
    onSuccess: () => {
      onSaved();
      onClose();
    },
    onError: (err) => {
      const e = err as ServerError;
      const key = e?.error ?? "saveError";
      setServerError(key);
    },
  });

  const translateError = (k?: string) =>
    k ? tErrors(k as Parameters<typeof tErrors>[0]) : null;

  const addCodec = () => {
    const v = codecDraft.trim().toLowerCase();
    if (!v) return;
    if (!CODEC_REGEX.test(v) || v.length < 2 || v.length > 16) return;
    const current = getValues("codecs");
    if (current.includes(v)) {
      setCodecDraft("");
      return;
    }
    setValue("codecs", [...current, v], { shouldDirty: true, shouldValidate: true });
    setCodecDraft("");
  };

  const removeCodec = (codec: string) => {
    setValue(
      "codecs",
      getValues("codecs").filter((c) => c !== codec),
      { shouldDirty: true, shouldValidate: true },
    );
  };

  const codecListId = `${formId}-codecs`;

  const serverErrorMsg = useMemo(() => {
    if (!serverError) return null;
    return translateError(serverError);
  }, [serverError]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === "create" ? tForm("titleCreate") : tForm("titleEdit")}
      description={tForm("subtitle")}
      closeLabel={tActions("close")}
      size="3xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {tForm("cancel")}
          </Button>
          <Button type="submit" form={formId} disabled={isSubmitting}>
            {isSubmitting ? tForm("saving") : tForm("save")}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        onSubmit={handleSubmit((v) => saveMutation.mutate(v))}
        className="space-y-8"
        noValidate
      >
        {serverErrorMsg && (
          <div
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {serverErrorMsg}
          </div>
        )}

        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">
            {tSections("identity")}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={tFields("carrier")}
              required
              error={translateError(errors.carrierId?.message)}
              htmlFor={`${formId}-carrier`}
            >
              <Select
                id={`${formId}-carrier`}
                invalid={!!errors.carrierId}
                {...register("carrierId")}
              >
                <option value="">{tFields("carrierPlaceholder")}</option>
                {carriers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label={tFields("voiceRateSheet")}
              required={watch("status") === "active"}
              error={translateError(errors.voiceRateSheetId?.message)}
              htmlFor={`${formId}-rate-sheet`}
            >
              <Select
                id={`${formId}-rate-sheet`}
                invalid={!!errors.voiceRateSheetId}
                {...register("voiceRateSheetId")}
              >
                <option value="">{tFields("voiceRateSheetNone")}</option>
                {rateSheets.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.currency})
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label={tFields("name")}
              required
              error={translateError(errors.name?.message)}
              htmlFor={`${formId}-name`}
            >
              <TextInput
                id={`${formId}-name`}
                autoComplete="off"
                invalid={!!errors.name}
                {...register("name")}
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
            <Field label={tFields("direction")} htmlFor={`${formId}-direction`}>
              <Select id={`${formId}-direction`} {...register("direction")}>
                {DIRECTION_VALUES.map((v) => (
                  <option key={v} value={v}>
                    {tFields(`directionValues.${v}` as never)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">
            {tSections("auth")}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={tFields("authType")} htmlFor={`${formId}-authType`}>
              <Select id={`${formId}-authType`} {...register("authType")}>
                {AUTH_VALUES.map((v) => (
                  <option key={v} value={v}>
                    {tFields(`authTypeValues.${v}` as never)}
                  </option>
                ))}
              </Select>
            </Field>
            {needsCreds && (
              <Field
                label={tFields("username")}
                required
                error={translateError(errors.username?.message)}
                htmlFor={`${formId}-username`}
              >
                <TextInput
                  id={`${formId}-username`}
                  autoComplete="off"
                  invalid={!!errors.username}
                  {...register("username")}
                />
              </Field>
            )}
            {needsCreds && (
              <Field
                label={tFields("password")}
                required={mode === "create" || changePassword}
                error={translateError(errors.password?.message)}
                htmlFor={`${formId}-password`}
              >
                <div className="space-y-2">
                  {mode === "edit" && (
                    <label className="flex items-center gap-2 text-xs text-gray-600">
                      <input
                        type="checkbox"
                        {...register("changePassword")}
                      />
                      {tForm("changePassword")}
                    </label>
                  )}
                  {(mode === "create" || changePassword) && (
                    <TextInput
                      id={`${formId}-password`}
                      type="password"
                      autoComplete="new-password"
                      invalid={!!errors.password}
                      {...register("password")}
                    />
                  )}
                  {mode === "edit" && !changePassword && trunk?.hasPassword && (
                    <div className="font-mono text-sm text-gray-500">
                      ••••••••
                    </div>
                  )}
                </div>
              </Field>
            )}
            {needsCreds && (
              <Field label={tFields("realm")} htmlFor={`${formId}-realm`}>
                <TextInput
                  id={`${formId}-realm`}
                  autoComplete="off"
                  {...register("realm")}
                />
              </Field>
            )}
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">
            {tSections("signaling")}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={tFields("protocol")} htmlFor={`${formId}-protocol`}>
              <Select id={`${formId}-protocol`} {...register("protocol")}>
                {PROTOCOL_VALUES.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={tFields("transport")} htmlFor={`${formId}-transport`}>
              <Select id={`${formId}-transport`} {...register("transport")}>
                {TRANSPORT_VALUES.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={tFields("fromUser")} htmlFor={`${formId}-fromUser`}>
              <TextInput
                id={`${formId}-fromUser`}
                autoComplete="off"
                {...register("fromUser")}
              />
            </Field>
            <Field label={tFields("fromDomain")} htmlFor={`${formId}-fromDomain`}>
              <TextInput
                id={`${formId}-fromDomain`}
                autoComplete="off"
                {...register("fromDomain")}
              />
            </Field>
            <Field
              label={tFields("expiresSeconds")}
              htmlFor={`${formId}-expires`}
            >
              <TextInput
                id={`${formId}-expires`}
                inputMode="numeric"
                autoComplete="off"
                {...register("expiresSeconds")}
              />
            </Field>
            <Field
              label={tFields("qualifySeconds")}
              htmlFor={`${formId}-qualify`}
            >
              <TextInput
                id={`${formId}-qualify`}
                inputMode="numeric"
                autoComplete="off"
                {...register("qualifySeconds")}
              />
            </Field>
            <Field htmlFor={`${formId}-register`} label="">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  id={`${formId}-register`}
                  type="checkbox"
                  {...register("registerEnabled")}
                />
                {tFields("registerEnabled")}
              </label>
            </Field>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">
            {tSections("capacity")}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={tFields("maxChannels")}
              htmlFor={`${formId}-maxChannels`}
            >
              <TextInput
                id={`${formId}-maxChannels`}
                inputMode="numeric"
                autoComplete="off"
                {...register("maxChannels")}
              />
            </Field>
            <Field label={tFields("cpsLimit")} htmlFor={`${formId}-cpsLimit`}>
              <TextInput
                id={`${formId}-cpsLimit`}
                inputMode="numeric"
                autoComplete="off"
                {...register("cpsLimit")}
              />
            </Field>
            <Field
              label={tFields("maxCallDurationSeconds")}
              htmlFor={`${formId}-maxCallDuration`}
            >
              <TextInput
                id={`${formId}-maxCallDuration`}
                inputMode="numeric"
                autoComplete="off"
                {...register("maxCallDurationSeconds")}
              />
            </Field>
            <Field
              label={tFields("capacityLines")}
              htmlFor={`${formId}-capacityLines`}
            >
              <TextInput
                id={`${formId}-capacityLines`}
                inputMode="numeric"
                autoComplete="off"
                {...register("capacityLines")}
              />
            </Field>
            <Field
              label={tFields("rtpTimeoutSeconds")}
              htmlFor={`${formId}-rtpTimeout`}
            >
              <TextInput
                id={`${formId}-rtpTimeout`}
                inputMode="numeric"
                autoComplete="off"
                {...register("rtpTimeoutSeconds")}
              />
            </Field>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">
            {tSections("media")}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={tFields("dtmfMode")} htmlFor={`${formId}-dtmf`}>
              <Select id={`${formId}-dtmf`} {...register("dtmfMode")}>
                {DTMF_VALUES.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={tFields("natMode")} htmlFor={`${formId}-nat`}>
              <Select id={`${formId}-nat`} {...register("natMode")}>
                {NAT_VALUES.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field
            label={tFields("codecs")}
            error={translateError(errors.codecs?.message as string | undefined)}
            htmlFor={codecListId}
          >
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {codecs.length === 0 && (
                  <span className="text-xs text-gray-500">
                    {tFields("codecsEmpty")}
                  </span>
                )}
                {codecs.map((c) => (
                  <span
                    key={c}
                    className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-800"
                  >
                    {c}
                    <button
                      type="button"
                      onClick={() => removeCodec(c)}
                      className="text-gray-500 hover:text-black"
                      aria-label={tForm("removeCodec", { codec: c })}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <TextInput
                  id={codecListId}
                  autoComplete="off"
                  value={codecDraft}
                  placeholder={tFields("codecsPlaceholder")}
                  onChange={(e) => setCodecDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCodec();
                    }
                  }}
                />
                <Button type="button" variant="secondary" onClick={addCodec}>
                  {tForm("addCodec")}
                </Button>
              </div>
            </div>
          </Field>
        </section>
      </form>
    </Modal>
  );
}
