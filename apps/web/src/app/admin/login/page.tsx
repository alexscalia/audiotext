"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { signIn } from "@/lib/auth-client";
import { LocaleSwitcher } from "@/components/shell/locale-switcher";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/form/field";
import { TextInput } from "@/components/form/text-input";
import { ErrorText } from "@/components/form/error-text";

const loginSchema = z.object({
  email: z
    .string()
    .min(1, { message: "emailRequired" })
    .email({ message: "emailInvalid" }),
  password: z
    .string()
    .min(1, { message: "passwordRequired" })
    .min(8, { message: "passwordMin" }),
  remember: z.boolean().optional(),
});

type LoginValues = z.infer<typeof loginSchema>;

export default function AdminLoginPage() {
  const router = useRouter();
  const t = useTranslations("Login");
  const tErrors = useTranslations("Login.errors");
  const tServer = useTranslations("Login.serverErrors");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", remember: false },
  });

  const translateError = (key?: string) =>
    key ? tErrors(key as Parameters<typeof tErrors>[0]) : null;

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    const { error } = await signIn.email({
      email: values.email,
      password: values.password,
      rememberMe: values.remember,
    });
    if (error) {
      const code = error.code;
      if (code && tServer.has(code as Parameters<typeof tServer.has>[0])) {
        setSubmitError(tServer(code as Parameters<typeof tServer>[0]));
      } else {
        setSubmitError(error.message ?? t("errorFallback"));
      }
      return;
    }
    router.push("/admin/dashboard");
  });

  return (
    <div className="min-h-screen flex flex-col bg-white px-6 py-8 sm:px-10">
      <div className="mx-auto flex w-full max-w-md items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full border-2 border-black flex items-center justify-center">
            <div className="h-3 w-3 rounded-full bg-black" />
          </div>
          <span className="text-lg font-bold tracking-tight text-black">
            audiotext
          </span>
        </div>
        <LocaleSwitcher />
      </div>

      <div className="flex flex-1 items-center justify-center">
        <div className="w-full max-w-sm">
          <h1 className="text-4xl font-bold tracking-tight text-black">
            {t("title")}
          </h1>
          <p className="mt-2 text-sm text-gray-600">{t("subtitle")}</p>

          <form onSubmit={onSubmit} className="mt-8 space-y-5" noValidate>
            <Field
              label={t("email")}
              htmlFor="email"
              error={translateError(errors.email?.message)}
            >
              <TextInput
                id="email"
                type="email"
                autoComplete="email"
                invalid={!!errors.email}
                {...register("email")}
              />
            </Field>

            <Field
              label={t("password")}
              htmlFor="password"
              error={translateError(errors.password?.message)}
            >
              <TextInput
                id="password"
                type="password"
                autoComplete="current-password"
                invalid={!!errors.password}
                {...register("password")}
              />
            </Field>

            <div className="flex items-center justify-between">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-black">
                <input
                  type="checkbox"
                  {...register("remember")}
                  className="h-4 w-4 cursor-pointer rounded border-gray-300 text-black focus:ring-black"
                />
                {t("remember")}
              </label>
              <span
                aria-disabled="true"
                title={t("forgotUnavailable")}
                className="text-sm font-medium text-gray-400 cursor-not-allowed"
              >
                {t("forgot")}
              </span>
            </div>

            <ErrorText message={submitError} />

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full"
            >
              {isSubmitting ? t("submitting") : t("submit")}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
