"use client";

import { useState } from "react";
import { FiArrowLeft } from "react-icons/fi";

import { SectionHeader } from "@/components/composed/SectionHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { BookingFlow } from "@/features/booking-flow/components/BookingFlow";
import { useScheduling } from "@/features/scheduling/components/SchedulingProvider";
import { formatCurrency } from "@/features/scheduling/utils/format";

export default function NewBookingPreviewPage() {
  const { messages, services } = useScheduling();
  const visibleServices = services.filter((service) => !service.isArchived && service.isVisible);
  const [requestedServiceId, setRequestedServiceId] = useState("");
  const selectedServiceId = visibleServices.some((service) => service.id === requestedServiceId)
    ? requestedServiceId
    : "";

  return (
    <div className="grid gap-6">
      <SectionHeader
        eyebrow={messages.bookingPreview.eyebrow}
        title={messages.bookingPreview.title}
        description={messages.bookingPreview.description}
      />

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
          <Card className="bg-brand-soft">
            <h2 className="text-lg font-bold text-primary">{messages.bookingPreview.selectTitle}</h2>
            <p className="mt-2 text-sm font-semibold text-muted">{messages.bookingPreview.disclaimer}</p>
          </Card>

          {visibleServices.length > 0 ? (
            <section className="grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visibleServices.map((service) => (
                <Card
                  key={service.id}
                  onClick={() => setRequestedServiceId(service.id)}
                  className="flex h-full w-full flex-col overflow-hidden p-0 transition duration-200 hover:-translate-y-1 hover:scale-[1.01] hover:border-brand hover:shadow-lg"
                >
                  <div
                    className="h-36 bg-surface-strong bg-contain bg-center bg-no-repeat"
                    style={{ backgroundImage: service.imageUrl ? `url(${service.imageUrl})` : undefined }}
                  />
                  <div className="flex flex-1 flex-col gap-4 p-5">
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
              <p className="text-sm font-semibold text-muted">{messages.services.empty}</p>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function ServiceFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-input p-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 font-semibold text-primary">{value}</dd>
    </div>
  );
}
