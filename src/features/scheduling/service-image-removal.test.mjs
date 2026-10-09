import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const projectRoot = resolve(import.meta.dirname, "../../..");

function readProjectFile(path) {
  return readFileSync(resolve(projectRoot, path), "utf8");
}

test("service management no longer exposes image upload controls", () => {
  const servicesView = readProjectFile("src/features/scheduling/components/ServicesView.tsx");
  const servicesPage = readProjectFile("src/app/(dashboard)/servicios/page.tsx");

  assert.equal(servicesView.includes("ImageUploadField"), false);
  assert.equal(servicesView.includes("pendingServiceImageFile"), false);
  assert.equal(servicesView.includes("uploadBusinessImageAsset"), false);
  assert.equal(servicesPage.includes("onImageUploadError"), false);
});

test("service catalogs no longer render service images", () => {
  const publicCatalog = readProjectFile("src/features/booking-flow/components/PublicServicesCatalog.tsx");
  const bookingPreview = readProjectFile("src/app/(dashboard)/nueva-reserva/page.tsx");
  const publicServicesEndpoint = readProjectFile("src/lib/networking/endpoints/public-services.ts");
  const publicServicesRoute = readProjectFile("src/app/api/public-services/[businessId]/route.ts");

  assert.equal(publicCatalog.includes("service.imageUrl"), false);
  assert.equal(bookingPreview.includes("service.imageUrl"), false);
  assert.equal(publicServicesEndpoint.includes("imageUrl"), false);
  assert.equal(publicServicesRoute.includes("image_url"), false);
});

test("service management requires estimated duration", () => {
  const servicesView = readProjectFile("src/features/scheduling/components/ServicesView.tsx");
  const serviceTypes = readProjectFile("src/features/scheduling/types.ts");
  const messages = readProjectFile("src/features/scheduling/i18n/messages.ts");

  assert.equal(servicesView.includes("durationMinutes: event.target.checked ? 0 : null"), false);
  assert.equal(servicesView.includes("handleDurationEnabledChange"), false);
  assert.equal(serviceTypes.includes("durationMinutes: number;"), true);
  assert.equal(messages.includes('duration: "Duración estimada"'), true);
});

test("service management normalizes capacity on blur", () => {
  const servicesView = readProjectFile("src/features/scheduling/components/ServicesView.tsx");

  assert.equal(servicesView.includes("function handleCapacityBlur()"), true);
  assert.equal(servicesView.includes("capacity: Math.max(current.capacity, 1)"), true);
  assert.equal(servicesView.includes("onBlur={handleCapacityBlur}"), true);
});

test("public service views hide capacity when it is one", () => {
  const publicCatalog = readProjectFile("src/features/booking-flow/components/PublicServicesCatalog.tsx");
  const serviceStep = readProjectFile("src/features/booking-flow/components/BookingFlow/steps/ServiceStep.tsx");
  const summaryStep = readProjectFile("src/features/booking-flow/components/BookingFlow/steps/SummaryStep.tsx");

  assert.equal(publicCatalog.includes("service.capacity > 1"), true);
  assert.equal(serviceStep.includes("service.capacity > 1"), true);
  assert.equal(serviceStep.includes("maxPeople > 1"), true);
  assert.equal(summaryStep.includes("service.capacity > 1"), true);
});

test("public booking views hide zero deposits", () => {
  const serviceStep = readProjectFile("src/features/booking-flow/components/BookingFlow/steps/ServiceStep.tsx");
  const summaryStep = readProjectFile("src/features/booking-flow/components/BookingFlow/steps/SummaryStep.tsx");

  assert.equal(serviceStep.includes("service.deposit > 0"), true);
  assert.equal(summaryStep.includes("service.deposit > 0"), true);
});

test("public service views show assigned professionals", () => {
  const publicServicesEndpoint = readProjectFile("src/lib/networking/endpoints/public-services.ts");
  const publicServicesRoute = readProjectFile("src/app/api/public-services/[businessId]/route.ts");
  const publicCatalog = readProjectFile("src/features/booking-flow/components/PublicServicesCatalog.tsx");
  const serviceStep = readProjectFile("src/features/booking-flow/components/BookingFlow/steps/ServiceStep.tsx");

  assert.equal(publicServicesEndpoint.includes("employeeNames: string[]"), true);
  assert.equal(publicServicesRoute.includes("employeeNamesByServiceId"), true);
  assert.equal(publicCatalog.includes("EmployeeFact"), true);
  assert.equal(serviceStep.includes("employees.map((employee) => employee.name)"), true);
  assert.equal(publicCatalog.includes("visibleNames = names.slice(0, 2)"), true);
  assert.equal(publicCatalog.includes("+{hiddenCount}"), true);
  assert.equal(serviceStep.includes("[grid-column:1/-1]"), true);
});

