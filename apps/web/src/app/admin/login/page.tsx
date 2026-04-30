"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { signIn } from "@/lib/auth-client";
import { LocaleSwitcher } from "@/components/locale-switcher";

export default function AdminLoginPage() {
  const router = useRouter();
  const t = useTranslations("Login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await signIn.email({
      email,
      password,
      rememberMe: remember,
    });
    setLoading(false);
    if (error) {
      setError(error.message ?? t("errorFallback"));
      return;
    }
    router.push("/admin/dashboard");
  }

  return (
    <div className="min-h-screen flex bg-white">
      <div className="flex flex-1 flex-col px-8 py-10 sm:px-16 lg:px-24">
        <div className="flex items-center justify-between">
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
            <p className="mt-2 text-sm text-gray-500">{t("subtitle")}</p>

            <form onSubmit={onSubmit} className="mt-8 space-y-5">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-black"
                >
                  {t("email")}
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-2 block w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm text-black placeholder-gray-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-black"
                >
                  {t("password")}
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-2 block w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm text-black placeholder-gray-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-black">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-black focus:ring-black"
                  />
                  {t("remember")}
                </label>
                <a
                  href="#"
                  className="text-sm font-medium text-blue-600 hover:underline"
                >
                  {t("forgot")}
                </a>
              </div>

              {error && (
                <p className="text-sm text-red-600" role="alert">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-md bg-black px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 disabled:opacity-60"
              >
                {loading ? t("submitting") : t("submit")}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
