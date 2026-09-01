"use client";

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import { ToastMessage } from "@/components/ui/Toast";
import { shouldRepairWorkspaceAfterSnapshotError } from "@/features/auth/auth-bootstrap";
import { useAuth } from "@/features/auth/components/AuthProvider";
import { messages, Messages } from "@/features/scheduling/i18n/messages";
import { bootstrapWorkspace } from "@/lib/networking/endpoints/auth";
import { getSuperAdminStatus } from "@/lib/networking/endpoints/super-admin";
import {
  Appointment,
  BusinessDayBlock,
  BusinessPaymentSettings,
  BusinessProfile,
  CalendarMode,
  Employee,
  Locale,
  Profile,
  Service,
  SubscriptionTier,
  ThemeId
} from "@/features/scheduling/types";
import {
  archiveEmployee as archiveEmployeeRequest,
  archiveService as archiveServiceRequest,
  createDashboardAppointment,
  deleteProSubscription as deleteProSubscriptionRequest,
  deleteAppointment as deleteAppointmentRequest,
  deleteBusinessDayBlock as deleteBusinessDayBlockRequest,
  deleteEmployee as deleteEmployeeRequest,
  deleteService as deleteServiceRequest,
  isRecoverableWorkspaceLoadError,
  getSchedulingSnapshotScopeConfig,
  loadSchedulingSnapshot,
  SchedulingSnapshotScope,
  markAppointmentNoShow as markAppointmentNoShowRequest,
  markAppointmentPaid as markAppointmentPaidRequest,
  rescheduleAppointment as rescheduleAppointmentRequest,
  refreshWorkspaceSubscription as refreshWorkspaceSubscriptionRequest,
  saveEmployee as saveEmployeeRequest,
  saveBusinessProfile as saveBusinessProfileRequest,
  saveBusinessDayBlock as saveBusinessDayBlockRequest,
  saveProfileAvatar as saveProfileAvatarRequest,
  savePaymentSettings as savePaymentSettingsRequest,
  saveService as saveServiceRequest,
  startProSubscription as startProSubscriptionRequest,
  unarchiveEmployee as unarchiveEmployeeRequest,
  unarchiveService as unarchiveServiceRequest,
  updateEmployeeVisibility as updateEmployeeVisibilityRequest,
  updateSchedulingPreferences,
} from "@/lib/networking/endpoints/scheduling";
import { getPayloadErrorMessage } from "@/lib/networking/response-errors";

