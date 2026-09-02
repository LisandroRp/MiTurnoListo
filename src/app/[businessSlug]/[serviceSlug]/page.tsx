import { notFound } from "next/navigation";

import { BookingFlow } from "@/features/booking-flow/components/BookingFlow";
import { isReservedPublicSlug } from "@/lib/slugs";

type BusinessServiceBookingPageProps = {
  params: Promise<{
    businessSlug: string;
    serviceSlug: string;
  }>;
};

export default async function BusinessServiceBookingPage({ params }: BusinessServiceBookingPageProps) {
  const { businessSlug, serviceSlug } = await params;

  if (isReservedPublicSlug(businessSlug)) {
    notFound();
  }

  return <BookingFlow businessKey={businessSlug} serviceId={serviceSlug} />;
}
