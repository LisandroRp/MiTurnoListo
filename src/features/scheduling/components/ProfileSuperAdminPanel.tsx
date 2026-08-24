import { useMemo, useState } from "react";
import { FiRefreshCw, FiSearch, FiZap } from "react-icons/fi";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SelectField } from "@/components/ui/SelectField";
import { TextField } from "@/components/ui/TextField";
import { Messages } from "@/features/scheduling/i18n/messages";
import { formatCurrency } from "@/features/scheduling/utils/format";
import { SuperAdminAction, SuperAdminBusiness } from "@/lib/networking/endpoints/super-admin";

type ProfileSuperAdminPanelProps = {
  actionBusinessId: string;
  businesses: SuperAdminBusiness[];
  errorMessage: string;
  isLoading: boolean;
  messages: Messages;
  onAction: (businessId: string, action: SuperAdminAction) => void;
  onRefresh: () => void;
};

type PlanFilter = "all" | "free" | "pro";

export function ProfileSuperAdminPanel({
  actionBusinessId,
  businesses,
  errorMessage,
  isLoading,
  messages,
  onAction,
  onRefresh
}: ProfileSuperAdminPanelProps) {
  const [query, setQuery] = useState("");
  const [planFilter, setPlanFilter] = useState<PlanFilter>("all");
  const filteredBusinesses = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return businesses.filter((business) => {
      const matchesPlan = planFilter === "all" || business.plan === planFilter;
      const matchesQuery = !normalizedQuery ||
        business.businessName.toLowerCase().includes(normalizedQuery) ||
        business.ownerEmail.toLowerCase().includes(normalizedQuery);

      return matchesPlan && matchesQuery;
    });
  }, [businesses, planFilter, query]);

  const proCount = businesses.filter((business) => business.plan === "pro").length;
  const freeCount = businesses.filter((business) => business.plan !== "pro").length;
  const monthlyRevenue = businesses.reduce((total, business) => total + business.monthlyRevenue, 0);

  return (
    <div className="grid gap-6">
      <div className="grid gap-3 md:grid-cols-3">
        <SuperAdminMetricCard
          label={messages.profile.superAdminTotalBusinesses}
          value={String(businesses.length)}
        />
        <SuperAdminMetricCard
          label={messages.profile.superAdminPlans}
          value={`${proCount} Pro / ${freeCount} Free`}
        />
        <SuperAdminMetricCard
          label={messages.profile.superAdminMonthlyRevenue}
          value={formatCurrency(monthlyRevenue)}
        />
      </div>

      <Card className="overflow-hidden p-0">
        <div className="grid gap-4 border-b border-subtle p-5 lg:grid-cols-[1fr_auto_auto] lg:items-end">
          <div>
            <h2 className="text-lg font-bold text-primary">{messages.profile.superAdminBusinesses}</h2>
            <p className="mt-1 text-sm leading-6 text-muted">{messages.profile.superAdminDescription}</p>
          </div>
          <TextField
            label={messages.profile.superAdminSearch}
            value={query}
            prefix={<FiSearch />}
            className="lg:min-w-72"
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="grid gap-3 sm:grid-cols-[11rem_auto]">
            <SelectField
              label={messages.profile.superAdminPlanFilter}
              value={planFilter}
              onChange={(event) => setPlanFilter(event.target.value as PlanFilter)}
              options={[
                { value: "all", label: messages.profile.superAdminAllPlans },
                { value: "pro", label: messages.profile.proPlan },
                { value: "free", label: messages.profile.freePlan }
              ]}
            />
            <Button
              variant="secondary"
              icon={<FiRefreshCw />}
              isLoading={isLoading}
              onClick={onRefresh}
            >
              {messages.actions.refresh}
            </Button>
          </div>
        </div>

        {errorMessage ? (
          <div className="p-5">
            <p className="rounded-lg border border-danger bg-danger-soft p-3 text-sm font-semibold text-danger">
              {errorMessage}
            </p>
          </div>
        ) : null}

        {isLoading && businesses.length === 0 ? (
          <div className="grid min-h-52 place-items-center p-5 text-sm font-semibold text-muted">
            {messages.profile.superAdminLoading}
          </div>
        ) : filteredBusinesses.length === 0 ? (
          <div className="grid min-h-52 place-items-center p-5 text-center text-sm font-semibold text-muted">
            {messages.profile.superAdminEmpty}
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[1120px] text-left text-sm">
                <thead className="bg-input text-xs uppercase tracking-[0.04em] text-muted">
                  <tr>
                    <th className="px-5 py-3">{messages.profile.superAdminBusiness}</th>
                    <th className="px-5 py-3">{messages.profile.superAdminOwner}</th>
                    <th className="px-5 py-3">{messages.profile.superAdminAccount}</th>
                    <th className="px-5 py-3">{messages.profile.superAdminPlan}</th>
                    <th className="px-5 py-3">{messages.profile.superAdminUsage}</th>
                    <th className="px-5 py-3">{messages.profile.superAdminSubscription}</th>
                    <th className="px-5 py-3 text-right">{messages.profile.superAdminActions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-subtle">
                  {filteredBusinesses.map((business) => (
                    <SuperAdminBusinessRow
                      key={business.businessId}
                      actionBusinessId={actionBusinessId}
                      business={business}
                      messages={messages}
                      onAction={onAction}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-3 p-4 lg:hidden">
              {filteredBusinesses.map((business) => (
                <SuperAdminBusinessCard
                  key={business.businessId}
                  actionBusinessId={actionBusinessId}
                  business={business}
                  messages={messages}
                  onAction={onAction}
                />
              ))}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

function SuperAdminMetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <p className="text-sm font-semibold text-muted">{label}</p>
      <p className="mt-3 text-2xl font-bold text-primary">{value}</p>
    </Card>
  );
}

function SuperAdminBusinessRow({
  actionBusinessId,
  business,
  messages,
  onAction
}: {
  actionBusinessId: string;
  business: SuperAdminBusiness;
  messages: Messages;
  onAction: (businessId: string, action: SuperAdminAction) => void;
}) {
  return (
    <tr>
      <td className="px-5 py-4">
        <p className="font-bold text-primary">{business.businessName}</p>
        <p className="mt-1 text-xs text-muted">{business.businessId}</p>
      </td>
      <td className="px-5 py-4 text-muted">{business.ownerEmail}</td>
      <td className="px-5 py-4 text-muted">
        <div className="grid gap-1.5">
          <VerificationBadge isVerified={business.ownerEmailVerified} messages={messages} />
          <p>{messages.profile.superAdminSignup}: {formatDateTime(business.ownerCreatedAt)}</p>
          <p>{messages.profile.superAdminLastLogin}: {formatDateTime(business.ownerLastSignInAt)}</p>
          <p>{messages.profile.superAdminProvider}: {business.ownerProvider}</p>
        </div>
      </td>
      <td className="px-5 py-4">
        <PlanBadge plan={business.plan} messages={messages} />
      </td>
      <td className="px-5 py-4 text-muted">
        <p>{business.monthlyAppointmentCount} {messages.calendar.appointments}</p>
        <p className="mt-1">{business.serviceCount} {messages.nav.services} · {business.employeeCount} {messages.nav.personnel}</p>
      </td>
      <td className="px-5 py-4 text-muted">
        <p className="font-semibold text-primary">{business.providerStatus}</p>
        <p className="mt-1 text-xs">{business.providerSubscriptionId || messages.profile.superAdminManualPlan}</p>
      </td>
      <td className="px-5 py-4">
        <SuperAdminPlanAction
          actionBusinessId={actionBusinessId}
          business={business}
          messages={messages}
          onAction={onAction}
        />
      </td>
    </tr>
  );
}

function SuperAdminBusinessCard({
  actionBusinessId,
  business,
  messages,
  onAction
}: {
  actionBusinessId: string;
  business: SuperAdminBusiness;
  messages: Messages;
  onAction: (businessId: string, action: SuperAdminAction) => void;
}) {
  return (
    <div className="grid gap-3 rounded-lg border border-subtle bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-primary">{business.businessName}</h3>
          <p className="mt-1 text-sm text-muted">{business.ownerEmail}</p>
        </div>
        <PlanBadge plan={business.plan} messages={messages} />
      </div>
      <div className="grid gap-2 text-sm text-muted">
        <p>
          <VerificationBadge isVerified={business.ownerEmailVerified} messages={messages} />
        </p>
        <p>{messages.profile.superAdminSignup}: {formatDateTime(business.ownerCreatedAt)}</p>
        <p>{messages.profile.superAdminLastLogin}: {formatDateTime(business.ownerLastSignInAt)}</p>
        <p>{messages.profile.superAdminProvider}: {business.ownerProvider}</p>
        <p>{business.monthlyAppointmentCount} {messages.calendar.appointments} · {formatCurrency(business.monthlyRevenue)}</p>
        <p>{business.serviceCount} {messages.nav.services} · {business.employeeCount} {messages.nav.personnel}</p>
        <p>{business.providerStatus} · {business.providerSubscriptionId || messages.profile.superAdminManualPlan}</p>
      </div>
      <SuperAdminPlanAction
        actionBusinessId={actionBusinessId}
        business={business}
        messages={messages}
        onAction={onAction}
      />
    </div>
  );
}

function PlanBadge({ plan, messages }: { plan: string; messages: Messages }) {
  return (
    <Badge tone={plan === "pro" ? "success" : "neutral"}>
      {plan === "pro" ? messages.profile.proPlan : messages.profile.freePlan}
    </Badge>
  );
}

function VerificationBadge({ isVerified, messages }: { isVerified: boolean; messages: Messages }) {
  return (
    <Badge tone={isVerified ? "success" : "warning"}>
      {isVerified ? messages.profile.superAdminVerified : messages.profile.superAdminUnverified}
    </Badge>
  );
}

function SuperAdminPlanAction({
  actionBusinessId,
  business,
  messages,
  onAction
}: {
  actionBusinessId: string;
  business: SuperAdminBusiness;
  messages: Messages;
  onAction: (businessId: string, action: SuperAdminAction) => void;
}) {
  const isPro = business.plan === "pro";
  const action = isPro ? "downgradeFree" : "activatePro";

  return (
    <div className="flex justify-end">
      <Button
        size="sm"
        variant={isPro ? "secondary" : "primary"}
        icon={isPro ? undefined : <FiZap />}
        isLoading={actionBusinessId === business.businessId}
        onClick={() => onAction(business.businessId, action)}
      >
        {isPro ? messages.profile.superAdminDowngradeFree : messages.profile.superAdminActivatePro}
      </Button>
    </div>
  );
}

function formatDateTime(value: string) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