type SchedulingContextValue = {
  appointments: Appointment[];
  businessDayBlocks: BusinessDayBlock[];
  dashboardMetrics: {
    id: string;
    labelKey: "revenue" | "activeEmployees" | "bookedAppointments" | "cancelledAppointments";
    value: string;
    trendValue: number | null;
    trendFormat: "currency" | "count" | "current";
    trendTone: "success" | "danger" | "neutral";
    trendContextKey: "monthComparison" | "currentTeam";
  }[];
  employees: Employee[];
  focusedDate: string;
  isFetching: boolean;
  isLoading: boolean;
  isSuperAdmin: boolean;
  loadError: string | null;
  messages: Messages;
  paymentSettings: BusinessPaymentSettings;
  profile: Profile;
  services: Service[];
  themeOptions: ThemeId[];
  calendarMode: CalendarMode;
  dismissToast: (toastId: string) => void;
  employeeQuery: string;
  locale: Locale;
  businessId: string | null;
  saveEmployee: (employee: Employee) => Promise<boolean>;
  saveBusinessProfile: (profile: BusinessProfile) => Promise<boolean>;
  saveProfileAvatar: (avatarUrl: string) => Promise<boolean>;
  savePaymentSettings: (settings: BusinessPaymentSettings) => Promise<boolean>;
  saveService: (service: Service) => Promise<boolean>;
  saveBusinessDayBlock: (dayBlock: BusinessDayBlock) => Promise<boolean>;
  selectedEmployeeIds: string[];
  setCalendarMode: (mode: CalendarMode) => void;
  setEmployeeQuery: (query: string) => void;
  setFocusedDate: (date: string) => void;
  setLocale: (locale: Locale) => Promise<boolean>;
  startProSubscription: () => Promise<{ checkoutUrl: string; subscriptionTier: SubscriptionTier } | null>;
  cancelProSubscription: () => Promise<boolean>;
  refreshWorkspaceSubscription: (preapprovalId?: string) => Promise<{ status: string; subscriptionTier: SubscriptionTier } | null>;
  setTheme: (theme: ThemeId) => Promise<boolean>;
  showToast: (toast: Omit<ToastMessage, "id">) => void;
  theme: ThemeId;
  toggleEmployee: (employeeId: string) => void;
  toasts: ToastMessage[];
  createAppointment: (appointment: Appointment, addonIds?: string[]) => Promise<boolean>;
  deleteAppointment: (appointmentId: string, cancellationReason: string) => Promise<boolean>;
  markAppointmentNoShow: (appointmentId: string) => Promise<boolean>;
  markAppointmentPaid: (appointmentId: string) => Promise<boolean>;
  rescheduleAppointment: (appointmentId: string, date: string, employeeId: string, startTime: string, endTime: string) => Promise<boolean>;
  archiveEmployee: (employeeId: string) => Promise<boolean>;
  archiveService: (serviceId: string) => Promise<boolean>;
  deleteEmployee: (employeeId: string) => Promise<boolean>;
  deleteService: (serviceId: string) => Promise<boolean>;
  deleteBusinessDayBlock: (dayBlockId: string) => Promise<boolean>;
  unarchiveEmployee: (employeeId: string) => Promise<boolean>;
  unarchiveService: (serviceId: string) => Promise<boolean>;
  updateEmployeeVisibility: (employeeId: string, isVisible: boolean) => Promise<boolean>;
};

const SchedulingContext = createContext<SchedulingContextValue | null>(null);

const emptyProfile: Profile = {
  firstName: "",
  lastName: "",
  email: "",
  subscriptionTier: "free",
  businessName: "",
  address: "",
  publicDescription: "",
  publicLogoUrl: "",
  publicOpeningHours: "",
  avatarUrl: ""
};

const emptyPaymentSettings: BusinessPaymentSettings = {
  mercadoPago: {
    accessToken: "",
    publicKey: "",
    isConfigured: false
  },
  transfers: {
    accountHolder: "",
    cbu: "",
    alias: "",
    receiptWhatsapp: ""
  }
};

function getTodayDateValue() {
  return new Date().toISOString().slice(0, 10);
}

