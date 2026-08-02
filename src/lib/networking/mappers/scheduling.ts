import {
  Appointment,
  AppointmentStatus,
  BusinessPaymentSettings,
  DashboardMetric,
  Employee,
  PaymentMethod,
  Profile,
  Service,
  ServiceAddon,
  ServiceSchedule,
  ThemeId,
  TimeRange
} from "@/features/scheduling/types";
import { formatCurrency } from "@/features/scheduling/utils/format";
import { formatDateForTimeZone, formatTimeForTimeZone, formatTodayForTimeZone } from "@/lib/networking/utils/date-time";

type DayKey = keyof ServiceSchedule;

type AvailabilityRow = {
  id: string;
  employee_id?: string;
  service_id?: string;
  weekday: number;
  start_time: string;
  end_time: string;
};

type EmployeeRow = {
  id: string;
  name: string;
  role: string;
  description: string;
  image_url: string | null;
  color_token: string;
};

type ServiceRow = {
  id: string;
  name: string;
  description: string;
  image_url: string | null;
  price_amount: number;
  deposit_amount: number;
  duration_minutes: number;
  capacity: number;
  reservation_lead_minutes: number;
  payment_mode: PaymentMethod;
  is_public: boolean;
};

type ServiceEmployeeRow = {
  service_id: string;
  employee_id: string;
};

type ServiceAddonRow = {
  id: string;
  service_id: string;
  name: string;
  price_amount: number;
  is_active: boolean;
  sort_order: number;
};

type AppointmentRow = {
  id: string;
  service_id: string;
  employee_id: string;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  total_amount: number;
  selected_payment_method: Exclude<PaymentMethod, "mixed"> | null;
  party_size: number;
  customer_name_snapshot: string;
  customer_email_snapshot: string | null;
  customer_phone_snapshot: string | null;
};

type UserProfileRow = {
  first_name: string;
  last_name: string;
  avatar_url: string | null;
};

type BusinessRow = {
  name: string;
  address: string | null;
  subscription_tier: Profile["subscriptionTier"];
  timezone: string;
};

type PaymentSettingsRow = {
  allow_mercadopago: boolean;
  mercadopago_public_key: string | null;
  transfer_account_holder: string | null;
  transfer_cbu: string | null;
  transfer_alias: string | null;
  transfer_receipt_whatsapp: string | null;
};

const dayKeys: readonly DayKey[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday"
];

const weekdayToDayKey: Record<number, DayKey> = {
  0: "sunday",
  1: "monday",
  2: "tuesday",
  3: "wednesday",
  4: "thursday",
  5: "friday",
  6: "saturday"
};

export const themeOptions: ThemeId[] = ["coral", "blue", "sage"];

export function createEmptySchedule(): ServiceSchedule {
  return {
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
    sunday: []
  };
}

export function mapEmployees(employeeRows: EmployeeRow[], availabilityRows: AvailabilityRow[]): Employee[] {
  return employeeRows.map((employee) => ({
    id: employee.id,
    name: employee.name,
    role: employee.role,
    description: employee.description,
    imageUrl: employee.image_url ?? "",
    color: employee.color_token,
    initials: getInitials(employee.name),
    schedule: buildSchedule(
      availabilityRows.filter((row) => row.employee_id === employee.id)
    )
  }));
}

export function mapServices(
  serviceRows: ServiceRow[],
  serviceEmployeeRows: ServiceEmployeeRow[],
  availabilityRows: AvailabilityRow[],
  addonRows: ServiceAddonRow[] = []
): Service[] {
  return serviceRows.map((service) => ({
    id: service.id,
    name: service.name,
    description: service.description,
    imageUrl: service.image_url ?? "",
    price: service.price_amount,
    capacity: service.capacity,
    deposit: service.deposit_amount,
    durationMinutes: service.duration_minutes,
    paymentMethod: service.payment_mode,
    isVisible: service.is_public,
    reservationLeadMinutes: service.reservation_lead_minutes,
    schedule: buildSchedule(
      availabilityRows.filter((row) => row.service_id === service.id)
    ),
    employeeIds: serviceEmployeeRows
      .filter((row) => row.service_id === service.id)
      .map((row) => row.employee_id),
    addons: mapServiceAddons(addonRows.filter((row) => row.service_id === service.id))
  }));
}

function mapServiceAddons(rows: ServiceAddonRow[]): ServiceAddon[] {
  return rows
    .map((row) => ({
      id: row.id,
      isActive: row.is_active,
      name: row.name,
      price: row.price_amount,
      sortOrder: row.sort_order
    }))
    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name));
}

export function mapAppointments(appointmentRows: AppointmentRow[], timeZone: string): Appointment[] {
  return appointmentRows
    .map((appointment) => ({
      id: appointment.id,
      customerName: appointment.customer_name_snapshot,
      customerEmail: appointment.customer_email_snapshot ?? "",
      customerPhone: appointment.customer_phone_snapshot ?? "",
      serviceId: appointment.service_id,
      employeeId: appointment.employee_id,
      date: formatDateForTimeZone(appointment.starts_at, timeZone),
      startTime: formatTimeForTimeZone(appointment.starts_at, timeZone),
      endTime: formatTimeForTimeZone(appointment.ends_at, timeZone),
      status: appointment.status,
      revenue: appointment.total_amount,
      paymentMethod: appointment.selected_payment_method ?? "cash",
      partySize: appointment.party_size
    }))
    .sort((left, right) => {
      const leftKey = `${left.date}T${left.startTime}`;
      const rightKey = `${right.date}T${right.startTime}`;
      return leftKey.localeCompare(rightKey);
    });
}