test("public service catalog can be searched by service or professional", () => {
  const publicCatalog = readProjectFile("src/features/booking-flow/components/PublicServicesCatalog.tsx");
  const messages = readProjectFile("src/features/scheduling/i18n/messages.ts");

  assert.equal(publicCatalog.includes("searchQuery"), true);
  assert.equal(publicCatalog.includes("matchesCatalogSearch"), true);
  assert.equal(publicCatalog.includes("...service.employeeNames"), true);
  assert.equal(messages.includes("Buscar por servicio y/o profesional..."), true);
});

test("public service catalog cards are clickable", () => {
  const publicCatalog = readProjectFile("src/features/booking-flow/components/PublicServicesCatalog.tsx");

  assert.equal(publicCatalog.includes('href={`/${businessSlug}/${service.publicSlug || service.id}`}'), true);
  assert.equal(publicCatalog.includes("group-hover:-translate-y-1"), true);
  assert.equal(publicCatalog.includes("group-hover:border-brand"), true);
});

test("services table shows accepted payment labels", () => {
  const servicesView = readProjectFile("src/features/scheduling/components/ServicesView.tsx");
  const messages = readProjectFile("src/features/scheduling/i18n/messages.ts");

  assert.equal(servicesView.includes("getAcceptedPaymentLabels"), true);
  assert.equal(servicesView.includes("return [messages.paymentMethods.mixed]"), true);
  assert.equal(servicesView.includes("messages.services.paymentMethod"), true);
  assert.equal(messages.includes('cash: "Pago en el lugar"'), true);
  assert.equal(messages.includes('card: "Mercado Pago"'), true);
  assert.equal(messages.includes('mixed: "Todos"'), true);
});

test("services table hides empty descriptions", () => {
  const servicesView = readProjectFile("src/features/scheduling/components/ServicesView.tsx");

  assert.equal(servicesView.includes("{service.description || messages.services.emptyDescription}"), true);
  assert.equal(servicesView.includes('<p className="mt-1 line-clamp-2 text-xs leading-5 text-muted">{service.description || messages.services.emptyDescription}</p>'), false);
  assert.equal(servicesView.includes("{service.description ? ("), true);
});

test("sidebar shows personnel before services", () => {
  const appShell = readProjectFile("src/features/scheduling/components/AppShell.tsx");

  assert.equal(appShell.indexOf('id: "personnel"') < appShell.indexOf('id: "services"'), true);
  assert.equal(appShell.includes("hidden xl:sticky xl:top-0 xl:block xl:h-screen"), true);
  assert.equal(appShell.includes("transition xl:hidden"), true);
  assert.equal(appShell.includes("px-4 xl:hidden"), true);
});

test("today agenda expands overflowing hour rows without an inner scroll", () => {
  const dashboardView = readProjectFile("src/features/scheduling/components/DashboardView.tsx");

  assert.equal(dashboardView.includes("expandedHours"), true);
  assert.equal(dashboardView.includes("canExpand = hourAppointments.length > 1"), true);
  assert.equal(dashboardView.includes("didInitialScrollRef"), true);
  assert.equal(dashboardView.includes("hourContentRefs"), true);
  assert.equal(dashboardView.includes("node.scrollHeight"), true);
  assert.equal(dashboardView.includes("ResizeObserver"), true);
  assert.equal(dashboardView.includes("expandedHourHeights[hour]"), true);
  assert.equal(dashboardView.includes("getExpandedHourRowHeight"), false);
  assert.equal(dashboardView.includes("[...hourAppointments, ...hourAppointments]"), false);
  assert.equal(dashboardView.includes("[overflow-anchor:none]"), true);
  assert.equal(dashboardView.includes("transition-[max-height] duration-500 ease-in-out"), true);
  assert.equal(dashboardView.includes('style={{ maxHeight: `${rowMaxHeight}px` }}'), true);
  assert.equal(dashboardView.includes('className="grid content-start gap-1.5 px-4 py-2"'), true);
  assert.equal(dashboardView.includes('isExpanded ? "" : "max-h-24 overflow-hidden"'), false);
  assert.equal(dashboardView.includes("currentHourRowRef.current.offsetTop + currentTimeDetails.minuteOffset"), true);
  assert.equal(dashboardView.includes("useMemo("), true);
  assert.equal(dashboardView.includes("}, [currentTimeDetails]);"), true);
  assert.equal(dashboardView.includes("compactHourRowHeightPx"), true);
  assert.equal(dashboardView.includes("absolute left-0 right-0 z-30 flex w-full items-center"), true);
  assert.equal(dashboardView.includes("absolute left-4 bottom-full rounded-full bg-surface"), true);
});

