"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { FiBarChart2, FiCalendar, FiCreditCard, FiDollarSign, FiGrid, FiHome, FiMenu, FiPlusCircle, FiRefreshCw, FiSettings, FiUserCheck, FiUsers } from "react-icons/fi";

import { BrandMark } from "@/components/composed/BrandMark";
import { WorkspaceLoadingState } from "@/components/composed/WorkspaceLoadingState";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ToastViewport } from "@/components/ui/Toast";
import { useAuth } from "@/features/auth/components/AuthProvider";
import { NavigationItem, NavigationSidebar } from "@/features/scheduling/components/NavigationSidebar";
import { freePlanLimits, getMonthlyAppointmentUsage, isFreePlan } from "@/features/scheduling/plan-limits";
import { useScheduling } from "@/features/scheduling/components/SchedulingProvider";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const didReconcileSubscription = useRef(false);
  const didShowFreeLimitToast = useRef(false);
  const { logout } = useAuth();
  const { appointments, businessId, dismissToast, isLoading, loadError, messages, profile, refreshWorkspaceSubscription, showToast, theme, toasts } = useScheduling();
  const pathname = usePathname();
  const activeView = pathname.startsWith("/calendario")
    ? "calendar"
    : pathname.startsWith("/servicios")
      ? "services"
        : pathname.startsWith("/personal")
          ? "personnel"
            : pathname.startsWith("/clientes")
              ? "customers"
              : pathname.startsWith("/pagos")
                ? "payments"
                : pathname.startsWith("/nueva-reserva")
                  ? "newBooking"
                  : pathname.startsWith("/estadisticas")
                    ? "statistics"
                    : pathname.startsWith("/metodos-de-pago")
                      ? "paymentMethods"
                      : pathname.startsWith("/perfil")
                        ? "profile"
                        : "home";
  const navigationItems: NavigationItem[] = [
    { id: "home", label: messages.nav.home, icon: FiHome, href: "/inicio" },
    { id: "calendar", label: messages.nav.calendar, icon: FiCalendar, href: "/calendario" },
    { id: "services", label: messages.nav.services, icon: FiGrid, href: "/servicios" },
    { id: "personnel", label: messages.nav.personnel, icon: FiUsers, href: "/personal" },
    { id: "customers", label: messages.nav.customers, icon: FiUserCheck, href: "/clientes" },
    { id: "payments", label: messages.nav.payments, icon: FiDollarSign, href: "/pagos" },
    { id: "newBooking", label: messages.nav.newBooking, icon: FiPlusCircle, href: "/nueva-reserva" },
    { id: "statistics", label: messages.nav.statistics, icon: FiBarChart2, href: "/estadisticas" },
    { id: "paymentMethods", label: messages.nav.paymentMethods, icon: FiCreditCard, href: "/metodos-de-pago" },
    { id: "profile", label: messages.nav.profile, icon: FiSettings, href: "/perfil" }
  ];
  const activeNavigationItem = navigationItems.find((item) => item.id === activeView) ?? navigationItems[0];

  useEffect(() => {
    if (
      didReconcileSubscription.current ||
      !businessId ||
      isLoading ||
      loadError ||
      profile.subscriptionTier === "pro"
    ) {
      return;
    }

    didReconcileSubscription.current = true;
    void refreshWorkspaceSubscription().then((result) => {
      if (result?.subscriptionTier === "pro") {
        showToast({
          tone: "success",
          title: messages.profile.subscribedToast,
          description: messages.profile.subscriptionActivatedDescription
        });
      }

      if (result?.status === "pending") {
        showToast({
          tone: "warning",
          title: messages.profile.subscriptionPendingTitle,
          description: messages.profile.subscriptionPendingDescription
        });
      }
    });
  }, [businessId, isLoading, loadError, messages.profile, profile.subscriptionTier, refreshWorkspaceSubscription, showToast]);

  useEffect(() => {
    if (
      didShowFreeLimitToast.current ||
      isLoading ||
      !isFreePlan(profile.subscriptionTier) ||
      getMonthlyAppointmentUsage(appointments) < freePlanLimits.monthlyAppointments
    ) {
      return;
    }

    didShowFreeLimitToast.current = true;
    showToast({
      tone: "warning",
      title: messages.toast.freeMonthlyLimitTitle,
      description: messages.toast.freeMonthlyLimitDescription.replace(
        "{limit}",
        String(freePlanLimits.monthlyAppointments)
      )
    });
  }, [appointments, isLoading, messages, profile.subscriptionTier, showToast]);

  if (isLoading) {
    return <WorkspaceLoadingState theme={theme} />;
  }

  if (loadError) {
    return (
      <main className={`theme-${theme} grid min-h-screen place-items-center bg-shell p-6 text-primary`}>
        <Card className="w-full max-w-md text-center">
          <BrandMark variant="full" size="md" align="center" className="mx-auto" priority />
          <h1 className="mt-2 text-xl font-bold text-primary">No pudimos cargar tu espacio</h1>
          <p className="mt-3 text-sm leading-6 text-muted">{loadError}</p>
          <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
            <Button
              type="button"
              variant="secondary"
              icon={<FiRefreshCw />}
              className="border-brand !text-brand-strong hover:bg-brand-soft hover:!text-brand-strong"
              onClick={() => window.location.reload()}
            >
              Refrescar
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="!text-brand-strong hover:bg-brand-soft hover:!text-brand-strong"
              onClick={() => void logout()}
            >
              Cerrar sesion
            </Button>
          </div>
        </Card>
      </main>
    );
  }

  return (
    <div className={`theme-${theme} flex min-h-screen bg-shell text-primary`}>
      <div className="hidden lg:sticky lg:top-0 lg:block lg:h-screen">
        <NavigationSidebar
          items={navigationItems}
          activeView={activeView}
          isCollapsed={isSidebarCollapsed}
          messages={messages}
          onLogout={() => void logout()}
          onToggle={() => setIsSidebarCollapsed((current) => !current)}
        />
      </div>

      <div
        className={`fixed inset-0 z-40 transition lg:hidden ${
          isMobileSidebarOpen ? "pointer-events-auto" : "pointer-events-none"
        }`}
        aria-hidden={!isMobileSidebarOpen}
      >
        <button
          type="button"
          className={`absolute inset-0 cursor-pointer bg-primary/35 transition-opacity duration-300 ease-out ${
            isMobileSidebarOpen ? "opacity-100" : "opacity-0"
          }`}
          aria-label={messages.actions.closeMenu}
          onClick={() => setIsMobileSidebarOpen(false)}
        />
        <div
          className={`absolute inset-y-0 left-0 transition-transform duration-300 ease-out ${
            isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <NavigationSidebar
            items={navigationItems}
            activeView={activeView}
            isCollapsed={false}
            messages={messages}
            mode="mobile"
            onNavigate={() => setIsMobileSidebarOpen(false)}
            onLogout={() => void logout()}
            onToggle={() => setIsMobileSidebarOpen(false)}
          />
        </div>
      </div>

      <main className="min-w-0 flex-1 overflow-x-hidden">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-subtle bg-sidebar px-4 lg:hidden">
          <Button
            size="icon"
            variant="ghost"
            aria-label={messages.actions.openMenu}
            onClick={() => setIsMobileSidebarOpen(true)}
          >
            <FiMenu />
          </Button>
          <div className="flex min-w-0 items-center gap-3">
            <BrandMark variant="compact" size="sm" priority />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-muted">{messages.appName}</p>
              <h1 className="truncate text-base font-bold text-primary">{activeNavigationItem.label}</h1>
            </div>
          </div>
        </header>
        <div className="pb-safe-6 mx-auto grid min-w-0 max-w-[1440px] gap-6 overflow-auto px-4 pt-5 sm:px-6 lg:px-8 lg:pb-5">
          {children}
        </div>
      </main>

      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
