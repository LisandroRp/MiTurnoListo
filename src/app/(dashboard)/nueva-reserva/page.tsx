"use client";

import { useState } from "react";
import { FiArrowLeft, FiPlusCircle, FiSearch } from "react-icons/fi";

import { SectionHeader } from "@/components/composed/SectionHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { BookingFlow } from "@/features/booking-flow/components/BookingFlow";
import { getAvailableSlotsForEmployees } from "@/features/booking-flow/utils/booking";
import { useScheduling } from "@/features/scheduling/components/SchedulingProvider";
import { WalkInAppointmentModal } from "@/features/scheduling/components/WalkInAppointmentModal";
import { formatCurrency } from "@/features/scheduling/utils/format";

export default function NewBookingPreviewPage() {
  const { appointments, businessDayBlocks, businessId, createAppointment, employees, messages, services } = useScheduling();
  const reservableEmployeeIds = new Set(
    employees.filter((employee) => !employee.isArchived && employee.isVisible).map((employee) => employee.id)
  );
  const visibleServices = services.filter((service) => (
    !service.isArchived &&
    service.isVisible &&
    service.employeeIds.some((employeeId) => reservableEmployeeIds.has(employeeId))
  ));
  const servicesWithAvailableSlots = visibleServices.filter((service) => {
    const assignedEmployees = employees.filter((employee) => (
      !employee.isArchived &&
      employee.isVisible &&
      service.employeeIds.includes(employee.id)
    ));

    return hasAvailableBookingSlots(service, assignedEmployees, appointments, businessDayBlocks);
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [requestedServiceId, setRequestedServiceId] = useState("");
  const [isWalkInModalOpen, setIsWalkInModalOpen] = useState(false);
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredServices = servicesWithAvailableSlots.filter((service) => {
    if (!normalizedSearch) {
      return true;
    }

    return `${service.name} ${service.description}`.toLowerCase().includes(normalizedSearch);
  });
  const selectedServiceId = servicesWithAvailableSlots.some((service) => service.id === requestedServiceId)
    ? requestedServiceId
    : "";

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <SectionHeader
          eyebrow={messages.bookingPreview.eyebrow}
          title={messages.bookingPreview.title}
          description={messages.bookingPreview.description}
        />
        <Button icon={<FiPlusCircle />} onClick={() => setIsWalkInModalOpen(true)}>
          {messages.walkInAppointment.action}
        </Button>
      </div>

      {selectedServiceId ? (
        <div className="grid gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold text-muted">{messages.bookingPreview.disclaimer}</p>
            <Button variant="secondary" icon={<FiArrowLeft />} onClick={() => setRequestedServiceId("")}>
              {messages.bookingPreview.changeService}
            </Button>
          </div>
          <BookingFlow key={selectedServiceId} serviceId={selectedServiceId} mode="preview" />
        </div>
      ) : (
        <div className="grid gap-4">
          <label className="relative block xl:max-w-xl">
            <FiSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
            <span className="sr-only">{messages.services.searchPlaceholder}</span>
            <input
              type="search"
              value={searchTerm}
              placeholder={messages.services.searchPlaceholder}
              className="h-11 w-full rounded-xl border border-subtle bg-input px-4 pl-10 text-sm text-primary shadow-sm outline-none transition placeholder:text-placeholder focus:border-brand focus:ring-2 focus:ring-focus"
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </label>

          {filteredServices.length > 0 ? (
            <section className="grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredServices.map((service) => (
                <Card
                  key={service.id}
                  onClick={() => setRequestedServiceId(service.id)}
                  className="flex h-full w-full flex-col transition duration-200 hover:-translate-y-1 hover:scale-[1.01] hover:border-brand hover:shadow-lg"
                >
                  <div className="flex flex-1 flex-col gap-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-bold text-primary">{service.name}</h2>
                        <p className="mt-1 line-clamp-2 text-sm text-muted">{service.description}</p>
                      </div>
                      <Badge tone="success">{messages.services.visible}</Badge>
                    </div>

                    <dl className="grid grid-cols-2 gap-3 text-sm">
                      <ServiceFact label={messages.services.price} value={formatCurrency(service.price)} />
                      <ServiceFact label={messages.services.duration} value={`${service.durationMinutes} ${messages.services.minutes}`} />
                      <ServiceFact label={messages.services.capacity} value={`${service.capacity} ${messages.services.people}`} />
                      <ServiceFact label={messages.services.deposit} value={formatCurrency(service.deposit)} />
                    </dl>
                  </div>
                </Card>
              ))}
            </section>
          ) : (
            <Card>
              <p className="text-sm font-semibold text-muted">
                {servicesWithAvailableSlots.length > 0 ? messages.services.noResults : messages.bookingPreview.noAvailableSlots}
              </p>
            </Card>
          )}
        </div>
      )}

      <WalkInAppointmentModal
        businessId={businessId}
        employees={employees}
        isOpen={isWalkInModalOpen}
        messages={messages}
        services={services}
        onClose={() => setIsWalkInModalOpen(false)}
        onCreateAppointment={createAppointment}
      />
    </div>
  );
}

function hasAvailableBookingSlots(
  service: Parameters<typeof getAvailableSlotsForEmployees>[0],
  employees: Parameters<typeof getAvailableSlotsForEmployees>[1],
  appointments: Parameters<typeof getAvailableSlotsForEmployees>[2],
  businessDayBlocks: Parameters<typeof getAvailableSlotsForEmployees>[6]
) {
  const now = new Date();
  const monthsToCheck = [0, 1, 2];

  return monthsToCheck.some((monthOffset) => {
    const monthDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);

    return getAvailableSlotsForEmployees(
      service,
      employees,
      appointments,
      monthDate,
      1,
      now,
      businessDayBlocks
    ).length > 0;
  });
}

function ServiceFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-input p-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 font-semibold text-primary">{value}</dd>
    </div>
  );
}