test("calendar employee filter uses varied colors and compact truncated rows", () => {
  const calendarView = readProjectFile("src/features/scheduling/components/CalendarView.tsx");
  const globals = readProjectFile("src/app/globals.css");

  assert.equal(calendarView.includes("calendarEmployeeColorKeys"), true);
  assert.equal(calendarView.includes('"employee-amber"'), true);
  assert.equal(calendarView.includes('"employee-teal"'), true);
  assert.equal(calendarView.includes("color: calendarEmployeeColorKeys[index % calendarEmployeeColorKeys.length]"), true);
  assert.equal(calendarView.includes("max-w-[min(26rem,calc(100vw-2rem))]"), true);
  assert.equal(calendarView.includes("grid-cols-[minmax(0,1fr)_auto]"), true);
  assert.equal(calendarView.includes("block truncate text-sm font-semibold leading-5 text-primary"), true);
  assert.equal(calendarView.includes('visibleEmployees.map((employee) => employee.name).join(", ")'), false);
  assert.equal(calendarView.includes("contextualEmployees.map((employee)"), true);
  assert.equal(calendarView.includes("onClick={() => onToggleEmployee(employee.id)}"), true);
  assert.equal(calendarView.includes("showOnlyWithAppointments"), true);
  assert.equal(calendarView.includes("doesEmployeeWorkInDates(employee, periodDates)"), true);
  assert.equal(calendarView.includes("hasEmployeeAppointmentInDates(employee.id, periodActiveAppointments)"), true);
  assert.equal(calendarView.includes("grid max-w-64 cursor-pointer gap-0.5 rounded-lg border px-3 py-2 text-left"), true);
  assert.equal(calendarView.includes("block truncate text-xs font-bold leading-4 text-primary"), true);
  assert.equal(calendarView.includes("block truncate text-[11px] font-semibold leading-4 text-muted"), true);
  assert.equal(globals.includes("--color-employee-amber: var(--employee-amber);"), true);
  assert.equal(globals.includes("--color-employee-teal: var(--employee-teal);"), true);
});

test("month calendar shows daily time range and employee color dots", () => {
  const calendarView = readProjectFile("src/features/scheduling/components/CalendarView.tsx");

  assert.equal(calendarView.includes("employeeDotClasses"), true);
  assert.equal(calendarView.includes('monthWeekdayLabels = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]'), true);
  assert.equal(calendarView.includes("const monthGridDates = getMonthGridDates(safeFocusedDate);"), true);
  assert.equal(calendarView.includes("dates: Array<string | null>;"), true);
  assert.equal(calendarView.includes('key={`empty-${index}`}'), true);
  assert.equal(calendarView.includes("getDayAppointmentEmployees"), true);
  assert.equal(calendarView.includes("getDayEmployeeScheduleRanges"), true);
  assert.equal(calendarView.includes("getDayKeyForDate(date)"), true);
  assert.equal(calendarView.includes("employee.schedule[dayKey]"), true);
  assert.equal(calendarView.includes("visibleDayEmployees = dayEmployees.slice(0, 5)"), true);
  assert.equal(calendarView.includes("visibleTimeRanges = timeRanges.slice(0, 2)"), true);
  assert.equal(calendarView.includes("scheduleRange.startTime <= previousRange.endTime"), true);
  assert.equal(calendarView.includes("hiddenEmployeeCount > 0"), true);
  assert.equal(calendarView.includes("hiddenTimeRangeCount > 0"), true);
  assert.equal(calendarView.includes('className="mt-2 text-xs font-semibold text-muted-strong"'), true);
  assert.equal(calendarView.includes('className={cx("h-2.5 w-2.5 rounded-full ring-2 ring-surface", employeeDotClasses[employee.color])}'), true);
});