export function SchedulingProvider({ children }: { children: ReactNode }) {
  const toastCounter = useRef(1);
  const didAttemptWorkspaceRepair = useRef(false);
  const loadedSnapshotScopesRef = useRef<Set<SchedulingSnapshotScope>>(new Set());
  const { status: authStatus } = useAuth();
  const pathname = usePathname();
  const snapshotScope = useMemo(() => getSchedulingSnapshotScope(pathname), [pathname]);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [locale, setLocaleState] = useState<Locale>("es");
  const [theme, setThemeState] = useState<ThemeId>("coral");
  const [calendarMode, setCalendarMode] = useState<CalendarMode>("month");
  const [focusedDate, setFocusedDate] = useState(() => getTodayDateValue());
  const [employeeQuery, setEmployeeQuery] = useState("");
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [employeeList, setEmployeeList] = useState<Employee[]>([]);
  const [profileState, setProfileState] = useState<Profile>(emptyProfile);
  const [appointmentList, setAppointmentList] = useState<Appointment[]>([]);
  const [businessDayBlockList, setBusinessDayBlockList] = useState<BusinessDayBlock[]>([]);
  const [serviceList, setServiceList] = useState<Service[]>([]);
  const [paymentSettings, setPaymentSettings] = useState<BusinessPaymentSettings>(emptyPaymentSettings);
  const [themeOptions, setThemeOptions] = useState<ThemeId[]>(["coral", "blue", "sage"]);
  const [dashboardMetrics, setDashboardMetrics] = useState<SchedulingContextValue["dashboardMetrics"]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadedSnapshotScopes, setLoadedSnapshotScopes] = useState<SchedulingSnapshotScope[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const copy = messages[locale];
  const isCurrentScopeCached = loadedSnapshotScopes.includes(snapshotScope);
  const isSnapshotScopePending = authStatus === "authenticated" && !isCurrentScopeCached;
  const isWorkspaceLoading = isLoading || isSnapshotScopePending;

  function clearWorkspace() {
    didAttemptWorkspaceRepair.current = false;
    loadedSnapshotScopesRef.current = new Set();
    setBusinessId(null);
    setLocaleState("es");
    setThemeState("coral");
    setFocusedDate(getTodayDateValue());
    setEmployeeQuery("");
    setSelectedEmployeeIds([]);
    setEmployeeList([]);
    setProfileState(emptyProfile);
    setAppointmentList([]);
    setBusinessDayBlockList([]);
    setServiceList([]);
    setPaymentSettings(emptyPaymentSettings);
    setDashboardMetrics([]);
    setIsSuperAdmin(false);
    setLoadError(null);
    setIsFetching(false);
    setIsLoading(false);
    setLoadedSnapshotScopes([]);
  }

  function markSnapshotScopeLoaded(scope: SchedulingSnapshotScope) {
    if (loadedSnapshotScopesRef.current.has(scope)) {
      return;
    }

    loadedSnapshotScopesRef.current = new Set([...loadedSnapshotScopesRef.current, scope]);
    setLoadedSnapshotScopes(Array.from(loadedSnapshotScopesRef.current));
  }

  const loadSchedulingSnapshotWithRepair = useCallback(async () => {
    try {
      return await loadSchedulingSnapshot({ scope: snapshotScope });
    } catch (error) {
      const shouldRepairWorkspace = shouldRepairWorkspaceAfterSnapshotError({
        didAttemptWorkspaceRepair: didAttemptWorkspaceRepair.current,
        isRecoverableLoadError: isRecoverableWorkspaceLoadError(error)
      });

      if (!shouldRepairWorkspace) {
        throw error;
      }

      didAttemptWorkspaceRepair.current = true;
      try {
        await bootstrapWorkspace();
      } catch {
        throw new Error("No pudimos cargar tu espacio. Refresca la pagina o vuelve a iniciar sesion.");
      }

      return loadSchedulingSnapshot({ scope: snapshotScope });
    }
  }, [snapshotScope]);

  const hydrateWorkspace = useCallback(async (options: { preserveFocusedDate?: boolean } = {}) => {
    try {
      const [snapshot, superAdminStatus] = await Promise.all([
        loadSchedulingSnapshotWithRepair(),
        snapshotScope === "profile" ? loadSuperAdminStatus() : Promise.resolve<boolean | null>(null)
      ]);
      const scopeConfig = getSchedulingSnapshotScopeConfig(snapshotScope);
      setBusinessId(snapshot.businessId);
      setLocaleState(snapshot.locale);
      setThemeState(snapshot.theme);
      setThemeOptions(snapshot.themeOptions);
      if (!options.preserveFocusedDate) {
        setFocusedDate(snapshot.focusedDate);
      }
      setProfileState(snapshot.profile);

      if (scopeConfig.includeEmployees) {
        setEmployeeList(snapshot.employees);
        setSelectedEmployeeIds((current) => (
          current.length > 0
            ? current.filter((employeeId) => snapshot.employees.some((employee) => employee.id === employeeId && !employee.isArchived))
            : snapshot.employees.filter((employee) => !employee.isArchived).map((employee) => employee.id)
        ));
      }

      if (scopeConfig.includeAppointments) {
        setAppointmentList(snapshot.appointments);
      }

      if (scopeConfig.includeBusinessDayBlocks) {
        setBusinessDayBlockList(snapshot.businessDayBlocks);
      }

      if (scopeConfig.includeServices) {
        setServiceList(snapshot.services);
      }

      if (scopeConfig.includePaymentSettings) {
        setPaymentSettings(snapshot.paymentSettings);
      }

      if (scopeConfig.includeAppointments && scopeConfig.includeEmployees) {
        setDashboardMetrics(snapshot.dashboardMetrics);
      }

      if (superAdminStatus !== null) {
        setIsSuperAdmin(superAdminStatus);
      }

      setLoadError(null);
      markSnapshotScopeLoaded(snapshotScope);
      return true;
    } catch (error) {
      setLoadError(getWorkspaceLoadErrorMessage(error));
      return false;
    }
  }, [loadSchedulingSnapshotWithRepair, snapshotScope]);

  useEffect(() => {
    if (authStatus !== "authenticated") {
      if (authStatus === "loading" || authStatus === "bootstrapping") {
        return;
      }

      const resetTimer = window.setTimeout(() => {
        clearWorkspace();
      }, 0);

      return () => {
        window.clearTimeout(resetTimer);
      };
    }

    let isActive = true;
    const hasScopeCache = loadedSnapshotScopesRef.current.has(snapshotScope);
    const loadTimer = window.setTimeout(() => {
      setIsLoading(!hasScopeCache);
      setIsFetching(hasScopeCache);
      setLoadError(null);

      void hydrateWorkspace().then((didLoad) => {
        if (!isActive) {
          return;
        }

        setIsLoading(false);
        setIsFetching(false);
      });
    }, 0);

    return () => {
      isActive = false;
      window.clearTimeout(loadTimer);
    };
  }, [authStatus, hydrateWorkspace, snapshotScope]);

  function showToast(toast: Omit<ToastMessage, "id">) {
    const toastId = `toast-${toastCounter.current}`;
    toastCounter.current += 1;
    setToasts((current) => [{ id: toastId, ...toast }, ...current].slice(0, 3));
  }

  function dismissToast(toastId: string) {
    setToasts((current) => current.filter((toast) => toast.id !== toastId));
  }

  function toggleEmployee(employeeId: string) {
    setSelectedEmployeeIds((current) => {
      if (current.includes(employeeId)) {
        return current.length === 1 ? current : current.filter((id) => id !== employeeId);
      }

      return [...current, employeeId];
    });
  }

  async function saveService(service: Service) {
    if (!businessId) {
      return false;
    }

    return runMutation(
      () => saveServiceRequest(businessId, service),
      copy.toast.serviceSaved
    );
  }

  async function deleteService(serviceId: string) {
    if (!businessId) {
      return false;
    }

    return runMutation(
      () => deleteServiceRequest(businessId, serviceId),
      copy.toast.serviceDeleted,
      "Unable to delete the service."
    );
  }

  async function archiveService(serviceId: string) {
    if (!businessId) {
      return false;
    }

    return runMutation(
      () => archiveServiceRequest(businessId, serviceId),
      copy.toast.serviceArchived,
      "Unable to archive the service."
    );
  }

  async function unarchiveService(serviceId: string) {
    if (!businessId) {
      return false;
    }

    return runMutation(
      () => unarchiveServiceRequest(businessId, serviceId),
      copy.toast.serviceUnarchived,
      "Unable to unarchive the service."
    );
  }

  async function deleteAppointment(appointmentId: string, cancellationReason: string) {
    if (!businessId) {
      return false;
    }

    return runMutation(
      () => deleteAppointmentRequest(businessId, appointmentId, cancellationReason),
      copy.toast.appointmentDeleted,
      "Unable to delete the appointment."
    );
  }

  async function saveBusinessDayBlock(dayBlock: BusinessDayBlock) {
    if (!businessId) {
      return false;
    }

    return runMutation(
      () => saveBusinessDayBlockRequest(businessId, dayBlock),
      copy.toast.businessDayBlockSaved,
      "Unable to save the blocked day."
    );
  }

  async function deleteBusinessDayBlock(dayBlockId: string) {
    if (!businessId) {
      return false;
    }

    return runMutation(
      () => deleteBusinessDayBlockRequest(businessId, dayBlockId),
      copy.toast.businessDayBlockDeleted,
      "Unable to delete the blocked day."
    );
  }

  async function saveEmployee(employee: Employee) {
    if (!businessId) {
      return false;
    }

    return runMutation(
      () => saveEmployeeRequest(businessId, employee),
      copy.toast.employeeSaved
    );
  }

  async function deleteEmployee(employeeId: string) {
    if (!businessId) {
      return false;
    }

    return runMutation(
      () => deleteEmployeeRequest(businessId, employeeId),
      copy.toast.employeeDeleted,
      "Unable to delete the employee."
    );
  }

  async function archiveEmployee(employeeId: string) {
    if (!businessId) {
      return false;
    }

    return runMutation(
      () => archiveEmployeeRequest(businessId, employeeId),
      copy.toast.employeeArchived,
      "Unable to archive the employee."
    );
  }

  async function unarchiveEmployee(employeeId: string) {
    if (!businessId) {
      return false;
    }

    return runMutation(
      () => unarchiveEmployeeRequest(businessId, employeeId),
      copy.toast.employeeUnarchived,
      "Unable to unarchive the employee."
    );
  }

  async function updateEmployeeVisibility(employeeId: string, isVisible: boolean) {
    if (!businessId) {
      return false;
    }

    return runMutation(
      () => updateEmployeeVisibilityRequest(businessId, employeeId, isVisible),
      copy.toast.employeeVisibilityUpdated,
      "Unable to update the employee visibility."
    );
  }

  async function savePaymentSettings(settings: BusinessPaymentSettings) {
    if (!businessId) {
      return false;
    }

    try {
      const savedSettings = await savePaymentSettingsRequest(businessId, settings);
      setPaymentSettings(savedSettings);
      showToast({ tone: "success", title: copy.adminPaymentMethods.paymentDataSaved });
      return true;
    } catch (error) {
      showToast({
        tone: "error",
        title: copy.toast.error,
        description: getErrorMessage(error, "Unable to save payment settings.")
      });
      return false;
    }
  }

  async function saveBusinessProfile(profile: BusinessProfile) {
    if (!businessId) {
      return false;
    }

    try {
      const savedProfile = await saveBusinessProfileRequest(businessId, profile);
      setProfileState((current) => ({
        ...current,
        businessName: savedProfile.name,
        address: savedProfile.address,
        publicDescription: savedProfile.publicDescription,
        publicLogoUrl: savedProfile.publicLogoUrl,
        publicOpeningHours: savedProfile.publicOpeningHours
      }));
      showToast({ tone: "success", title: copy.profile.businessSavedToast });
      return true;
    } catch (error) {
      showToast({
        tone: "error",
        title: copy.toast.error,
        description: getErrorMessage(error, "Unable to save business profile.")
      });
      return false;
    }
  }

  async function saveProfileAvatar(avatarUrl: string) {
    if (!businessId) {
      return false;
    }

    try {
      const savedAvatarUrl = await saveProfileAvatarRequest(businessId, avatarUrl);
      setProfileState((current) => ({
        ...current,
        avatarUrl: savedAvatarUrl
      }));
      showToast({ tone: "success", title: copy.profile.avatarSavedToast });
      return true;
    } catch (error) {
      showToast({
        tone: "error",
        title: copy.toast.error,
        description: getErrorMessage(error, "Unable to save profile image.")
      });
      return false;
    }
  }

  async function startProSubscription() {
    if (!businessId) {
      return null;
    }

    try {
      const result = await startProSubscriptionRequest(businessId);

      if (result.subscriptionTier === "pro") {
        const didRefresh = await hydrateWorkspace();

        if (didRefresh) {
          showToast({
            tone: "success",
            title: copy.profile.subscribedToast
          });
        }
      }

      return result;
    } catch (error) {
      showToast({
        tone: "error",
        title: "Subscription update failed",
        description: getErrorMessage(error, "Unable to start the subscription.")
      });
      return null;
    }
  }

  async function cancelProSubscription() {
    if (!businessId) {
      return false;
    }

    try {
      await deleteProSubscriptionRequest(businessId);
      const didRefresh = await hydrateWorkspace({ preserveFocusedDate: true });

      if (!didRefresh) {
        showToast({
          tone: "warning",
          title: copy.profile.unsubscribedToast,
          description: "La suscripcion se cancelo, pero la vista necesita refrescarse."
        });
        return true;
      }

      showToast({
        tone: "success",
        title: copy.profile.unsubscribedToast
      });
      return true;
    } catch (error) {
      showToast({
        tone: "error",
        title: "Subscription update failed",
        description: getErrorMessage(error, "Unable to cancel the subscription.")
      });
      return false;
    }
  }

  async function refreshWorkspaceSubscription(preapprovalId?: string) {
    if (!businessId) {
      return null;
    }

    try {
      const result = await refreshWorkspaceSubscriptionRequest(businessId, preapprovalId);
      const didRefresh = await hydrateWorkspace();

      if (!didRefresh) {
        return result;
      }

      return result;
    } catch (error) {
      showToast({
        tone: "error",
        title: "Subscription update failed",
        description: getErrorMessage(error, "Unable to verify the subscription.")
      });
      return null;
    }
  }

  async function createAppointment(appointment: Appointment, addonIds: string[] = []) {
    if (!businessId) {
      return false;
    }

    const service = serviceList.find((item) => item.id === appointment.serviceId);

    if (!service) {
      showToast({
        tone: "error",
        title: "Appointment error",
        description: "The selected service was not found."
      });
      return false;
    }

    return runMutation(
      () => createDashboardAppointment({ addonIds, appointment, businessId, service }),
      copy.bookingFlow.reservationCreated,
      "No se puede crear en este momento."
    );
  }

  async function markAppointmentPaid(appointmentId: string) {
    if (!businessId) {
      return false;
    }

    return runMutation(
      () => markAppointmentPaidRequest(businessId, appointmentId),
      copy.toast.appointmentPaid,
      "Unable to mark the appointment as paid."
    );
  }

  async function markAppointmentNoShow(appointmentId: string) {
    if (!businessId) {
      return false;
    }

    return runMutation(
      () => markAppointmentNoShowRequest(businessId, appointmentId),
      copy.toast.appointmentNoShow,
      "Unable to mark the appointment as no-show."
    );
  }

  async function rescheduleAppointment(appointmentId: string, date: string, employeeId: string, startTime: string, endTime: string) {
    if (!businessId) {
      return false;
    }

    return runMutation(
      () => rescheduleAppointmentRequest({ appointmentId, businessId, date, employeeId, endTime, startTime }),
      copy.toast.appointmentRescheduled,
      "Unable to reschedule the appointment."
    );
  }

  async function setLocale(localeValue: Locale) {
    if (!businessId) {
      return false;
    }

    try {
      await updateSchedulingPreferences({
        businessId,
        locale: localeValue
      });
      setLocaleState(localeValue);
      return true;
    } catch (error) {
      showToast({
        tone: "error",
        title: "Preferences update failed",
        description: getErrorMessage(error, "Unable to update the language.")
      });
      return false;
    }
  }

  async function setTheme(themeValue: ThemeId) {
    if (!businessId) {
      return false;
    }

    try {
      await updateSchedulingPreferences({
        businessId,
        theme: themeValue
      });
      setThemeState(themeValue);
      return true;
    } catch (error) {
      showToast({
        tone: "error",
        title: "Preferences update failed",
        description: getErrorMessage(error, "Unable to update the theme.")
      });
      return false;
    }
  }

  async function runMutation(
    action: () => Promise<void>,
    successTitle: string,
    fallbackMessage = "Unable to save changes."
  ) {
    try {
      await action();
      const didRefresh = await hydrateWorkspace();

      if (!didRefresh) {
        showToast({
          tone: "warning",
          title: successTitle,
          description: "The change was saved, but the view needs a refresh."
        });
        return true;
      }

      showToast({ tone: "success", title: successTitle });
      return true;
    } catch (error) {
      showToast({
        tone: "error",
        title: "Update failed",
        description: getErrorMessage(error, fallbackMessage)
      });
      return false;
    }
  }

  return (
    <SchedulingContext.Provider
      value={{
        appointments: appointmentList,
        businessDayBlocks: businessDayBlockList,
        businessId,
        dashboardMetrics,
        cancelProSubscription,
        employees: employeeList,
        focusedDate,
        isFetching,
        isLoading: isWorkspaceLoading,
        isSuperAdmin,
        loadError,
        messages: copy,
        paymentSettings,
        profile: profileState,
        services: serviceList,
        themeOptions,
        calendarMode,
        dismissToast,
        employeeQuery,
        locale,
        saveBusinessProfile,
        saveBusinessDayBlock,
        saveProfileAvatar,
        saveEmployee,
        savePaymentSettings,
        saveService,
        selectedEmployeeIds,
        setCalendarMode,
        setEmployeeQuery,
        setFocusedDate,
        setLocale,
        startProSubscription,
        refreshWorkspaceSubscription,
        setTheme,
        showToast,
        theme,
        toggleEmployee,
        toasts,
        createAppointment,
        archiveEmployee,
        archiveService,
        deleteAppointment,
        deleteBusinessDayBlock,
        markAppointmentNoShow,
        markAppointmentPaid,
        rescheduleAppointment,
        deleteEmployee,
        deleteService,
        unarchiveEmployee,
        unarchiveService,
        updateEmployeeVisibility
      }}
    >
      {children}
    </SchedulingContext.Provider>
  );
}

