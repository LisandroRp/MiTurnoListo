import assert from "node:assert/strict";
import test from "node:test";

import { getAvailableSlotsForEmployee, getAvailableSlotsForEmployees } from "./booking.ts";

function createService(overrides = {}) {
  return {
    id: "service-1",
    name: "Consultation",
    description: "",
    price: 100,
    capacity: 1,
    deposit: 0,
    durationMinutes: 30,
    paymentMethod: "cash",
    isVisible: true,
    isArchived: false,
    reservationLeadMinutes: 0,
    cancellationLeadMinutes: 1440,
    schedule: createSchedule({ monday: [{ id: "service-monday-1", start: "09:00", end: "10:00" }] }),
    employeeIds: ["employee-1"],
    addons: [],
    ...overrides
  };
}

function createEmployee() {
  return {
    id: "employee-1",
    name: "Jane Doe",
    role: "Professional",
    description: "",
    imageUrl: "",
    color: "employee-coral",
    initials: "JD",
    isVisible: true,
    isArchived: false,
    schedule: createSchedule({ monday: [{ id: "employee-monday-1", start: "09:00", end: "10:00" }] })
  };
}

function createSchedule(overrides = {}) {
  return {
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
    sunday: [],
    ...overrides
  };
}

test("getAvailableSlotsForEmployee splits ranges when service duration is defined", () => {
  const slots = getAvailableSlotsForEmployee(
    createService({ durationMinutes: 30 }),
    createEmployee(),
    [],
    new Date("2026-08-03T12:00:00"),
    1,
    new Date("2026-08-01T12:00:00")
  );

  assert.deepEqual(slots.filter((slot) => slot.date === "2026-08-03").map((slot) => `${slot.startTime}-${slot.endTime}`), [
    "09:00-09:30",
    "09:30-10:00"
  ]);
});

test("getAvailableSlotsForEmployees combines capacity across available professionals", () => {
  const firstEmployee = createEmployee();
  const secondEmployee = {
    ...createEmployee(),
    id: "employee-2",
    name: "John Doe",
    initials: "JD"
  };
  const slots = getAvailableSlotsForEmployees(
    createService({ capacity: 2, employeeIds: ["employee-1", "employee-2"] }),
    [firstEmployee, secondEmployee],
    [{
      id: "appointment-1",
      customerName: "",
      customerEmail: "",
      customerPhone: "",
      serviceId: "service-1",
      employeeId: "employee-1",
      date: "2026-08-03",
      startTime: "09:00",
      endTime: "09:30",
      status: "confirmed",
      appointmentStatus: "scheduled",
      paymentStatus: "paid",
      source: "dashboard",
      revenue: 100,
      paymentMethod: "cash",
      partySize: 1
    }],
    new Date("2026-08-03T12:00:00"),
    1,
    new Date("2026-08-01T12:00:00")
  );
  const firstSlot = slots.find((slot) => slot.date === "2026-08-03" && slot.startTime === "09:00");

  assert.equal(firstSlot?.remainingCapacity, 3);
  assert.deepEqual(firstSlot?.employeeAvailability, [
    {
      employeeId: "employee-1",
      remainingCapacity: 1
    },
    {
      employeeId: "employee-2",
      remainingCapacity: 2
    }
  ]);
});

test("getAvailableSlotsForEmployees blocks a professional with overlapping appointments from another service", () => {
  const firstEmployee = createEmployee();
  const secondEmployee = {
    ...createEmployee(),
    id: "employee-2",
    name: "John Doe",
    initials: "JD"
  };
  const slots = getAvailableSlotsForEmployees(
    createService({ capacity: 2, employeeIds: ["employee-1", "employee-2"] }),
    [firstEmployee, secondEmployee],
    [{
      id: "appointment-1",
      customerName: "",
      customerEmail: "",
      customerPhone: "",
      serviceId: "other-service",
      employeeId: "employee-1",
      date: "2026-08-03",
      startTime: "09:00",
      endTime: "09:30",
      status: "confirmed",
      appointmentStatus: "scheduled",
      paymentStatus: "paid",
      source: "dashboard",
      revenue: 100,
      paymentMethod: "cash",
      partySize: 1
    }],
    new Date("2026-08-03T12:00:00"),
    1,
    new Date("2026-08-01T12:00:00")
  );
  const firstSlot = slots.find((slot) => slot.date === "2026-08-03" && slot.startTime === "09:00");

  assert.equal(firstSlot?.remainingCapacity, 2);
  assert.deepEqual(firstSlot?.employeeAvailability, [{
    employeeId: "employee-2",
    remainingCapacity: 2
  }]);
});