test("day calendar groups appointments by start hour in full-width rows", () => {
  const calendarView = readProjectFile("src/features/scheduling/components/CalendarView.tsx");
  const messages = readProjectFile("src/features/scheduling/i18n/messages.ts");

  assert.equal(calendarView.includes("dayAppointmentCardHeightPx"), true);
  assert.equal(calendarView.includes("getDayCalendarHourLabels"), true);
  assert.equal(calendarView.includes("appointment.startTime.startsWith(time.slice(0, 2))"), true);
  assert.equal(calendarView.includes("left.startTime.localeCompare(right.startTime)"), true);
  assert.equal(calendarView.includes("grid grid-cols-[5rem_minmax(0,1fr)]"), true);
  assert.equal(calendarView.includes("hourAppointments.length === 0 ? \"min-h-16\""), true);
  assert.equal(calendarView.includes("getDayCalendarLayout"), false);
  assert.equal(calendarView.includes("getDayAppointmentOverlapGroups"), false);
  assert.equal(calendarView.includes("getPositionedDayAppointments"), false);
  assert.equal(calendarView.includes("gridTemplateColumns: `6rem repeat("), false);
  assert.equal(calendarView.includes("messages.home.time"), false);
  assert.equal(messages.includes('withAppointments: "Con turnos"'), true);
  assert.equal(messages.includes('withAppointments: "With appointments"'), true);
});

test("public booking selects date and time before professional", () => {
  const bookingConfig = readProjectFile("src/features/booking-flow/components/BookingFlow/utils/bookingFlowConfig.ts");
  const bookingFlow = readProjectFile("src/features/booking-flow/components/BookingFlow/index.tsx");
  const availabilityCalendar = readProjectFile("src/features/booking-flow/components/AvailabilityCalendar.tsx");

  assert.equal(bookingConfig.includes('["service", "addons", "datetime", "employee", "details", "summary"]'), true);
  assert.equal(bookingFlow.includes("getAvailableSlotsForEmployees"), true);
  assert.equal(bookingFlow.includes("selectableEmployees"), true);
  assert.equal(availabilityCalendar.includes("remainingSpot"), true);
});

test("assisted booking success keeps submitted date time and employee", () => {
  const bookingFlow = readProjectFile("src/features/booking-flow/components/BookingFlow/index.tsx");

  assert.equal(bookingFlow.includes("confirmedBookingSummary"), true);
  assert.equal(bookingFlow.includes("const submittedDraft = {"), true);
  assert.equal(bookingFlow.includes("employeeId: selectedEmployee.id"), true);
  assert.equal(bookingFlow.includes("selectedSlot"), true);
  assert.equal(bookingFlow.includes("employeeName: selectedEmployee.name"), true);
  assert.equal(bookingFlow.includes("setConfirmedBookingSummary(submittedSummary);"), true);
  assert.equal(bookingFlow.includes("draft={confirmedBookingSummary?.draft ?? { ...draft, paymentOption: selectedPaymentOption, selectedSlot }}"), true);
  assert.equal(bookingFlow.includes("employeeName={confirmedBookingSummary?.employeeName ?? selectedEmployee?.name ?? \"\"}"), true);
});

test("payments dashboard shows useful payment summary metrics", () => {
  const paymentsView = readProjectFile("src/features/scheduling/components/PaymentsView.tsx");
  const paymentsEndpoint = readProjectFile("src/lib/networking/endpoints/payments.ts");
  const paymentsRoute = readProjectFile("src/app/api/payments/route.ts");
  const messages = readProjectFile("src/features/scheduling/i18n/messages.ts");

  assert.equal(paymentsEndpoint.includes("statusSummary: Record<PaymentStatus, PaymentsSummaryBucket>;"), true);
  assert.equal(paymentsEndpoint.includes("methodSummary: Record<PaymentMethod, PaymentsSummaryBucket>;"), true);
  assert.equal(paymentsRoute.includes("getPaymentStatusSummary"), true);
  assert.equal(paymentsRoute.includes("getPaymentMethodSummary"), true);
  assert.equal(paymentsRoute.includes("page_size: 1"), true);
  assert.equal(paymentsView.includes("paginationMeta.statusSummary.pending.totalItems"), true);
  assert.equal(paymentsView.includes("paginationMeta.statusSummary.paid.totalAmount"), true);
  assert.equal(paymentsView.includes("getVisiblePaymentSummary"), false);
  assert.equal(paymentsView.includes("value={`${paginationMeta.currentPage}/${paginationMeta.totalPages}`}"), false);
  assert.equal(paymentsView.includes("value={String(paginationMeta.perPage)}"), false);
  assert.equal(messages.includes('pendingTotal: "Pendientes"'), true);
  assert.equal(messages.includes('collectedTotal: "Cobrados"'), true);
});

