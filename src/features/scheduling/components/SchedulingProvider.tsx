"use client";

import { createContext, ReactNode, useContext, useEffect, useRef, useState } from "react";

import { ToastMessage } from "@/components/ui/Toast";
import { useAuth } from "@/features/auth/components/AuthProvider";
import { messages, Messages } from "@/features/scheduling/i18n/messages";
import {
  Appointment,
  BusinessPaymentSettings,
  CalendarMode,
  Employee,
  Locale,
  Profile,
  Service,
  SubscriptionTier,
  ThemeId
} from "@/features/scheduling/types";
import {
  createDashboardAppointment,
  deleteAppointment as deleteAppointmentRequest,
  deleteEmployee as deleteEmployeeRequest,
  deleteService as deleteServiceRequest,
  loadSchedulingSnapshot,
  saveEmployee as saveEmployeeRequest,
  savePaymentSettings as savePaymentSettingsRequest,
  saveService as saveServiceRequest,
  updateSchedulingPreferences,
  updateSubscriptionTier
} from "@/lib/networking/endpoints/scheduling";

type SchedulingContextValue = {
  appointments: Appointment[];
  dashboardMetrics: {
    id: string;
    labelKey: "revenue" | "activeEmployees" | "bookedAppointments" | "cancelledAppointments";
    value: string;
    trend: string;
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
  saveEmployee: (employee: Employee) => Promise<boolean>;
  savePaymentSettings: (settings: BusinessPaymentSettings) => Promise<boolean>;
  saveService: (service: Service) => Promise<boolean>;
  selectedEmployeeIds: string[];
  setCalendarMode: (mode: CalendarMode) => void;
  setEmployeeQuery: (query: string) => void;
  setFocusedDate: (date: string) => void;
  setLocale: (locale: Locale) => Promise<boolean>;
  setSubscriptionTier: (tier: SubscriptionTier) => Promise<boolean>;
  setTheme: (theme: ThemeId) => Promise<boolean>;
  showToast: (toast: Omit<ToastMessage, "id">) => void;
  theme: ThemeId;
  toggleEmployee: (employeeId: string) => void;
  toasts: ToastMessage[];
  createAppointment: (appointment: Appointment) => Promise<boolean>;
  deleteAppointment: (appointmentId: string) => Promise<boolean>;
  deleteEmployee: (employeeId: string) => Promise<boolean>;
  deleteService: (serviceId: string) => Promise<boolean>;
};

const SchedulingContext = createContext<SchedulingContextValue | null>(null);

const emptyProfile: Profile = {
  firstName: "",
  lastName: "",
  email: "",
  subscriptionTier: "free",
  businessName: "",
  address: "",
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
    alias: ""
  }
};

export function SchedulingProvider({ children }: { children: ReactNode }) {
  const toastCounter = useRef(1);
  const { status: authStatus } = useAuth();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [locale, setLocaleState] = useState<Locale>("es");
  const [theme, setThemeState] = useState<ThemeId>("coral");
  const [calendarMode, setCalendarMode] = useState<CalendarMode>("day");
  const [focusedDate, setFocusedDate] = useState("");
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
    setFocusedDate("");
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
      setSelectedEmployeeIds(snapshot.employees.map((employee) => employee.id));
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

        if (!didLoad) {
          setLoadError("Unable to load the workspace.");
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
    return runMutation(
      () => deleteServiceRequest(serviceId),
      copy.toast.serviceDeleted,
      "Unable to delete the service."
    );
  }

  async function deleteAppointment(appointmentId: string) {
    return runMutation(
      () => deleteAppointmentRequest(appointmentId),
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
    return runMutation(
      () => deleteEmployeeRequest(employeeId),
      copy.toast.employeeDeleted,
      "Unable to delete the employee."
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

  async function setSubscriptionTier(tier: SubscriptionTier) {
    if (!businessId) {
      return false;
    }

    try {
      await updateSubscriptionTier(businessId, tier);
      setProfileState((current) => ({ ...current, subscriptionTier: tier }));
      showToast({
        tone: "success",
        title: tier === "pro" ? copy.profile.subscribedToast : copy.profile.unsubscribedToast
      });
      return true;
    } catch (error) {
      showToast({
        tone: "error",
        title: "Subscription update failed",
        description: getErrorMessage(error, "Unable to update the subscription.")
      });
      return false;
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
        dashboardMetrics,
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
        saveEmployee,
        savePaymentSettings,
        saveService,
        selectedEmployeeIds,
        setCalendarMode,
        setEmployeeQuery,
        setFocusedDate,
        setLocale,
        setSubscriptionTier,
        setTheme,
        showToast,
        theme,
        toggleEmployee,
        toasts,
        createAppointment,
        deleteAppointment,
        deleteEmployee,
        deleteService
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

  return fallbackMessage;
}
