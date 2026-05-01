"use client";

import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { z } from "zod";
import { Modal } from "@/components/ui/modal";

const newCarrierSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "nameRequired" })
    .max(120, { message: "nameTooLong" }),
  status: z.enum(["active", "inactive"]),
});

export type NewCarrierValues = z.infer<typeof newCarrierSchema>;

type NewCarrierModalProps = {
  open: boolean;
  onClose: () => void;
  onCreate: (values: NewCarrierValues) => void | Promise<void>;
};

export function NewCarrierModal({
  open,
  onClose,
  onCreate,
}: NewCarrierModalProps) {
  const t = useTranslations("Carriers");
  const tForm = useTranslations("Carriers.form");
  const tErrors = useTranslations("Carriers.form.errors");
  const tStatus = useTranslations("Carriers.status");
  const tActions = useTranslations("Carriers.actions");

  const nameRef = useRef<HTMLInputElement | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<NewCarrierValues>({
    resolver: zodResolver(newCarrierSchema),
    defaultValues: { name: "", status: "active" },
  });

  useEffect(() => {
    if (!open) reset({ name: "", status: "active" });
  }, [open, reset]);

  const { ref: nameFieldRef, ...nameRegister } = register("name");

  const onSubmit = handleSubmit(async (values) => {
    await onCreate(values);
    onClose();
  });

  const translateError = (key?: string) =>
    key ? tErrors(key as Parameters<typeof tErrors>[0]) : null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("newCarrier")}
      description={tForm("subtitle")}
      closeLabel={tActions("close")}
      initialFocusRef={nameRef}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-black transition-colors duration-150 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 motion-reduce:transition-none"
          >
            {tActions("cancel")}
          </button>
          <button
            type="submit"
            form="new-carrier-form"
            disabled={isSubmitting}
            className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-black px-4 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
          >
            {isSubmitting && (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.2}
                className="h-4 w-4 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              >
                <path
                  d="M12 3a9 9 0 1 0 9 9"
                  strokeLinecap="round"
                />
              </svg>
            )}
            {isSubmitting ? tForm("submitting") : tForm("submit")}
          </button>
        </>
      }
    >
      <form
        id="new-carrier-form"
        onSubmit={onSubmit}
        className="space-y-4"
        noValidate
      >
        <div>
          <label
            htmlFor="carrier-name"
            className="block text-sm font-medium text-black"
          >
            {tForm("name")} <span className="text-red-600">*</span>
          </label>
          <input
            id="carrier-name"
            type="text"
            autoComplete="off"
            placeholder={tForm("namePlaceholder")}
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "carrier-name-error" : undefined}
            ref={(el) => {
              nameFieldRef(el);
              nameRef.current = el;
            }}
            {...nameRegister}
            className="mt-2 block w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm text-black placeholder-gray-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black aria-invalid:border-red-500 aria-invalid:focus:ring-red-500"
          />
          {errors.name && (
            <p
              id="carrier-name-error"
              className="mt-1 text-sm text-red-600"
              role="alert"
            >
              {translateError(errors.name.message)}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="carrier-status"
            className="block text-sm font-medium text-black"
          >
            {tForm("status")}
          </label>
          <select
            id="carrier-status"
            {...register("status")}
            className="mt-2 block w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm text-black focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
          >
            <option value="active">{tStatus("active")}</option>
            <option value="inactive">{tStatus("inactive")}</option>
          </select>
          <p className="mt-1 text-xs text-gray-500">{tForm("statusHelp")}</p>
        </div>
      </form>
    </Modal>
  );
}
