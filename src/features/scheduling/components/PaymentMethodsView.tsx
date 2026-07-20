"use client";

import { FormEvent, ReactNode, useEffect, useState } from "react";
import {
  FiAtSign,
  FiCreditCard,
  FiExternalLink,
  FiGlobe,
  FiKey,
  FiLock,
  FiSave,
  FiUser
} from "react-icons/fi";

import { SectionHeader } from "@/components/composed/SectionHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TextField } from "@/components/ui/TextField";
import { cx } from "@/components/ui/utils";
import { Messages } from "@/features/scheduling/i18n/messages";
import { BusinessPaymentSettings } from "@/features/scheduling/types";

type PaymentTab = "mercadoPago" | "transfers";

type PaymentMethodsViewProps = {
  messages: Messages;
  paymentSettings: BusinessPaymentSettings;
  onSave: (settings: BusinessPaymentSettings) => Promise<boolean>;
};

const mercadoPagoDevelopersUrl = "https://www.mercadopago.com.ar/developers/es";
const mercadoPagoPlaceholderValues = new Set([
  "APP_USR-XXXXXXXXXXXXXXXXXXXX",
  "APP_USR-00000000-0000-0000-0000-000000000000"
]);
const transferPlaceholderValues = new Set([
  "Nombre del Titular",
  "Account holder name",
  "Introducir CBU (22 digitos)",
  "Enter CBU (22 digits)",
  "Introducir alias de la cuenta",
  "Enter account alias"
]);

export function PaymentMethodsView({ messages, paymentSettings, onSave }: PaymentMethodsViewProps) {
  const copy = messages.adminPaymentMethods;
  const [activeTab, setActiveTab] = useState<PaymentTab>("mercadoPago");
  const [accessToken, setAccessToken] = useState(normalizeMercadoPagoCredential(paymentSettings.mercadoPago.accessToken));
  const [publicKey, setPublicKey] = useState(normalizeMercadoPagoCredential(paymentSettings.mercadoPago.publicKey));
  const [accountHolder, setAccountHolder] = useState(normalizeTransferValue(paymentSettings.transfers.accountHolder));
  const [cbu, setCbu] = useState(normalizeTransferValue(paymentSettings.transfers.cbu));
  const [alias, setAlias] = useState(normalizeTransferValue(paymentSettings.transfers.alias));

  useEffect(() => {
    setAccessToken(normalizeMercadoPagoCredential(paymentSettings.mercadoPago.accessToken));
    setPublicKey(normalizeMercadoPagoCredential(paymentSettings.mercadoPago.publicKey));
    setAccountHolder(normalizeTransferValue(paymentSettings.transfers.accountHolder));
    setCbu(normalizeTransferValue(paymentSettings.transfers.cbu));
    setAlias(normalizeTransferValue(paymentSettings.transfers.alias));
  }, [paymentSettings]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSave({
      mercadoPago: {
        accessToken: normalizeMercadoPagoCredential(accessToken),
        publicKey: normalizeMercadoPagoCredential(publicKey),
        isConfigured: paymentSettings.mercadoPago.isConfigured
      },
      transfers: {
        accountHolder: normalizeTransferValue(accountHolder),
        cbu: normalizeTransferValue(cbu),
        alias: normalizeTransferValue(alias)
      }
    });
  }

  return (
    <div className="grid gap-6">
      <SectionHeader eyebrow={copy.eyebrow} title={copy.title} description={copy.description} />

      <div className="flex w-fit rounded-xl border border-subtle bg-sidebar p-1">
        <PaymentTabButton isActive={activeTab === "mercadoPago"} onClick={() => setActiveTab("mercadoPago")}>
          {copy.mercadoPagoTab}
        </PaymentTabButton>
        <PaymentTabButton isActive={activeTab === "transfers"} onClick={() => setActiveTab("transfers")}>
          {copy.transfersTab}
        </PaymentTabButton>
      </div>

      <form onSubmit={handleSubmit}>
        {activeTab === "mercadoPago" ? (
          <MercadoPagoPanel
            messages={messages}
            accessToken={accessToken}
            hasStoredAccessToken={paymentSettings.mercadoPago.isConfigured}
            publicKey={publicKey}
            onAccessTokenChange={setAccessToken}
            onPublicKeyChange={setPublicKey}
          />
        ) : (
          <TransfersPanel
            messages={messages}
            accountHolder={accountHolder}
            cbu={cbu}
            alias={alias}
            onAccountHolderChange={setAccountHolder}
            onCbuChange={setCbu}
            onAliasChange={setAlias}
          />
        )}

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted">{copy.paymentDataDisclaimer}</p>
          <Button type="submit" size="lg" icon={<FiSave />} className="sm:min-w-64">
            {messages.actions.savePaymentData}
          </Button>
        </div>
      </form>
    </div>
  );
}

function normalizeMercadoPagoCredential(value: string) {
  const trimmedValue = value.trim();

  return mercadoPagoPlaceholderValues.has(trimmedValue) ? "" : trimmedValue;
}

