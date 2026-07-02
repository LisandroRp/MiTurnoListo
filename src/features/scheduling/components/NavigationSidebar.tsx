import { IconType } from "react-icons";
import { FiChevronLeft, FiChevronRight, FiLogOut, FiX } from "react-icons/fi";
import Link from "next/link";

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
};

export function NavigationSidebar({
  items,
  activeView,
  isCollapsed,
  messages,
  mode = "desktop",
  onNavigate,
  onLogout,
  onToggle
}: NavigationSidebarProps) {
  const isMobile = mode === "mobile";
  const shouldCollapse = !isMobile && isCollapsed;

  return (
    <aside
      className={cx(
        "flex shrink-0 flex-col border-r border-subtle bg-sidebar transition-all duration-200",
        isMobile ? "min-h-screen" : "h-screen",
        shouldCollapse ? "w-20" : "w-72"
      )}
    >
      <div className="flex h-20 items-center justify-between border-b border-subtle px-4">
        <div className={cx("min-w-0", shouldCollapse ? "sr-only" : "")}>
          <p className="text-lg font-bold text-primary">{messages.appName}</p>
          <p className="text-xs text-muted">{messages.businessType}</p>
        </div>
        <Button
          size="icon"
          variant="ghost"
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
          {isMobile ? <FiX /> : shouldCollapse ? <FiChevronRight /> : <FiChevronLeft />}
        </Button>
      </div>

      <nav className="grid gap-1 p-3">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;

          return (
            <Link
              key={item.id}
              href={item.href}
              onClick={onNavigate}
              className={cx(
                "flex h-11 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm font-semibold transition-colors",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
                isActive ? "bg-brand-soft text-brand-strong" : "text-muted hover:bg-surface-strong hover:text-primary",
                shouldCollapse ? "justify-center" : "justify-start"
              )}
              title={shouldCollapse ? item.label : undefined}
            >
              <Icon className="text-lg" aria-hidden="true" />
              <span className={cx(shouldCollapse ? "sr-only" : "")}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-subtle p-3">
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