test("admin assisted booking suggests existing customers after a debounce", () => {
  const bookingFlow = readProjectFile("src/features/booking-flow/components/BookingFlow/index.tsx");
  const detailsStep = readProjectFile("src/features/booking-flow/components/BookingFlow/steps/DetailsStep.tsx");

  assert.equal(bookingFlow.includes("getCustomers"), true);
  assert.equal(bookingFlow.includes('!isPreview || currentStep !== "details"'), true);
  assert.equal(bookingFlow.includes("}, 1500)"), true);
  assert.equal(detailsStep.includes("CustomerLookupField"), true);
  assert.equal(detailsStep.includes("onCustomerSuggestionSelect"), true);
});

test("admin can create walk-in appointments from home and new booking", () => {
  const homePage = readProjectFile("src/app/(dashboard)/inicio/page.tsx");
  const newBookingPage = readProjectFile("src/app/(dashboard)/nueva-reserva/page.tsx");
  const dashboardView = readProjectFile("src/features/scheduling/components/DashboardView.tsx");
  const calendarView = readProjectFile("src/features/scheduling/components/CalendarView.tsx");
  const walkInModal = readProjectFile("src/features/scheduling/components/WalkInAppointmentModal.tsx");
  const messages = readProjectFile("src/features/scheduling/i18n/messages.ts");

  assert.equal(homePage.includes("createAppointment"), true);
  assert.equal(homePage.includes("businessId"), true);
  assert.equal(newBookingPage.includes("WalkInAppointmentModal"), true);
  assert.equal(dashboardView.includes("WalkInAppointmentModal"), true);
  assert.equal(dashboardView.includes("isWalkInConfirmationOpen"), true);
  assert.equal(dashboardView.includes("employeesWorkingToday.length === 0"), true);
  assert.equal(dashboardView.includes("confirmWalkInWithoutActiveTeam"), true);
  assert.equal(walkInModal.includes("addCustomerDetails"), true);
  assert.equal(walkInModal.includes("getCustomers"), true);
  assert.equal(walkInModal.includes("manualMode"), false);
  assert.equal(walkInModal.includes("getEmployeesWorkingOnDate"), false);
  assert.equal(walkInModal.includes("isReservableEmployee(employee) && selectedService.employeeIds.includes(employee.id)"), true);
  assert.equal(walkInModal.includes('const walkInCustomerName = "Sobreturno"'), true);
  assert.equal(walkInModal.includes('source: "walk_in"'), true);
  assert.equal(walkInModal.includes("new Date()"), true);
  assert.equal(walkInModal.includes('paymentMethod === "mixed" ? "cash" : paymentMethod'), true);
  assert.equal(calendarView.includes("grid min-h-12 w-full cursor-pointer"), true);
  assert.equal(calendarView.includes('className="justify-center text-center leading-tight"'), true);
  assert.equal(messages.includes('action: "Sobreturno"'), true);
  assert.equal(messages.includes('noActiveTeamTitle: "Hoy no hay profesionales activos"'), true);
  assert.equal(messages.includes('createAnywayAction: "Crear de todas formas"'), true);
  assert.equal(messages.includes('addCustomerDetails: "Agregar datos del cliente"'), true);
  assert.equal(messages.includes('walkIn: "Sobreturno"'), true);
});

test("admin new booking list only shows services with available slots", () => {
  const newBookingPage = readProjectFile("src/app/(dashboard)/nueva-reserva/page.tsx");
  const messages = readProjectFile("src/features/scheduling/i18n/messages.ts");

  assert.equal(newBookingPage.includes("getAvailableSlotsForEmployees"), true);
  assert.equal(newBookingPage.includes("servicesWithAvailableSlots"), true);
  assert.equal(newBookingPage.includes("hasAvailableBookingSlots"), true);
  assert.equal(messages.includes("No hay turnos disponibles para crear una reserva."), true);
});
