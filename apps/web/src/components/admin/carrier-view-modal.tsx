"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Modal } from "@/components/ui/modal";
import type { CarrierFormValues } from "@/components/admin/carrier-form-modal";

type TabId = "general" | "billing" | "contacts";

type CarrierViewModalProps = {
  open: boolean;
  onClose: () => void;
  carrier: CarrierFormValues & { id: string };
  onEdit?: () => void;
};

export function CarrierViewModal({
  open,
  onClose,
  carrier,
  onEdit,
}: CarrierViewModalProps) {
  const t = useTranslations("Carriers");
  const tForm = useTranslations("Carriers.form");
  const tFields = useTranslations("Carriers.form.fields");
  const tSections = useTranslations("Carriers.form.sections");
  const tStatus = useTranslations("Carriers.form.status");
  const tTabs = useTranslations("Carriers.tabs");
  const tActions = useTranslations("Carriers.actions");
  const tView = useTranslations("Carriers.view");

  const tabIdPrefix = useId();
  const [activeTab, setActiveTab] = useState<TabId>("general");

  const isActive = carrier.status === "active";
  const bank = carrier.billingDetails.bank;

  const tabs: { id: TabId; label: string }[] = [
    { id: "general", label: tTabs("general") },
    { id: "billing", label: tTabs("billing") },
    { id: "contacts", label: tTabs("contacts") },
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={carrier.name}
      description={carrier.businessName}
      closeLabel={tActions("close")}
      size="3xl"
      subheader={
        <div
          role="tablist"
          aria-label={t("title")}
          className="flex gap-1 px-6"
        >
          {tabs.map((tab) => {
            const selected = activeTab === tab.id;
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
                {tab.label}
              </button>
            );
          })}
        </div>
      }
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-black transition-colors duration-150 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 motion-reduce:transition-none"
          >
            {tActions("close")}
          </button>
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-black px-4 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 motion-reduce:transition-none"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path
                  d="M4 20h4l10-10-4-4L4 16v4ZM14 6l4 4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {tActions("edit")}
            </button>
          )}
        </>
      }
    >
      <div className="mb-5 flex items-center gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
            isActive
              ? "bg-green-50 text-green-700 ring-1 ring-inset ring-green-200"
              : "bg-gray-100 text-gray-700 ring-1 ring-inset ring-gray-200"
          }`}
        >
          <span
            aria-hidden="true"
            className={`h-1.5 w-1.5 rounded-full ${
              isActive ? "bg-green-500" : "bg-gray-400"
            }`}
          />
          {isActive ? tStatus("active") : tStatus("inactive")}
        </span>
      </div>

      {/* GENERAL */}
      <div
        role="tabpanel"
        id={`${tabIdPrefix}-panel-general`}
        aria-labelledby={`${tabIdPrefix}-tab-general`}
        hidden={activeTab !== "general"}
        className="space-y-6"
      >
        <Section title={tTabs("general")}>
          <DefList
            items={[
              { label: tFields("name"), value: carrier.name },
              { label: tFields("businessName"), value: carrier.businessName },
              {
                label: tFields("status"),
                value: isActive ? tStatus("active") : tStatus("inactive"),
              },
            ]}
          />
        </Section>
      </div>

      {/* BILLING */}
      <div
        role="tabpanel"
        id={`${tabIdPrefix}-panel-billing`}
        aria-labelledby={`${tabIdPrefix}-tab-billing`}
        hidden={activeTab !== "billing"}
        className="space-y-6"
      >
        <Section title={tSections("address")}>
          <DefList
            items={[
              {
                label: tFields("addressLine1"),
                value: carrier.billingDetails.address.line1,
              },
              {
                label: tFields("addressLine2"),
                value: carrier.billingDetails.address.line2,
              },
              {
                label: tFields("city"),
                value: carrier.billingDetails.address.city,
              },
              {
                label: tFields("state"),
                value: carrier.billingDetails.address.state,
              },
              {
                label: tFields("postalCode"),
                value: carrier.billingDetails.address.postalCode,
              },
              {
                label: tFields("countryCode"),
                value: carrier.billingDetails.address.countryCode,
              },
            ]}
          />
        </Section>

        <Section title={tSections("financial")}>
          <DefList
            items={[
              { label: tFields("taxId"), value: carrier.billingDetails.taxId },
              {
                label: tFields("paymentTerms"),
                value: carrier.billingDetails.paymentTerms,
              },
            ]}
          />
          {carrier.billingDetails.notes && (
            <div className="mt-4">
              <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
                {tFields("notes")}
              </dt>
              <dd className="mt-1 whitespace-pre-wrap text-sm text-black">
                {carrier.billingDetails.notes}
              </dd>
            </div>
          )}
        </Section>

        <Section title={tSections("bank")}>
          {bank ? (
            <DefList
              items={[
                { label: tFields("bankName"), value: bank.name },
                {
                  label: tFields("bankAccountNumber"),
                  value: bank.accountNumber,
                },
                {
                  label: tFields("bankRoutingNumber"),
                  value: bank.routingNumber,
                },
                { label: tFields("bankIban"), value: bank.iban },
                { label: tFields("bankSwift"), value: bank.swift },
              ]}
            />
          ) : (
            <p className="text-sm text-gray-500">{tView("bankEmpty")}</p>
          )}
        </Section>
      </div>

      {/* CONTACTS */}
      <div
        role="tabpanel"
        id={`${tabIdPrefix}-panel-contacts`}
        aria-labelledby={`${tabIdPrefix}-tab-contacts`}
        hidden={activeTab !== "contacts"}
        className="space-y-6"
      >
        <ContactBlock
          section={tSections("rates")}
          name={carrier.ratesName}
          email={carrier.ratesEmail}
          nameLabel={tFields("contactName")}
          emailLabel={tFields("contactEmail")}
        />
        <ContactBlock
          section={tSections("billing")}
          name={carrier.billingName}
          email={carrier.billingEmail}
          nameLabel={tFields("contactName")}
          emailLabel={tFields("contactEmail")}
        />
        <ContactBlock
          section={tSections("noc")}
          name={carrier.nocName}
          email={carrier.nocEmail}
          nameLabel={tFields("contactName")}
          emailLabel={tFields("contactEmail")}
        />
        <ContactBlock
          section={tSections("sales")}
          name={carrier.salesName}
          email={carrier.salesEmail}
          nameLabel={tFields("contactName")}
          emailLabel={tFields("contactEmail")}
        />
      </div>

      <p className="sr-only">{tForm("subtitle")}</p>
    </Modal>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-black">{title}</h3>
      {children}
    </section>
  );
}

function DefList({
  items,
}: {
  items: { label: string; value?: string | null }[];
}) {
  return (
    <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
            {item.label}
          </dt>
          <dd
            className={`mt-1 break-words text-sm ${
              item.value ? "text-black" : "text-gray-400"
            }`}
          >
            {item.value && item.value.trim().length > 0 ? item.value : "—"}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function ContactBlock({
  section,
  name,
  email,
  nameLabel,
  emailLabel,
}: {
  section: string;
  name: string;
  email: string;
  nameLabel: string;
  emailLabel: string;
}) {
  return (
    <Section title={section}>
      <DefList
        items={[
          { label: nameLabel, value: name },
          { label: emailLabel, value: email },
        ]}
      />
      {email && (
        <a
          href={`mailto:${email}`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 underline-offset-2 hover:text-black hover:underline focus:outline-none focus-visible:ring-1 focus-visible:ring-black"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            className="h-3.5 w-3.5"
            aria-hidden="true"
          >
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="m4 7 8 6 8-6" strokeLinecap="round" />
          </svg>
          {email}
        </a>
      )}
    </Section>
  );
}