function normalizeTransferValue(value: string) {
  const trimmedValue = value.trim();

  return transferPlaceholderValues.has(trimmedValue) ? "" : trimmedValue;
}

function PaymentTabButton({
  children,
  isActive,
  onClick
}: {
  children: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cx(
        "h-10 cursor-pointer rounded-lg px-4 text-sm font-semibold transition-colors",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
        isActive ? "bg-brand text-on-brand shadow-sm" : "text-muted hover:bg-surface-strong hover:text-primary"
      )}
      aria-pressed={isActive}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function MercadoPagoPanel({
  messages,
  accessToken,
  hasStoredAccessToken,
  publicKey,
  onAccessTokenChange,
  onPublicKeyChange
}: {
  messages: Messages;
  accessToken: string;
  hasStoredAccessToken: boolean;
  publicKey: string;
  onAccessTokenChange: (value: string) => void;
  onPublicKeyChange: (value: string) => void;
}) {
  const copy = messages.adminPaymentMethods;

  return (
    <Card className="overflow-hidden p-0">
      <PaymentPanelHeader icon={<FiCreditCard />} title={copy.mercadoPagoTitle} />
      <div className="grid gap-5 p-5 sm:p-6">
        <div className="rounded-xl border border-subtle bg-input p-5">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl border border-subtle bg-surface text-xl text-brand-strong">
              <FiKey aria-hidden="true" />
            </span>
            <h3 className="text-xl font-bold text-primary">{copy.credentialsTitle}</h3>
          </div>

          <div className="mt-6 grid gap-5">
            <TextField
              label={copy.accessToken}
              value={accessToken}
              placeholder="APP_USR-XXXXXXXXXXXXXXXXXXXX"
              prefix={<FiLock />}
              helperText={
                hasStoredAccessToken
                  ? `${copy.accessTokenHint}`
                  : copy.accessTokenHint
              }
              onChange={(event) => onAccessTokenChange(event.target.value)}
            />
            <TextField
              label={copy.publicKey}
              value={publicKey}
              prefix={<FiGlobe />}
              placeholder="APP_USR-XXXXXXXXXXXXXXXXXXXX"
              helperText={copy.publicKeyHint}
              onChange={(event) => onPublicKeyChange(event.target.value)}
            />
          </div>
        </div>

        <Card className="bg-brand-soft">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h3 className="text-lg font-bold text-primary">{copy.credentialsGuideTitle}</h3>
              <ol className="mt-4 grid list-decimal gap-2 pl-5 text-sm leading-6 text-muted">
                {copy.credentialsGuideSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
            <a
              href={mercadoPagoDevelopersUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-subtle bg-surface px-4 text-sm font-semibold text-primary transition-colors hover:bg-surface-strong"
            >
              {messages.actions.openGuide}
              <FiExternalLink aria-hidden="true" />
            </a>
          </div>
        </Card>
      </div>
    </Card>
  );
}

function TransfersPanel({
  messages,
  accountHolder,
  cbu,
  alias,
  onAccountHolderChange,
  onCbuChange,
  onAliasChange
}: {
  messages: Messages;
  accountHolder: string;
  cbu: string;
  alias: string;
  onAccountHolderChange: (value: string) => void;
  onCbuChange: (value: string) => void;
  onAliasChange: (value: string) => void;
}) {
  const copy = messages.adminPaymentMethods;

  return (
    <Card className="overflow-hidden p-0">
      <PaymentPanelHeader icon={<FiCreditCard />} title={copy.transferTitle} />
      <div className="p-5 sm:p-6">
        <div className="rounded-xl border border-brand bg-input p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl border border-subtle bg-surface text-xl text-brand-strong">
              <FiCreditCard aria-hidden="true" />
            </span>
            <h3 className="text-xl font-bold text-primary">{copy.bankDataTitle}</h3>
          </div>

          <div className="mt-6 grid gap-5">
            <TextField
              label={copy.accountHolder}
              value={accountHolder}
              placeholder={copy.accountHolder}
              prefix={<FiUser />}
              helperText={copy.accountHolderHint}
              onChange={(event) => onAccountHolderChange(event.target.value)}
            />
            <div className="grid gap-5 lg:grid-cols-2">
              <TextField
                label={copy.cbu}
                value={cbu}
                placeholder={copy.cbuPlaceholder}
                prefix={<FiCreditCard />}
                inputMode="numeric"
                onChange={(event) => onCbuChange(event.target.value)}
              />
              <TextField
                label={copy.alias}
                value={alias}
                placeholder={copy.aliasPlaceholder}
                prefix={<FiAtSign />}
                onChange={(event) => onAliasChange(event.target.value)}
              />
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function PaymentPanelHeader({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-4 border-b border-subtle bg-sidebar px-5 py-5 sm:px-6">
      <span className="text-2xl text-brand-strong" aria-hidden="true">
        {icon}
      </span>
      <h2 className="text-2xl font-bold text-primary">{title}</h2>
    </div>
  );
}
