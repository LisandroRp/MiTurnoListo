"use client";

import { createContext, ReactNode, useContext, useEffect, useRef, useState } from "react";

import { ToastMessage } from "@/components/ui/Toast";
import { useAuth } from "@/features/auth/components/AuthProvider";
import { messages, Messages } from "@/features/scheduling/i18n/messages";
import {
  Appointment,
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
  deleteEmployee as deleteEmployeeRequest,
  deleteService as deleteServiceRequest,
  loadSchedulingSnapshot,
  markAppointmentPaid as markAppointmentPaidRequest,
  rescheduleAppointment as rescheduleAppointmentRequest,
  refreshWorkspaceSubscription as refreshWorkspaceSubscriptionRequest,
  saveEmployee as saveEmployeeRequest,
  saveBusinessProfile as saveBusinessProfileRequest,
  saveProfileAvatar as saveProfileAvatarRequest,
  savePaymentSettings as savePaymentSettingsRequest,
  saveService as saveServiceRequest,
  startProSubscription as startProSubscriptionRequest,
  unarchiveEmployee as unarchiveEmployeeRequest,
  unarchiveService as unarchiveServiceRequest,
  updateSchedulingPreferences,
} from "@/lib/networking/endpoints/scheduling";
import { getPayloadErrorMessage } from "@/lib/networking/response-errors";

type SchedulingContextValue = {
  appointments: Appointment[];
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
  isLoading: boolean;
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
  createAppointment: (appointment: Appointment) => Promise<boolean>;
  deleteAppointment: (appointmentId: string) => Promise<boolean>;
  markAppointmentPaid: (appointmentId: string) => Promise<boolean>;
  rescheduleAppointment: (appointmentId: string, date: string, employeeId: string) => Promise<boolean>;
  archiveEmployee: (employeeId: string) => Promise<boolean>;
  archiveService: (serviceId: string) => Promise<boolean>;
  deleteEmployee: (employeeId: string) => Promise<boolean>;
  deleteService: (serviceId: string) => Promise<boolean>;
  unarchiveEmployee: (employeeId: string) => Promise<boolean>;
  unarchiveService: (serviceId: string) => Promise<boolean>;
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
  const { status: authStatus } = useAuth();
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
  const [serviceList, setServiceList] = useState<Service[]>([]);
  const [paymentSettings, setPaymentSettings] = useState<BusinessPaymentSettings>(emptyPaymentSettings);
  const [themeOptions, setThemeOptions] = useState<ThemeId[]>(["coral", "blue", "sage"]);
  const [dashboardMetrics, setDashboardMetrics] = useState<SchedulingContextValue["dashboardMetrics"]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const copy = messages[locale];

  function clearWorkspace() {
    setBusinessId(null);
    setLocaleState("es");
    setThemeState("coral");
    setFocusedDate(getTodayDateValue());
    setEmployeeQuery("");
    setSelectedEmployeeIds([]);
    setEmployeeList([]);
    setProfileState(emptyProfile);
    setAppointmentList([]);
    setServiceList([]);
    setPaymentSettings(emptyPaymentSettings);
    setDashboardMetrics([]);
    setLoadError(null);
    setIsLoading(false);
  }

  async function hydrateWorkspace() {
    try {
      const snapshot = await loadSchedulingSnapshot();
      setBusinessId(snapshot.businessId);
      setLocaleState(snapshot.locale);
      setThemeState(snapshot.theme);
      setThemeOptions(snapshot.themeOptions);
      setFocusedDate(snapshot.focusedDate);
      setEmployeeList(snapshot.employees);
      setSelectedEmployeeIds(snapshot.employees.filter((employee) => !employee.isArchived).map((employee) => employee.id));
      setProfileState(snapshot.profile);
      setAppointmentList(snapshot.appointments);
      setServiceList(snapshot.services);
      setPaymentSettings(snapshot.paymentSettings);
      setDashboardMetrics(snapshot.dashboardMetrics);
      setLoadError(null);
      return true;
    } catch (error) {
      setLoadError(getErrorMessage(error, "Unable to load the workspace."));
      return false;
    }
  }

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
    const loadTimer = window.setTimeout(() => {
      setIsLoading(true);
      setLoadError(null);

      void hydrateWorkspace().then((didLoad) => {
        if (!isActive) {
          return;
        }

        setIsLoading(false);
      });
    }, 0);

    return () => {
      isActive = false;
      window.clearTimeout(loadTimer);
    };
  }, [authStatus]);

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

  async function deleteAppointment(appointmentId: string) {
    if (!businessId) {
      return false;
    }

    return runMutation(
      () => deleteAppointmentRequest(businessId, appointmentId),
      copy.toast.appointmentDeleted,
      "Unable to delete the appointment."
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
      const didRefresh = await hydrateWorkspace();

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

  async function createAppointment(appointment: Appointment) {
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
      () => createDashboardAppointment({ appointment, businessId, service }),
      copy.bookingFlow.reservationCreated,
      "Unable to create the appointment."
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

  async function rescheduleAppointment(appointmentId: string, date: string, employeeId: string) {
    if (!businessId) {
      return false;
    }

    return runMutation(
      () => rescheduleAppointmentRequest({ appointmentId, businessId, date, employeeId }),
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
        businessId,
        dashboardMetrics,
        cancelProSubscription,
        employees: employeeList,
        focusedDate,
        isLoading,
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
        markAppointmentPaid,
        rescheduleAppointment,
        deleteEmployee,
        deleteService,
        unarchiveEmployee,
        unarchiveService
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
