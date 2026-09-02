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

  assert.equal(publicCatalog.includes('href={`/reservar/${service.id}`}'), true);
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

test("public booking selects date and time before professional", () => {
  const bookingConfig = readProjectFile("src/features/booking-flow/components/BookingFlow/utils/bookingFlowConfig.ts");
  const bookingFlow = readProjectFile("src/features/booking-flow/components/BookingFlow/index.tsx");
  const availabilityCalendar = readProjectFile("src/features/booking-flow/components/AvailabilityCalendar.tsx");

  assert.equal(bookingConfig.includes('["service", "addons", "datetime", "employee", "details", "summary"]'), true);
  assert.equal(bookingFlow.includes("getAvailableSlotsForEmployees"), true);
  assert.equal(bookingFlow.includes("selectableEmployees"), true);
  assert.equal(availabilityCalendar.includes("remainingSpot"), true);
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
