import { ReactNode, useMemo, useState } from "react";
import { FiInfo, FiRefreshCw, FiSearch, FiZap } from "react-icons/fi";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FloatingInfoPopover } from "@/components/ui/FloatingInfoPopover";
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
type RevenueMode = "monthly" | "total";

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
  const [revenueMode, setRevenueMode] = useState<RevenueMode>("monthly");
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
  const paidSubscriptionCount = businesses.reduce((total, business) => (
    total + (revenueMode === "monthly" ? business.monthlyPaidSubscriptionCount : business.totalPaidSubscriptionCount)
  ), 0);
  const subscriptionRevenue = businesses.reduce((total, business) => (
    total + (revenueMode === "monthly" ? business.monthlySubscriptionRevenue : business.totalSubscriptionRevenue)
  ), 0);

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
          action={(
            <RevenueModeToggle
              messages={messages}
              mode={revenueMode}
              onChange={setRevenueMode}
            />
          )}
          helper={`${paidSubscriptionCount} ${messages.profile.superAdminPaidSubscriptions}`}
          label={messages.profile.superAdminSubscriptionRevenue}
          value={formatCurrency(subscriptionRevenue)}
        />
      </div>

      <Card className="overflow-hidden p-0">
        <div className="grid gap-5 border-b border-subtle p-5">
          <div>
            <h2 className="text-lg font-bold text-primary">{messages.profile.superAdminBusinesses}</h2>
            <p className="mt-1 text-sm leading-6 text-muted">{messages.profile.superAdminDescription}</p>
          </div>
          <div className="grid gap-3 lg:grid-cols-[minmax(18rem,28rem)_12rem_auto] lg:items-end">
            <TextField
              label={messages.profile.superAdminSearch}
              value={query}
              prefix={<FiSearch />}
              onChange={(event) => setQuery(event.target.value)}
            />
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
              className="h-11"
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
                    <th className="w-36 px-5 py-3">{messages.profile.superAdminUsage}</th>
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

function SuperAdminMetricCard({
  action,
  helper,
  label,
  value
}: {
  action?: ReactNode;
  helper?: string;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-muted">{label}</p>
        {action}
      </div>
      <p className="mt-3 text-2xl font-bold text-primary">{value}</p>
      {helper ? <p className="mt-1 text-xs font-semibold text-muted">{helper}</p> : null}
    </Card>
  );
}

function RevenueModeToggle({
  messages,
  mode,
  onChange
}: {
  messages: Messages;
  mode: RevenueMode;
  onChange: (mode: RevenueMode) => void;
}) {
  const options: { label: string; value: RevenueMode }[] = [
    { label: messages.profile.superAdminMonthly, value: "monthly" },
    { label: messages.profile.superAdminTotal, value: "total" }
  ];

  return (
    <div className="flex rounded-lg border border-subtle bg-input p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`rounded-md px-2.5 py-1 text-xs font-bold transition-colors ${
            mode === option.value
              ? "bg-brand text-on-brand"
              : "text-muted hover:text-primary"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
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
        <p className="mt-1 text-xs text-muted">{formatShortId(business.businessId)}</p>
      </td>
      <td className="px-5 py-4 text-muted">{business.ownerEmail}</td>
      <td className="px-5 py-4 text-muted">
        <div className="flex items-center gap-2">
          <VerificationBadge isVerified={business.ownerEmailVerified} messages={messages} />
          <AccountInfoPopover business={business} messages={messages} />
        </div>
      </td>
      <td className="px-5 py-4">
        <PlanBadge plan={business.plan} messages={messages} />
      </td>
      <td className="w-36 whitespace-nowrap px-5 py-4 text-muted">
        <p>{business.monthlyAppointmentCount} {messages.calendar.appointments}</p>
        <p className="mt-1">{business.serviceCount} {messages.nav.services}</p>
        <p className="mt-1">{business.employeeCount} {messages.nav.personnel}</p>
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
        <div className="flex items-center gap-2">
          <VerificationBadge isVerified={business.ownerEmailVerified} messages={messages} />
          <AccountInfoPopover business={business} messages={messages} />
        </div>
        <p>{business.monthlyAppointmentCount} {messages.calendar.appointments}</p>
        <p>{business.monthlyPaidSubscriptionCount} {messages.profile.superAdminPaidSubscriptions} · {formatCurrency(business.monthlySubscriptionRevenue)}</p>
        <p>{business.serviceCount} {messages.nav.services}</p>
        <p>{business.employeeCount} {messages.nav.personnel}</p>
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
    <Badge tone={plan === "pro" ? "warning" : "neutral"} className={plan === "pro" ? "bg-warning text-primary" : ""}>
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

function AccountInfoPopover({
  business,
  messages
}: {
  business: SuperAdminBusiness;
  messages: Messages;
}) {
  return (
    <FloatingInfoPopover
      ariaLabel={messages.profile.superAdminAccount}
      className="grid h-7 w-7 cursor-help place-items-center rounded-full border border-subtle bg-input text-muted transition-colors hover:border-brand hover:text-brand-strong focus:outline-none focus:ring-2 focus:ring-focus"
      content={
        <>
        <span className="block">
          <span className="font-bold text-primary">{messages.profile.superAdminSignup}:</span> {formatDateTime(business.ownerCreatedAt)}
        </span>
        <span className="mt-1 block">
          <span className="font-bold text-primary">{messages.profile.superAdminLastLogin}:</span> {formatDateTime(business.ownerLastSignInAt)}
        </span>
        <span className="mt-1 block">
          <span className="font-bold text-primary">{messages.profile.superAdminProvider}:</span> {business.ownerProvider}
        </span>
        </>
      }
    >
      <FiInfo aria-hidden="true" />
    </FloatingInfoPopover>
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

function formatShortId(value: string) {
  return value.slice(0, 8);
}
