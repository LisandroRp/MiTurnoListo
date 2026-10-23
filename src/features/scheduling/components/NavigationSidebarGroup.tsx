import { ReactNode, useId, useState } from "react";
import { FiChevronDown } from "react-icons/fi";

import { cx } from "@/components/ui/utils";

type NavigationSidebarGroupProps = {
  label: string;
  isCollapsed: boolean;
  defaultOpen: boolean;
  className?: string;
  children: ReactNode;
};

export function NavigationSidebarGroup({ label, isCollapsed, defaultOpen, className, children }: NavigationSidebarGroupProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className={className}>
      <button
        type="button"
        id={`${id}-trigger`}
        title={isCollapsed ? label : undefined}
        aria-expanded={isOpen}
        aria-controls={`${id}-content`}
        onClick={() => setIsOpen((current) => !current)}
        className={cx("flex min-h-10 w-full cursor-pointer items-center gap-2 rounded-lg px-3 text-xs font-bold text-muted transition-colors hover:bg-surface-strong hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus", isCollapsed ? "justify-center" : "justify-between")}
      >
        <span className={isCollapsed ? "sr-only" : undefined}>{label}</span>
        <FiChevronDown aria-hidden="true" className={cx("h-4 w-4 shrink-0 text-brand-strong transition-transform duration-300 motion-reduce:transition-none", isOpen && "rotate-180")} />
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
