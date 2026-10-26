import { ReactNode, useEffect, useId, useState } from "react";
import { FiChevronDown } from "react-icons/fi";

import { cx } from "@/components/ui/utils";

type NavigationSidebarGroupProps = {
  label: string;
  isCollapsed: boolean;
  defaultOpen: boolean;
  activeItemId?: string;
  className?: string;
  children: ReactNode;
};

export function NavigationSidebarGroup({ label, isCollapsed, defaultOpen, activeItemId, className, children }: NavigationSidebarGroupProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const id = useId();
  useEffect(() => {
    if (!activeItemId) return;
    const timer = window.setTimeout(() => setIsOpen(true), 0);
    return () => window.clearTimeout(timer);
  }, [activeItemId]);
  return (
    <div className={className}>
      <button
        type="button"
        id={`${id}-trigger`}
        title={isCollapsed ? label : undefined}
        aria-expanded={isOpen}
        aria-controls={`${id}-content`}
        onClick={() => setIsOpen((current) => !current)}
        className={cx("flex min-h-9 w-full cursor-pointer items-center gap-2 rounded-lg px-3 text-xs font-medium text-muted transition-colors hover:bg-surface-strong hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus", isCollapsed ? "justify-center" : "justify-between")}
      >
        <span className={isCollapsed ? "sr-only" : undefined}>{label}</span>
        <FiChevronDown aria-hidden="true" className={cx("h-3.5 w-3.5 shrink-0 text-brand-strong transition-transform duration-300 motion-reduce:transition-none", isOpen && "rotate-180")} />
      </button>
      <div
        id={`${id}-content`}
        aria-labelledby={`${id}-trigger`}
        aria-hidden={!isOpen}
        inert={!isOpen}
        className={cx("grid transition-[grid-template-rows,opacity] duration-300 ease-in-out motion-reduce:transition-none", isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="mt-1 grid gap-1">{children}</div>
        </div>
      </div>
    </div>
  );
}
