export type Locale = "es" | "en";
export type ThemeId = "coral" | "blue" | "sage";
export type CalendarMode = "day" | "week" | "month";
export type ViewId =
  | "home"
  | "calendar"
  | "services"
  | "personnel"
  | "customers"
  | "payments"
  | "newBooking"
  | "statistics"
  | "paymentMethods"
  | "profile";
export type PaymentMethod = "cash" | "card" | "transfer" | "mixed";
export type ToastTone = "success" | "warning" | "error";
export type BookingStep = "service" | "addons" | "employee" | "datetime" | "details" | "summary" | "success";
export type SubscriptionTier = "free" | "pro";

export type Employee = {
  id: string;
  name: string;
  role: string;
  description: string;
  imageUrl: string;
  color: string;
  initials: string;
  schedule: ServiceSchedule;
};

export type AppointmentStatus = "confirmed" | "pending" | "cancelled";

export type Appointment = {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  serviceId: string;
  employeeId: string;
  date: string;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  revenue: number;
  paymentMethod: PaymentMethod;
  partySize: number;
};

export type TimeRange = {
  id: string;
  start: string;
  end: string;
};

export type ServiceSchedule = Record<string, TimeRange[]>;

export type Service = {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  price: number;
  capacity: number;
  deposit: number;
  durationMinutes: number;
  paymentMethod: PaymentMethod;
  isVisible: boolean;
  reservationLeadMinutes: number;
  schedule: ServiceSchedule;
  employeeIds: string[];
  addons: ServiceAddon[];
};

export type ServiceAddon = {
  id: string;
  name: string;
  price: number;
  isActive: boolean;
  sortOrder: number;
};

export type Profile = {
  firstName: string;
  lastName: string;
  email: string;
  subscriptionTier: SubscriptionTier;
  businessName: string;
  address: string;
  avatarUrl: string;
};

export type MercadoPagoSettings = {
  accessToken: string;
  publicKey: string;
  isConfigured: boolean;
};

export type TransferPaymentSettings = {
  accountHolder: string;
  cbu: string;
  alias: string;
  receiptWhatsapp: string;
};

export type BusinessPaymentSettings = {
  mercadoPago: MercadoPagoSettings;
  transfers: TransferPaymentSettings;
};

export type BookingCustomer = {
  fullName: string;
  phone: string;
  email: string;
};

export type Customer = {
  id: string;
  bookingCount: number;
  fullName: string;
  email: string;
  phone: string;
  lastBookedAt: string;
  lastServiceName: string;
  totalRevenue: number;
};

export type PaymentStatus = "pending" | "paid" | "cancelled" | "refunded";

export type PaymentRecord = {
  id: string;
  appointmentId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  serviceName: string;
  employeeName: string;
  date: string;
  startTime: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
};

export type DashboardMetric = {
  id: string;
  labelKey: "revenue" | "activeEmployees" | "bookedAppointments" | "cancelledAppointments";
  value: string;
  trendValue: number | null;
  trendFormat: "currency" | "count" | "current";
  trendTone: "success" | "danger" | "neutral";
  trendContextKey: "monthComparison" | "currentTeam";
};

export type ToastMessage = {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
};
