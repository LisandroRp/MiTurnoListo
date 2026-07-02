"use client";

import { ReactNode, useState } from "react";
import { usePathname } from "next/navigation";
import { FiBarChart2, FiCalendar, FiCreditCard, FiGrid, FiHome, FiMenu, FiPlusCircle, FiSettings, FiUsers } from "react-icons/fi";

import { BrandMark } from "@/components/composed/BrandMark";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ToastViewport } from "@/components/ui/Toast";
import { useAuth } from "@/features/auth/components/AuthProvider";
import { NavigationItem, NavigationSidebar } from "@/features/scheduling/components/NavigationSidebar";
import { useScheduling } from "@/features/scheduling/components/SchedulingProvider";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const { logout } = useAuth();
  const { dismissToast, isLoading, loadError, messages, theme, toasts } = useScheduling();
  const pathname = usePathname();
  const activeView = pathname.startsWith("/calendario")
    ? "calendar"
    : pathname.startsWith("/servicios")
      ? "services"
      : pathname.startsWith("/personal")
        ? "personnel"
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
    { id: "newBooking", label: messages.nav.newBooking, icon: FiPlusCircle, href: "/nueva-reserva" },
    { id: "statistics", label: messages.nav.statistics, icon: FiBarChart2, href: "/estadisticas" },
    { id: "paymentMethods", label: messages.nav.paymentMethods, icon: FiCreditCard, href: "/metodos-de-pago" },
    { id: "profile", label: messages.nav.profile, icon: FiSettings, href: "/perfil" }
  ];
  const activeNavigationItem = navigationItems.find((item) => item.id === activeView) ?? navigationItems[0];

  if (isLoading) {
    return (
      <main className={`theme-${theme} grid min-h-screen place-items-center bg-shell p-6 text-primary`}>
        <Card className="w-full max-w-sm text-center">
          <BrandMark variant="full" size="md" align="center" className="mx-auto" priority />
          <h1 className="mt-2 text-xl font-bold text-primary">Preparando tu espacio...</h1>
        </Card>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className={`theme-${theme} grid min-h-screen place-items-center bg-shell p-6 text-primary`}>
        <Card className="w-full max-w-md text-center">
          <BrandMark variant="full" size="md" align="center" className="mx-auto" priority />
          <h1 className="mt-2 text-xl font-bold text-primary">No pudimos cargar tu espacio</h1>
          <p className="mt-3 text-sm leading-6 text-muted">{loadError}</p>
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
        <div className="mx-auto grid min-w-0 overflow-auto max-w-[1440px] gap-6 px-4 py-5 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>

      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
