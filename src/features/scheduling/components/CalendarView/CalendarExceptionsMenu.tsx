import { useEffect, useId, useRef, useState } from "react";
import { FiCalendar, FiChevronDown, FiClock } from "react-icons/fi";

import { Button } from "@/components/ui/Button";
import { cx } from "@/components/ui/utils";
import { useDropdownMotion } from "@/components/ui/useDropdownMotion";
import { Messages } from "@/features/scheduling/i18n/messages";

type Props = {
  messages: Messages;
  onBusinessBlockedDays: () => void;
  onEmployeeBlockedDays: () => void;
  onSpecialHours: () => void;
};

export function CalendarExceptionsMenu({ messages, onBusinessBlockedDays, onEmployeeBlockedDays, onSpecialHours }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const contentId = useId();
  const { isPresent } = useDropdownMotion({ isOpen, triggerRef: trigger, contentRef: content, variant: "diagonal" });

  useEffect(() => {
    if (!isOpen) return;
    content.current?.querySelector("button")?.focus();
    function onPointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setIsOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsOpen(false);
        root.current?.querySelector("button")?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  function select(action: () => void) {
    setIsOpen(false);
    root.current?.querySelector("button")?.focus();
    action();
  }

  return (
    <div ref={root} className="relative max-sm:flex max-sm:w-full max-sm:justify-end" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false);
    }}>
      <Button
        ref={trigger}
        variant="secondary"
        icon={<FiCalendar />}
        aria-expanded={isOpen}
        aria-controls={contentId}
        onClick={() => setIsOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") { event.preventDefault(); setIsOpen(true); }
        }}
      >
        {messages.calendar.exceptions}
        <FiChevronDown className={cx("transition-transform duration-200 motion-reduce:transition-none", isOpen ? "rotate-180" : "")} aria-hidden="true" />
      </Button>
      {isPresent ? (
        <div ref={content} id={contentId} inert={!isOpen} aria-hidden={!isOpen || undefined} className="absolute right-0 z-30 mt-2 grid w-80 max-w-[calc(100vw-2rem)] gap-1 rounded-lg border border-subtle bg-surface p-1.5 shadow-lg">
          <Button variant="ghost" className="justify-start text-primary" icon={<FiCalendar className="text-brand-strong" />} onClick={() => select(onBusinessBlockedDays)}>{messages.calendar.blockedBusinessTitle}</Button>
          <Button variant="ghost" className="justify-start text-primary" icon={<FiCalendar className="text-brand-strong" />} onClick={() => select(onEmployeeBlockedDays)}>{messages.calendar.blockedEmployeeTitle}</Button>
          <Button variant="ghost" className="justify-start text-primary" icon={<FiClock className="text-brand-strong" />} onClick={() => select(onSpecialHours)}>{messages.calendar.exceptional.title}</Button>
        </div>
      ) : null}
    </div>
  );
}