export function useScheduling() {
  const context = useContext(SchedulingContext);

  if (!context) {
    throw new Error("useScheduling must be used within SchedulingProvider");
  }

  return context;
}

function getErrorMessage(error: unknown, fallbackMessage: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return getPayloadErrorMessage(error, fallbackMessage);
}

function getWorkspaceLoadErrorMessage(error: unknown) {
  if (isRecoverableWorkspaceLoadError(error)) {
    return "No pudimos cargar tu espacio. Refresca la pagina o vuelve a iniciar sesion.";
  }

  return getErrorMessage(error, "No pudimos cargar tu espacio. Intenta refrescar la pagina.");
}

async function loadSuperAdminStatus() {
  try {
    return await getSuperAdminStatus();
  } catch {
    return false;
  }
}

function getSchedulingSnapshotScope(pathname: string): SchedulingSnapshotScope {
  if (pathname.startsWith("/calendario")) {
    return "calendar";
  }

  if (pathname.startsWith("/servicios")) {
    return "services";
  }

  if (pathname.startsWith("/personal")) {
    return "personnel";
  }

  if (pathname.startsWith("/pagos")) {
    return "payments";
  }

  if (pathname.startsWith("/metodos-de-pago")) {
    return "paymentMethods";
  }

  if (pathname.startsWith("/nueva-reserva")) {
    return "booking";
  }

  if (pathname.startsWith("/estadisticas")) {
    return "statistics";
  }

  if (pathname.startsWith("/perfil")) {
    return "profile";
  }

  return "dashboard";
}
