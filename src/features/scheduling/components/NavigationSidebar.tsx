import { IconType } from "react-icons";
import { FiChevronDown, FiChevronLeft, FiChevronRight, FiLogOut, FiX, FiZap } from "react-icons/fi";
import Link from "next/link";

import { BrandMark } from "@/components/composed/BrandMark";
import { Button } from "@/components/ui/Button";
import { cx } from "@/components/ui/utils";
import { Messages } from "@/features/scheduling/i18n/messages";
import { ViewId } from "@/features/scheduling/types";

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
  showProUpgrade = false
}: NavigationSidebarProps) {
  const isMobile = mode === "mobile";
  const shouldCollapse = !isMobile && isCollapsed;
  const groups = [
    { label: messages.nav.operationsGroup, ids: ["home", "calendar", "newBooking", "customers"] },
    { label: messages.nav.businessGroup, ids: ["personnel", "services", "payments", "statistics"] },
    { label: messages.nav.communicationGroup, ids: ["messages", "referrals", "suggestions"] }
  ];

  function renderItem(item: NavigationItem) {
    const Icon = item.icon;
    const isActive = activeView === item.id || (item.id === "profile" && activeView === "paymentMethods");
    return (
      <Link
        key={item.id}
        href={item.href}
        onClick={onNavigate}
        aria-current={isActive ? "page" : undefined}
        className={cx(
          "flex h-10 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
          isActive ? "bg-brand-soft text-brand-strong" : "text-muted hover:bg-surface-strong hover:text-primary",
          shouldCollapse ? "justify-center" : "justify-start"
        )}
        title={shouldCollapse ? item.label : undefined}
      >
        <Icon className="shrink-0 text-lg text-brand-strong" aria-hidden="true" />
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
          "relative border-b border-subtle",
          shouldCollapse ? "grid place-items-center px-2 pt-5 pb-4" : "flex h-24 items-center gap-3 px-5"
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
        {groups.map((group, index) => (
          <details key={group.ids[0]} open={index === 0} className={cx("group", index > 0 && "mt-2 border-t border-subtle pt-2")}>
            <summary
              title={shouldCollapse ? group.label : undefined}
              className={cx(
                "flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-lg px-3 text-xs font-bold text-muted transition-colors hover:bg-surface-strong hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus [&::-webkit-details-marker]:hidden",
                shouldCollapse ? "justify-center" : "justify-between"
              )}
            >
              <span className={shouldCollapse ? "sr-only" : undefined}>{group.label}</span>
              <FiChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-brand-strong transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-1 grid gap-1">
              {group.ids.map((id) => items.find((item) => item.id === id)).filter((item): item is NavigationItem => Boolean(item)).map(renderItem)}
            </div>
          </details>
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
        {items.filter((item) => item.id === "profile").map(renderItem)}
        <Button
          size={shouldCollapse ? "icon" : "md"}
          variant="ghost"
          className={cx("w-full", shouldCollapse ? "" : "justify-start")}
          aria-label={messages.actions.logout}
          title={messages.actions.logout}
          icon={<FiLogOut />}
          onClick={onLogout}
        >
          {shouldCollapse ? null : messages.actions.logout}
        </Button>
      </div>
    </aside>
  );
}
