import { IconType } from "react-icons";
import { useState } from "react";
import { FiChevronLeft, FiChevronRight, FiLogOut, FiUser, FiX, FiZap } from "react-icons/fi";
import Link from "next/link";
import Image from "next/image";

import { BrandMark } from "@/components/composed/BrandMark";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cx } from "@/components/ui/utils";
import { Messages } from "@/features/scheduling/i18n/messages";
import { ViewId } from "@/features/scheduling/types";
import { NavigationSidebarGroup } from "@/features/scheduling/components/NavigationSidebarGroup";

export type NavigationItem = {
  id: ViewId;
  label: string;
  icon: IconType;
  href: string;
};

type NavigationSidebarProps = {
  items: NavigationItem[];
  activeView: ViewId;
  isCollapsed: boolean;
  messages: Messages;
  mode?: "desktop" | "mobile";
  onNavigate?: () => void;
  onLogout: () => void;
  onToggle: () => void;
  showProUpgrade?: boolean;
  account?: { businessName: string; email: string; publicLogoUrl: string; subscriptionTier?: string };
};

export function NavigationSidebar({
  items,
  activeView,
  isCollapsed,
  messages,
  mode = "desktop",
  onNavigate,
  onLogout,
  onToggle,
  showProUpgrade = false,
  account
}: NavigationSidebarProps) {
  const isMobile = mode === "mobile";
  const shouldCollapse = !isMobile && isCollapsed;
  const [failedLogoUrl, setFailedLogoUrl] = useState<string | null>(null);
  const logoUrl = account?.publicLogoUrl?.trim() ?? "";
  const businessName = account?.businessName?.trim() ?? "";
  const email = account?.email?.trim() ?? "";
  const isAccountActive = activeView === "profile";
  const dailyItemIds: ViewId[] = ["home", "calendar", "customers"];
  const bookingItem = items.find((item) => item.id === "newBooking");
  const groups = [
    { label: messages.nav.businessGroup, ids: ["personnel", "services", "paymentMethods", "payments", "statistics"] },
    { label: messages.nav.communicationGroup, ids: ["messages", "referrals", "suggestions"] }
  ];

  function renderItem(item: NavigationItem) {
    const Icon = item.icon;
    const isActive = activeView === item.id;
    const isBookingAction = item.id === "newBooking";
    return (
      <Link
        key={item.id}
        href={item.href}
        onClick={onNavigate}
        aria-current={isActive ? "page" : undefined}
        className={cx(
          "flex h-10 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
          isBookingAction ? "mb-3 border border-brand/20 bg-brand-soft font-semibold text-brand-strong hover:bg-brand/20" : isActive ? "bg-brand-soft font-semibold text-brand-strong" : "font-medium text-primary hover:bg-surface-strong",
          shouldCollapse ? "justify-center" : "justify-start"
        )}
        title={shouldCollapse ? item.label : undefined}
      >
        <Icon className={cx("shrink-0 text-base", isActive || isBookingAction ? "text-brand-strong" : "text-muted")} aria-hidden="true" />
        <span className={shouldCollapse ? "sr-only" : undefined}>{item.label}</span>
      </Link>
    );
  }

  return (
    <aside
      className={cx(
        "flex shrink-0 flex-col border-r border-subtle bg-sidebar transition-all duration-200",
        isMobile ? "h-dvh max-h-dvh overflow-hidden" : "h-screen",
        shouldCollapse ? "w-24" : "w-72"
      )}
    >
      <div
        className={cx(
          "relative",
          shouldCollapse ? "grid place-items-center px-2 pt-4 pb-3" : "flex h-20 items-center gap-3 px-5"
        )}
      >
        <Link
          href="/inicio"
          className={cx(
            "min-w-0",
            shouldCollapse ? "grid h-full w-full place-items-center" : "flex flex-1 items-center"
          )}
          onClick={onNavigate}
        >
          <BrandMark
            variant={shouldCollapse ? "compact" : "full"}
            size={shouldCollapse ? "lg" : "md"}
            className={shouldCollapse ? "mb-2 mt-1" : "h-11 w-40 sm:h-12 sm:w-44"}
            priority={mode === "desktop"}
          />
          <span className="sr-only">{messages.appName}</span>
        </Link>
        <Button
          size="icon"
          variant="ghost"
          className={cx(shouldCollapse ? "" : "shrink-0")}
          aria-label={
            isMobile
              ? messages.actions.closeMenu
              : shouldCollapse
                ? messages.actions.expand
                : messages.actions.collapse
          }
          title={
            isMobile
              ? messages.actions.closeMenu
              : shouldCollapse
                ? messages.actions.expand
                : messages.actions.collapse
          }
          onClick={onToggle}
        >
          {isMobile ? <FiX className="text-brand-strong" /> : shouldCollapse ? <FiChevronRight className="text-brand-strong" /> : <FiChevronLeft className="text-brand-strong" />}
        </Button>
      </div>

      <nav className="grid min-h-0 flex-1 auto-rows-max gap-1 overflow-y-auto p-3">
        {bookingItem ? renderItem(bookingItem) : null}
        <div className="mb-4 grid gap-1">
          {dailyItemIds.map((id) => items.find((item) => item.id === id)).filter((item): item is NavigationItem => Boolean(item)).map(renderItem)}
        </div>
        {groups.map((group) => (
          <NavigationSidebarGroup key={group.ids[0]} label={group.label} isCollapsed={shouldCollapse} defaultOpen={group.ids.includes(activeView)} activeItemId={group.ids.includes(activeView) ? activeView : undefined} className="mt-1">
            {group.ids.map((id) => items.find((item) => item.id === id)).filter((item): item is NavigationItem => Boolean(item)).map(renderItem)}
          </NavigationSidebarGroup>
        ))}
      </nav>

      <div className={cx("shrink-0 border-t border-subtle p-3", isMobile ? "pb-safe-6" : "")}>
        {showProUpgrade ? (
          <Link
            href="/perfil?plan=pro"
            onClick={onNavigate}
            title={messages.upgrade.action}
            className={cx(
              "mb-2 flex h-10 items-center gap-2 rounded-lg border border-brand bg-brand-soft px-4 text-sm font-semibold !text-brand-strong shadow-sm transition-colors hover:bg-brand hover:!text-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus button-bounce",
              shouldCollapse ? "justify-center px-0" : "justify-start"
            )}
          >
            <FiZap aria-hidden="true" className="shrink-0 text-lg text-brand-strong" />
            <span className={shouldCollapse ? "sr-only" : undefined}>{messages.upgrade.action}</span>
          </Link>
        ) : null}
        <div className={cx("flex items-center gap-1 rounded-xl", shouldCollapse && "flex-col", isAccountActive && "bg-brand-soft")}>
          <Link
            href={items.find((item) => item.id === "profile")?.href ?? "/perfil"}
            onClick={onNavigate}
            aria-label={[messages.nav.profile, businessName, email, account?.subscriptionTier === "pro" ? "PRO" : ""].filter(Boolean).join(" · ")}
            aria-current={isAccountActive ? "page" : undefined}
            title={[businessName, email].filter(Boolean).join(" · ") || messages.nav.profile}
            className={cx("flex min-w-0 items-center gap-2 rounded-lg p-2 transition-colors hover:bg-surface-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus", shouldCollapse ? "justify-center" : "flex-1")}
          >
            <span className="relative grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-surface-strong text-lg text-brand-strong">
              {logoUrl && failedLogoUrl !== logoUrl ? <Image src={logoUrl} alt="" fill sizes="32px" unoptimized className="object-cover" onError={() => setFailedLogoUrl(logoUrl)} /> : <FiUser aria-hidden="true" />}
            </span>
            {!shouldCollapse ? <span className="min-w-0">
              <span className="flex items-center gap-1.5">
                {businessName ? <span className="line-clamp-2 min-w-0 break-words text-xs font-semibold leading-4 text-primary">{businessName}</span> : null}
                {account?.subscriptionTier === "pro" ? <Badge tone="brand" className="h-6 w-6 shrink-0 justify-center !bg-brand !p-0 !text-brand-soft"><FiZap className="h-3.5 w-3.5" aria-hidden="true" /><span className="sr-only">PRO</span></Badge> : null}
              </span>
              <span className="block truncate text-xs text-muted">{email || messages.nav.profile}</span>
            </span> : null}
          </Link>
        <Button
          size="icon"
          variant="ghost"
          className="!h-8 !w-8 shrink-0"
          aria-label={messages.actions.logout}
          title={messages.actions.logout}
          icon={<FiLogOut />}
          onClick={onLogout}
        />
        </div>
      </div>
    </aside>
  );
}