export function mapProfile(
  userProfile: UserProfileRow,
  business: BusinessRow,
  userEmail: string
): Profile {
  return {
    firstName: userProfile.first_name,
    lastName: userProfile.last_name,
    email: userEmail,
    subscriptionTier: business.subscription_tier,
    businessName: business.name,
    address: business.address ?? "",
    avatarUrl: userProfile.avatar_url ?? ""
  };
}

export function mapPaymentSettings(row: PaymentSettingsRow | null): BusinessPaymentSettings {
  return {
    mercadoPago: {
      accessToken: "",
      publicKey: row?.mercadopago_public_key ?? "",
      isConfigured: Boolean(row?.allow_mercadopago)
    },
    transfers: {
      accountHolder: row?.transfer_account_holder ?? "",
      cbu: row?.transfer_cbu ?? "",
      alias: row?.transfer_alias ?? "",
      receiptWhatsapp: row?.transfer_receipt_whatsapp ?? ""
    }
  };
}

export function buildDashboardMetrics(appointments: Appointment[], employees: Employee[], referenceDate: string): DashboardMetric[] {
  const currentMonthAppointments = appointments.filter((appointment) => matchesMonth(appointment.date, referenceDate, 0));
  const previousMonthAppointments = appointments.filter((appointment) => matchesMonth(appointment.date, referenceDate, -1));
  const bookedAppointments = currentMonthAppointments.filter((appointment) => appointment.status !== "cancelled");
  const previousBookedAppointments = previousMonthAppointments.filter((appointment) => appointment.status !== "cancelled");
  const cancelledAppointments = currentMonthAppointments.filter((appointment) => appointment.status === "cancelled");
  const previousCancelledAppointments = previousMonthAppointments.filter((appointment) => appointment.status === "cancelled");
  const estimatedRevenue = bookedAppointments.reduce((total, appointment) => total + appointment.revenue, 0);
  const previousEstimatedRevenue = previousBookedAppointments.reduce((total, appointment) => total + appointment.revenue, 0);
  const revenueDelta = estimatedRevenue - previousEstimatedRevenue;
  const bookedDelta = bookedAppointments.length - previousBookedAppointments.length;
  const cancelledDelta = cancelledAppointments.length - previousCancelledAppointments.length;

  return [
    {
      id: "revenue",
      labelKey: "revenue",
      value: formatCurrency(estimatedRevenue),
      trendValue: revenueDelta,
      trendFormat: "currency",
      trendTone: getDeltaTone(revenueDelta),
      trendContextKey: "monthComparison"
    },
    {
      id: "employees",
      labelKey: "activeEmployees",
      value: String(employees.length),
      trendValue: null,
      trendFormat: "current",
      trendTone: "neutral",
      trendContextKey: "currentTeam"
    },
    {
      id: "booked",
      labelKey: "bookedAppointments",
      value: String(bookedAppointments.length),
      trendValue: bookedDelta,
      trendFormat: "count",
      trendTone: getDeltaTone(bookedDelta),
      trendContextKey: "monthComparison"
    },
    {
      id: "cancelled",
      labelKey: "cancelledAppointments",
      value: String(cancelledAppointments.length),
      trendValue: cancelledDelta,
      trendFormat: "count",
      trendTone: getInverseDeltaTone(cancelledDelta),
      trendContextKey: "monthComparison"
    }
  ];
}

function matchesMonth(dateValue: string, referenceDate: string, monthOffset: number) {
  const date = new Date(`${dateValue}T12:00:00`);
  const reference = new Date(`${referenceDate}T12:00:00`);
  reference.setMonth(reference.getMonth() + monthOffset);

  return date.getFullYear() === reference.getFullYear() && date.getMonth() === reference.getMonth();
}

function getDeltaTone(delta: number): DashboardMetric["trendTone"] {
  if (delta > 0) {
    return "success";
  }

  if (delta < 0) {
    return "danger";
  }

  return "neutral";
}

function getInverseDeltaTone(delta: number): DashboardMetric["trendTone"] {
  if (delta > 0) {
    return "danger";
  }

  if (delta < 0) {
    return "success";
  }

  return "neutral";
}

export function getDefaultFocusedDate(_appointments: Appointment[], timeZone: string) {
  return formatTodayForTimeZone(timeZone);
}

export function mapScheduleToAvailabilityRows(
  schedule: ServiceSchedule,
  relationKey: "employee_id" | "service_id",
  relationValue: string
) {
  return dayKeys.flatMap((day) =>
    schedule[day].map((range) => ({
      [relationKey]: relationValue,
      weekday: getWeekdayFromDayKey(day),
      start_time: range.start,
      end_time: range.end
    }))
  );
}

function buildSchedule(rows: AvailabilityRow[]) {
  const schedule = createEmptySchedule();

  rows.forEach((row) => {
    const dayKey = weekdayToDayKey[row.weekday];
    const nextRange: TimeRange = {
      id: row.id,
      start: row.start_time.slice(0, 5),
      end: row.end_time.slice(0, 5)
    };

    schedule[dayKey] = [...schedule[dayKey], nextRange].sort((left, right) => left.start.localeCompare(right.start));
  });

  return schedule;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "NA";
}

function getWeekdayFromDayKey(dayKey: DayKey) {
  const entry = Object.entries(weekdayToDayKey).find(([, value]) => value === dayKey);

  if (!entry) {
    throw new Error(`Unsupported day key: ${dayKey}`);
  }

  return Number(entry[0]);
}
