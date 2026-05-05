"use client";

import { useId, useMemo, useRef, useState } from "react";
import {
  useForm,
  type FieldErrors,
  type Path,
  type UseFormRegisterReturn,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { z } from "zod";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/form/field";
import { TextInput } from "@/components/form/text-input";
import { Select } from "@/components/form/select";

const errMsg = {
  required: "required",
  email: "emailInvalid",
  tooLong: "tooLong",
  iso2: "countryCodeIso2",
} as const;

const carrierFormSchema = z.object({
  name: z.string().trim().min(1, errMsg.required).max(128, errMsg.tooLong),
  businessName: z
    .string()
    .trim()
    .min(1, errMsg.required)
    .max(256, errMsg.tooLong),
  status: z.enum(["active", "inactive"]),
  billingDetails: z.object({
    address: z.object({
      line1: z
        .string()
        .trim()
        .min(1, errMsg.required)
        .max(256, errMsg.tooLong),
      line2: z.string().max(256, errMsg.tooLong).optional(),
      city: z
        .string()
        .trim()
        .min(1, errMsg.required)
        .max(128, errMsg.tooLong),
      state: z.string().max(128, errMsg.tooLong).optional(),
      postalCode: z
        .string()
        .trim()
        .min(1, errMsg.required)
        .max(32, errMsg.tooLong),
      countryCode: z
        .string()
        .trim()
        .regex(/^[A-Z]{2}$/, errMsg.iso2),
    }),
    taxId: z.string().max(64, errMsg.tooLong).optional(),
    paymentTerms: z.string().max(128, errMsg.tooLong).optional(),
    notes: z.string().max(2048, errMsg.tooLong).optional(),
    bank: z
      .object({
        name: z
          .string()
          .trim()
          .min(1, errMsg.required)
          .max(128, errMsg.tooLong),
        accountNumber: z
          .string()
          .trim()
          .min(1, errMsg.required)
          .max(64, errMsg.tooLong),
        routingNumber: z.string().max(32, errMsg.tooLong).optional(),
        iban: z.string().max(34, errMsg.tooLong).optional(),
        swift: z.string().max(11, errMsg.tooLong).optional(),
      })
      .optional(),
  }),
  ratesName: z
    .string()
    .trim()
    .min(1, errMsg.required)
    .max(128, errMsg.tooLong),
  ratesEmail: z
    .string()
    .trim()
    .min(1, errMsg.required)
    .email(errMsg.email)
    .max(256, errMsg.tooLong),
  ratesPhone: z.string().max(32, errMsg.tooLong).optional(),
  billingName: z
    .string()
    .trim()
    .min(1, errMsg.required)
    .max(128, errMsg.tooLong),
  billingEmail: z
    .string()
    .trim()
    .min(1, errMsg.required)
    .email(errMsg.email)
    .max(256, errMsg.tooLong),
  billingPhone: z.string().max(32, errMsg.tooLong).optional(),
  nocName: z
    .string()
    .trim()
    .min(1, errMsg.required)
    .max(128, errMsg.tooLong),
  nocEmail: z
    .string()
    .trim()
    .min(1, errMsg.required)
    .email(errMsg.email)
    .max(256, errMsg.tooLong),
  nocPhone: z.string().max(32, errMsg.tooLong).optional(),
  salesName: z
    .string()
    .trim()
    .min(1, errMsg.required)
    .max(128, errMsg.tooLong),
  salesEmail: z
    .string()
    .trim()
    .min(1, errMsg.required)
    .email(errMsg.email)
    .max(256, errMsg.tooLong),
  salesPhone: z.string().max(32, errMsg.tooLong).optional(),
});

export type CarrierFormValues = z.infer<typeof carrierFormSchema>;

type TabId = "general" | "billing" | "contacts";

type NewCarrierModalProps = {
  open: boolean;
  onClose: () => void;
  onCreate: (values: CarrierFormValues) => void | Promise<void>;
};

const EMPTY_VALUES: CarrierFormValues = {
  name: "",
  businessName: "",
  status: "active",
  billingDetails: {
    address: {
      line1: "",
      line2: "",
      city: "",
      state: "",
      postalCode: "",
      countryCode: "",
    },
    taxId: "",
    paymentTerms: "",
    notes: "",
    bank: undefined,
  },
  ratesName: "",
  ratesEmail: "",
  ratesPhone: "",
  billingName: "",
  billingEmail: "",
  billingPhone: "",
  nocName: "",
  nocEmail: "",
  nocPhone: "",
  salesName: "",
  salesEmail: "",
  salesPhone: "",
};

const EMPTY_BANK = {
  name: "",
  accountNumber: "",
  routingNumber: "",
  iban: "",
  swift: "",
};

function countErrors(node: unknown): number {
  if (!node || typeof node !== "object") return 0;
  if (
    "message" in (node as Record<string, unknown>) &&
    typeof (node as { message?: unknown }).message === "string"
  ) {
    return 1;
  }
  return Object.values(node as Record<string, unknown>).reduce<number>(
    (acc, v) => acc + countErrors(v),
    0,
  );
}

const GENERAL_KEYS = ["name", "businessName", "status"] as const;
const CONTACT_KEYS = [
  "salesName",
  "salesEmail",
  "salesPhone",
  "ratesName",
  "ratesEmail",
  "ratesPhone",
  "billingName",
  "billingEmail",
  "billingPhone",
  "nocName",
  "nocEmail",
  "nocPhone",
] as const;

function firstTabWithErrors(errors: FieldErrors<CarrierFormValues>): TabId | null {
  if (GENERAL_KEYS.some((k) => errors[k])) return "general";
  if (errors.billingDetails) return "billing";
  if (CONTACT_KEYS.some((k) => errors[k])) return "contacts";
  return null;
}

function firstFieldPathInTab(
  tab: TabId,
  errors: FieldErrors<CarrierFormValues>,
): Path<CarrierFormValues> | null {
  const order: Path<CarrierFormValues>[] =
    tab === "general"
      ? ["name", "businessName", "status"]
      : tab === "billing"
        ? [
            "billingDetails.address.line1",
            "billingDetails.address.line2",
            "billingDetails.address.city",
            "billingDetails.address.state",
            "billingDetails.address.postalCode",
            "billingDetails.address.countryCode",
            "billingDetails.taxId",
            "billingDetails.paymentTerms",
            "billingDetails.notes",
            "billingDetails.bank.name",
            "billingDetails.bank.accountNumber",
            "billingDetails.bank.routingNumber",
            "billingDetails.bank.iban",
            "billingDetails.bank.swift",
          ]
        : [
            "salesName",
            "salesEmail",
            "salesPhone",
            "ratesName",
            "ratesEmail",
            "ratesPhone",
            "billingName",
            "billingEmail",
            "billingPhone",
            "nocName",
            "nocEmail",
            "nocPhone",
          ];
  for (const path of order) {
    if (resolveError(errors, path)) return path;
  }
  return null;
}

function resolveError(
  errors: FieldErrors<CarrierFormValues>,
  path: Path<CarrierFormValues>,
): unknown {
  return path.split(".").reduce<unknown>(
    (node, key) =>
      node && typeof node === "object"
        ? (node as Record<string, unknown>)[key]
        : undefined,
    errors,
  );
}

export function CarrierFormModal({
  open,
  onClose,
  onCreate,
}: NewCarrierModalProps) {
  const t = useTranslations("Carriers");
  const tForm = useTranslations("Carriers.form");
  const tFields = useTranslations("Carriers.form.fields");
  const tSections = useTranslations("Carriers.form.sections");
  const tBank = useTranslations("Carriers.form.bank");
  const tStatus = useTranslations("Carriers.form.status");
  const tErrors = useTranslations("Carriers.form.errors");
  const tTabs = useTranslations("Carriers.tabs");
  const tActions = useTranslations("Carriers.actions");

  const formId = useId();
  const tabIdPrefix = useId();

  const [activeTab, setActiveTab] = useState<TabId>("general");
  const [bankEnabled, setBankEnabled] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const nameRef = useRef<HTMLInputElement | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<CarrierFormValues>({
    resolver: zodResolver(carrierFormSchema),
    defaultValues: EMPTY_VALUES,
    mode: "onBlur",
    reValidateMode: "onChange",
    shouldFocusError: false,
  });

  function toggleBank() {
    if (bankEnabled) {
      setValue("billingDetails.bank", undefined, {
        shouldDirty: true,
        shouldValidate: false,
      });
      setBankEnabled(false);
    } else {
      setValue("billingDetails.bank", EMPTY_BANK, {
        shouldDirty: true,
        shouldValidate: false,
      });
      setBankEnabled(true);
    }
  }

  const generalErrors = useMemo(
    () => countErrors({ name: errors.name, businessName: errors.businessName, status: errors.status }),
    [errors.name, errors.businessName, errors.status],
  );
  const billingErrors = useMemo(
    () => countErrors(errors.billingDetails),
    [errors.billingDetails],
  );
  const contactsErrors = useMemo(
    () =>
      countErrors({
        ratesName: errors.ratesName,
        ratesEmail: errors.ratesEmail,
        ratesPhone: errors.ratesPhone,
        billingName: errors.billingName,
        billingEmail: errors.billingEmail,
        billingPhone: errors.billingPhone,
        nocName: errors.nocName,
        nocEmail: errors.nocEmail,
        nocPhone: errors.nocPhone,
        salesName: errors.salesName,
        salesEmail: errors.salesEmail,
        salesPhone: errors.salesPhone,
      }),
    [
      errors.ratesName,
      errors.ratesEmail,
      errors.ratesPhone,
      errors.billingName,
      errors.billingEmail,
      errors.billingPhone,
      errors.nocName,
      errors.nocEmail,
      errors.nocPhone,
      errors.salesName,
      errors.salesEmail,
      errors.salesPhone,
    ],
  );
  const totalErrors = generalErrors + billingErrors + contactsErrors;

  const onValid = handleSubmit(
    async (values) => {
      const payload: CarrierFormValues = {
        ...values,
        billingDetails: {
          ...values.billingDetails,
          bank: bankEnabled ? values.billingDetails.bank : undefined,
        },
      };
      await onCreate(payload);
      onClose();
    },
    (errs) => {
      setSubmitAttempted(true);
      const tab = firstTabWithErrors(errs);
      if (tab) {
        setActiveTab(tab);
        const path = firstFieldPathInTab(tab, errs);
        if (path) {
          setTimeout(() => setFocus(path), 0);
        }
      }
    },
  );

  const translateError = (key?: string) =>
    key ? tErrors(key as Parameters<typeof tErrors>[0]) : null;

  const { ref: nameFieldRef, ...nameRegister } = register("name");

  const tabs: { id: TabId; label: string; count: number }[] = [
    { id: "general", label: tTabs("general"), count: generalErrors },
    { id: "billing", label: tTabs("billing"), count: billingErrors },
    { id: "contacts", label: tTabs("contacts"), count: contactsErrors },
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("newCarrier")}
      description={tForm("subtitle")}
      closeLabel={tActions("close")}
      initialFocusRef={nameRef}
      size="3xl"
      subheader={
        <div
          role="tablist"
          aria-label={t("title")}
          className="flex gap-1 px-6"
        >
          {tabs.map((tab) => {
            const selected = activeTab === tab.id;
            const showBadge = submitAttempted && tab.count > 0;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`${tabIdPrefix}-tab-${tab.id}`}
                aria-controls={`${tabIdPrefix}-panel-${tab.id}`}
                aria-selected={selected}
                tabIndex={selected ? 0 : -1}
                onClick={() => setActiveTab(tab.id)}
                className={`relative -mb-px cursor-pointer border-b-2 px-3 py-2.5 text-sm font-medium transition-colors duration-150 motion-reduce:transition-none focus:outline-none focus-visible:ring-1 focus-visible:ring-black ${
                  selected
                    ? "border-black text-black"
                    : "border-transparent text-gray-600 hover:text-black"
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  {tab.label}
                  {showBadge && (
                    <span
                      aria-label={tForm("tabErrorCount", { count: tab.count })}
                      className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-100 px-1.5 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-200"
                    >
                      {tab.count}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {tActions("cancel")}
          </Button>
          <Button
            type="submit"
            form={formId}
            disabled={isSubmitting}
            leadingIcon={isSubmitting ? <Spinner /> : undefined}
          >
            {isSubmitting ? tForm("submitting") : tForm("submit")}
          </Button>
        </>
      }
    >
      {submitAttempted && totalErrors > 0 && (
        <div
          role="alert"
          className="mb-5 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            className="mt-0.5 h-4 w-4 shrink-0"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v5M12 16.5v.5" strokeLinecap="round" />
          </svg>
          <span>{tForm("errorSummary", { count: totalErrors })}</span>
        </div>
      )}

      <form
        id={formId}
        onSubmit={onValid}
        className="space-y-6"
        noValidate
      >
        {/* GENERAL */}
        <div
          role="tabpanel"
          id={`${tabIdPrefix}-panel-general`}
          aria-labelledby={`${tabIdPrefix}-tab-general`}
          hidden={activeTab !== "general"}
          className="space-y-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={tFields("name")}
              required
              error={translateError(errors.name?.message)}
              htmlFor="cf-name"
            >
              <TextInput
                id="cf-name"
                autoComplete="off"
                placeholder={tFields("namePlaceholder")}
                invalid={!!errors.name}
                ref={(el) => {
                  nameFieldRef(el);
                  nameRef.current = el;
                }}
                {...nameRegister}
              />
            </Field>

            <Field
              label={tFields("businessName")}
              required
              error={translateError(errors.businessName?.message)}
              htmlFor="cf-business-name"
            >
              <TextInput
                id="cf-business-name"
                autoComplete="organization"
                placeholder={tFields("businessNamePlaceholder")}
                invalid={!!errors.businessName}
                {...register("businessName")}
              />
            </Field>
          </div>

          <Field label={tFields("status")} htmlFor="cf-status">
            <Select id="cf-status" className="sm:max-w-xs" {...register("status")}>
              <option value="active">{tStatus("active")}</option>
              <option value="inactive">{tStatus("inactive")}</option>
            </Select>
          </Field>
        </div>

        {/* BILLING */}
        <div
          role="tabpanel"
          id={`${tabIdPrefix}-panel-billing`}
          aria-labelledby={`${tabIdPrefix}-tab-billing`}
          hidden={activeTab !== "billing"}
          className="space-y-6"
        >
          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold text-black">
              {tSections("address")}
            </legend>

            <Field
              label={tFields("addressLine1")}
              required
              error={translateError(errors.billingDetails?.address?.line1?.message)}
              htmlFor="cf-line1"
            >
              <TextInput
                id="cf-line1"
                autoComplete="address-line1"
                invalid={!!errors.billingDetails?.address?.line1}
                {...register("billingDetails.address.line1")}
              />
            </Field>

            <Field
              label={tFields("addressLine2")}
              error={translateError(errors.billingDetails?.address?.line2?.message)}
              htmlFor="cf-line2"
            >
              <TextInput
                id="cf-line2"
                autoComplete="address-line2"
                invalid={!!errors.billingDetails?.address?.line2}
                {...register("billingDetails.address.line2")}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={tFields("city")}
                required
                error={translateError(errors.billingDetails?.address?.city?.message)}
                htmlFor="cf-city"
              >
                <TextInput
                  id="cf-city"
                  autoComplete="address-level2"
                  invalid={!!errors.billingDetails?.address?.city}
                  {...register("billingDetails.address.city")}
                />
              </Field>

              <Field
                label={tFields("state")}
                error={translateError(errors.billingDetails?.address?.state?.message)}
                htmlFor="cf-state"
              >
                <TextInput
                  id="cf-state"
                  autoComplete="address-level1"
                  invalid={!!errors.billingDetails?.address?.state}
                  {...register("billingDetails.address.state")}
                />
              </Field>

              <Field
                label={tFields("postalCode")}
                required
                error={translateError(errors.billingDetails?.address?.postalCode?.message)}
                htmlFor="cf-postal"
              >
                <TextInput
                  id="cf-postal"
                  autoComplete="postal-code"
                  invalid={!!errors.billingDetails?.address?.postalCode}
                  {...register("billingDetails.address.postalCode")}
                />
              </Field>

              <Field
                label={tFields("countryCode")}
                required
                error={translateError(errors.billingDetails?.address?.countryCode?.message)}
                htmlFor="cf-country"
              >
                <TextInput
                  id="cf-country"
                  inputMode="text"
                  autoComplete="country"
                  maxLength={2}
                  placeholder={tFields("countryCodePlaceholder")}
                  invalid={!!errors.billingDetails?.address?.countryCode}
                  className="uppercase tracking-widest"
                  {...register("billingDetails.address.countryCode", {
                    setValueAs: (v: string) =>
                      typeof v === "string" ? v.trim().toUpperCase() : v,
                  })}
                />
              </Field>
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold text-black">
              {tSections("financial")}
            </legend>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={tFields("taxId")}
                error={translateError(errors.billingDetails?.taxId?.message)}
                htmlFor="cf-tax-id"
              >
                <TextInput
                  id="cf-tax-id"
                  autoComplete="off"
                  invalid={!!errors.billingDetails?.taxId}
                  {...register("billingDetails.taxId")}
                />
              </Field>

              <Field
                label={tFields("paymentTerms")}
                error={translateError(errors.billingDetails?.paymentTerms?.message)}
                htmlFor="cf-payment-terms"
              >
                <TextInput
                  id="cf-payment-terms"
                  autoComplete="off"
                  placeholder={tFields("paymentTermsPlaceholder")}
                  invalid={!!errors.billingDetails?.paymentTerms}
                  {...register("billingDetails.paymentTerms")}
                />
              </Field>
            </div>

            <Field
              label={tFields("notes")}
              error={translateError(errors.billingDetails?.notes?.message)}
              htmlFor="cf-notes"
            >
              <textarea
                id="cf-notes"
                rows={3}
                aria-invalid={!!errors.billingDetails?.notes || undefined}
                {...register("billingDetails.notes")}
                className={textareaCls(!!errors.billingDetails?.notes)}
              />
            </Field>
          </fieldset>

          <fieldset className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <legend className="text-sm font-semibold text-black">
                {tSections("bank")}
              </legend>
              <Button
                variant="secondary"
                size="sm"
                onClick={toggleBank}
                leadingIcon={
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    className="h-3.5 w-3.5"
                    aria-hidden="true"
                  >
                    {bankEnabled ? (
                      <path d="M5 12h14" strokeLinecap="round" />
                    ) : (
                      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                    )}
                  </svg>
                }
              >
                {bankEnabled ? tBank("removeToggle") : tBank("addToggle")}
              </Button>
            </div>

            {bankEnabled && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label={tFields("bankName")}
                  required
                  error={translateError(errors.billingDetails?.bank?.name?.message)}
                  htmlFor="cf-bank-name"
                >
                  <TextInput
                    id="cf-bank-name"
                    autoComplete="off"
                    invalid={!!errors.billingDetails?.bank?.name}
                    {...register("billingDetails.bank.name")}
                  />
                </Field>

                <Field
                  label={tFields("bankAccountNumber")}
                  required
                  error={translateError(errors.billingDetails?.bank?.accountNumber?.message)}
                  htmlFor="cf-bank-account"
                >
                  <TextInput
                    id="cf-bank-account"
                    autoComplete="off"
                    invalid={!!errors.billingDetails?.bank?.accountNumber}
                    {...register("billingDetails.bank.accountNumber")}
                  />
                </Field>

                <Field
                  label={tFields("bankRoutingNumber")}
                  error={translateError(errors.billingDetails?.bank?.routingNumber?.message)}
                  htmlFor="cf-bank-routing"
                >
                  <TextInput
                    id="cf-bank-routing"
                    autoComplete="off"
                    invalid={!!errors.billingDetails?.bank?.routingNumber}
                    {...register("billingDetails.bank.routingNumber")}
                  />
                </Field>

                <Field
                  label={tFields("bankIban")}
                  error={translateError(errors.billingDetails?.bank?.iban?.message)}
                  htmlFor="cf-bank-iban"
                >
                  <TextInput
                    id="cf-bank-iban"
                    autoComplete="off"
                    invalid={!!errors.billingDetails?.bank?.iban}
                    {...register("billingDetails.bank.iban")}
                  />
                </Field>

                <Field
                  label={tFields("bankSwift")}
                  error={translateError(errors.billingDetails?.bank?.swift?.message)}
                  htmlFor="cf-bank-swift"
                >
                  <TextInput
                    id="cf-bank-swift"
                    autoComplete="off"
                    invalid={!!errors.billingDetails?.bank?.swift}
                    {...register("billingDetails.bank.swift")}
                  />
                </Field>
              </div>
            )}
          </fieldset>
        </div>

        {/* CONTACTS */}
        <div
          role="tabpanel"
          id={`${tabIdPrefix}-panel-contacts`}
          aria-labelledby={`${tabIdPrefix}-tab-contacts`}
          hidden={activeTab !== "contacts"}
          className="space-y-6"
        >
          <ContactRow
            section={tSections("sales")}
            nameId="cf-sales-name"
            emailId="cf-sales-email"
            phoneId="cf-sales-phone"
            nameLabel={tFields("contactName")}
            emailLabel={tFields("contactEmail")}
            phoneLabel={tFields("contactPhone")}
            nameError={translateError(errors.salesName?.message)}
            emailError={translateError(errors.salesEmail?.message)}
            phoneError={translateError(errors.salesPhone?.message)}
            nameProps={register("salesName")}
            emailProps={register("salesEmail")}
            phoneProps={register("salesPhone")}
            hasNameError={!!errors.salesName}
            hasEmailError={!!errors.salesEmail}
            hasPhoneError={!!errors.salesPhone}
          />
          <ContactRow
            section={tSections("rates")}
            nameId="cf-rates-name"
            emailId="cf-rates-email"
            phoneId="cf-rates-phone"
            nameLabel={tFields("contactName")}
            emailLabel={tFields("contactEmail")}
            phoneLabel={tFields("contactPhone")}
            nameError={translateError(errors.ratesName?.message)}
            emailError={translateError(errors.ratesEmail?.message)}
            phoneError={translateError(errors.ratesPhone?.message)}
            nameProps={register("ratesName")}
            emailProps={register("ratesEmail")}
            phoneProps={register("ratesPhone")}
            hasNameError={!!errors.ratesName}
            hasEmailError={!!errors.ratesEmail}
            hasPhoneError={!!errors.ratesPhone}
          />
          <ContactRow
            section={tSections("billing")}
            nameId="cf-billing-name"
            emailId="cf-billing-email"
            phoneId="cf-billing-phone"
            nameLabel={tFields("contactName")}
            emailLabel={tFields("contactEmail")}
            phoneLabel={tFields("contactPhone")}
            nameError={translateError(errors.billingName?.message)}
            emailError={translateError(errors.billingEmail?.message)}
            phoneError={translateError(errors.billingPhone?.message)}
            nameProps={register("billingName")}
            emailProps={register("billingEmail")}
            phoneProps={register("billingPhone")}
            hasNameError={!!errors.billingName}
            hasEmailError={!!errors.billingEmail}
            hasPhoneError={!!errors.billingPhone}
          />
          <ContactRow
            section={tSections("noc")}
            nameId="cf-noc-name"
            emailId="cf-noc-email"
            phoneId="cf-noc-phone"
            nameLabel={tFields("contactName")}
            emailLabel={tFields("contactEmail")}
            phoneLabel={tFields("contactPhone")}
            nameError={translateError(errors.nocName?.message)}
            emailError={translateError(errors.nocEmail?.message)}
            phoneError={translateError(errors.nocPhone?.message)}
            nameProps={register("nocName")}
            emailProps={register("nocEmail")}
            phoneProps={register("nocPhone")}
            hasNameError={!!errors.nocName}
            hasEmailError={!!errors.nocEmail}
            hasPhoneError={!!errors.nocPhone}
          />
        </div>
      </form>
    </Modal>
  );
}

function textareaCls(invalid: boolean): string {
  const base =
    "block w-full resize-y rounded-md border bg-white px-3 py-2.5 text-sm text-black placeholder-gray-400 focus:outline-none focus:ring-1";
  return `${base} ${
    invalid
      ? "border-red-500 focus:border-red-500 focus:ring-red-500"
      : "border-gray-300 focus:border-black focus:ring-black"
  }`;
}

function Spinner() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      className="h-4 w-4 animate-spin motion-reduce:animate-none"
      aria-hidden="true"
    >
      <path d="M12 3a9 9 0 1 0 9 9" strokeLinecap="round" />
    </svg>
  );
}

function ContactRow({
  section,
  nameId,
  emailId,
  phoneId,
  nameLabel,
  emailLabel,
  phoneLabel,
  nameError,
  emailError,
  phoneError,
  nameProps,
  emailProps,
  phoneProps,
  hasNameError,
  hasEmailError,
  hasPhoneError,
}: {
  section: string;
  nameId: string;
  emailId: string;
  phoneId: string;
  nameLabel: string;
  emailLabel: string;
  phoneLabel: string;
  nameError?: string | null;
  emailError?: string | null;
  phoneError?: string | null;
  nameProps: UseFormRegisterReturn;
  emailProps: UseFormRegisterReturn;
  phoneProps: UseFormRegisterReturn;
  hasNameError: boolean;
  hasEmailError: boolean;
  hasPhoneError: boolean;
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-semibold text-black">{section}</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={nameLabel} required error={nameError} htmlFor={nameId}>
          <TextInput
            id={nameId}
            autoComplete="name"
            invalid={hasNameError}
            {...nameProps}
          />
        </Field>
        <Field label={emailLabel} required error={emailError} htmlFor={emailId}>
          <TextInput
            id={emailId}
            type="email"
            autoComplete="email"
            invalid={hasEmailError}
            {...emailProps}
          />
        </Field>
        <Field label={phoneLabel} error={phoneError} htmlFor={phoneId}>
          <TextInput
            id={phoneId}
            type="tel"
            autoComplete="tel"
            invalid={hasPhoneError}
            {...phoneProps}
          />
        </Field>
      </div>
    </fieldset>
  );
}
