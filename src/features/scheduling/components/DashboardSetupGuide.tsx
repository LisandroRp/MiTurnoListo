"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { FiArrowRight, FiCheck, FiFlag, FiGrid, FiUsers, FiX } from "react-icons/fi";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { cx } from "@/components/ui/utils";
import { usePointerTilt } from "@/components/ui/usePointerTilt";
import { setupCreationQuery, setupCreationValue } from "@/features/scheduling/components/useSetupCreation";
import type { Messages } from "@/features/scheduling/i18n/messages";
import { getPlanIncludedIds } from "@/features/scheduling/plan-limits";
import type { Employee, Service, SubscriptionTier } from "@/features/scheduling/types";

type DashboardSetupGuideProps = {
  copy: Messages["setupGuide"];
  employees: Employee[];
  services: Service[];
  subscriptionTier: SubscriptionTier;
  isReady: boolean;
  isCreating: boolean;
};

const createQuery = `?${setupCreationQuery}=${setupCreationValue}`;

export function DashboardSetupGuide({ copy, employees, services, subscriptionTier, isReady, isCreating }: DashboardSetupGuideProps) {
  const [isDismissed, setIsDismissed] = useState(false);
  const titleId = useId();
  const launcherRef = useRef<HTMLButtonElement>(null);
  const focusLauncherOnClose = useRef(false);
  const stepTilt = usePointerTilt<HTMLLIElement>();

  const activePersonnel = employees.filter((employee) => !employee.isArchived);
  const includedPersonnelIds = getPlanIncludedIds(activePersonnel.filter((employee) => employee.isVisible), subscriptionTier, "employees");
  const hasService = services.some((service) => !service.isArchived);
  const hasAssignablePersonnel = activePersonnel.some((employee) =>
    employee.isVisible && (!includedPersonnelIds || includedPersonnelIds.has(employee.id))
  );
  const hasPersonnel = activePersonnel.length > 0;
  const needsVisiblePersonnel = hasPersonnel && !hasAssignablePersonnel && !hasService;
  const completed = Number(hasPersonnel) + Number(hasService);
  const canShow = isReady && !isCreating && completed < 2;
  const isOpen = canShow && !isDismissed;
  const showLauncher = canShow && !isOpen;
  const nextHref = needsVisiblePersonnel ? "/personal" : hasPersonnel ? `/servicios${createQuery}` : `/personal${createQuery}`;
  const nextLabel = needsVisiblePersonnel ? copy.managePersonnel : hasPersonnel ? copy.createService : copy.createPersonnel;

  useEffect(() => {
    if (showLauncher && focusLauncherOnClose.current) {
      focusLauncherOnClose.current = false;
      launcherRef.current?.focus();
    }
  }, [showLauncher]);

  function dismiss() {
    focusLauncherOnClose.current = true;
    setIsDismissed(true);
  }

  function handleDialogKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      dismiss();
      return;
    }

    if (event.key !== "Tab") return;

    const controls = event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), a[href]");
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && event.target === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && event.target === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  const steps = [
    { id: "personnel", icon: FiUsers, done: hasPersonnel, title: needsVisiblePersonnel ? copy.enablePersonnel : copy.personnel, hint: needsVisiblePersonnel ? copy.enablePersonnelHint : copy.personnelHint },
    { id: "service", icon: FiGrid, done: hasService, title: copy.service, hint: copy.serviceHint }
  ];

  return (
    <>
      {showLauncher ? (
        <Button
          ref={launcherRef}
          size="icon"
          className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 size-12 !rounded-full shadow-lg motion-safe:animate-[button-bounce_950ms_ease-in-out_infinite] motion-safe:transition-transform motion-safe:hover:scale-110 sm:right-6 sm:size-14 [&_svg]:size-5"
          aria-label={copy.reopen}
          aria-haspopup="dialog"
          title={copy.reopen}
          icon={<FiFlag />}
          onClick={() => setIsDismissed(false)}
        />
      ) : null}
      <Modal isOpen={isOpen} className="!p-0" aria-labelledby={titleId}>
        <div onKeyDown={handleDialogKeyDown}>
          <div className="relative grid gap-3 bg-brand-soft px-5 pt-6 pb-5 sm:px-7">
            <Button className="absolute top-3 right-3" size="icon" variant="ghost" aria-label={copy.close} icon={<FiX />} autoFocus onClick={dismiss} />
            <span className="grid size-12 place-items-center rounded-xl bg-brand text-2xl text-on-brand shadow-sm" aria-hidden="true">
              <FiFlag />
            </span>
            <h2 id={titleId} className="pr-6 text-2xl font-bold text-primary sm:text-3xl">{copy.title}</h2>
          </div>
          <div className="grid gap-4 px-5 py-5 sm:px-7">
            <div className="grid gap-2">
              <p className="text-xs font-semibold text-muted">{copy.progress.replace("{completed}", String(completed))}</p>
              <div className="grid grid-cols-2 gap-2" aria-hidden="true">
                {[1, 2].map((step) => <span key={step} className={cx("h-2.5 rounded-full border border-brand", completed >= step ? "bg-brand" : "bg-transparent")} />)}
              </div>
            </div>
            <ol className="grid gap-2">
              {steps.map(({ id, icon: Icon, done, title, hint }) => (
                <li
                  key={id}
                  {...stepTilt}
                  className={cx(
                    "flex items-start gap-3 rounded-xl border p-3",
                    stepTilt.className,
                    done ? "border-subtle bg-surface" : "border-subtle bg-surface-strong"
                  )}
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-lg text-brand-strong" aria-hidden="true">
                    {done ? <FiCheck /> : <Icon />}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-primary">{title}{done ? <span className="sr-only">. {copy.completed}</span> : null}</p>
                    <p className="mt-0.5 text-sm leading-5 text-muted">{hint}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button variant="ghost" onClick={dismiss}>{copy.later}</Button>
              <Link
                href={nextHref}
                onNavigate={() => setIsDismissed(true)}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold !text-on-brand shadow-sm transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                {nextLabel} <FiArrowRight aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}
