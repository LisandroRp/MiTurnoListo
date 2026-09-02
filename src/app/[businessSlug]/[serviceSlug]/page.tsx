import { BookingFlow } from "@/features/booking-flow/components/BookingFlow";

type BusinessServiceBookingPageProps = {
  params: Promise<{
    businessSlug: string;
    serviceSlug: string;
  }>;
};

export default async function BusinessServiceBookingPage({ params }: BusinessServiceBookingPageProps) {
  const { businessSlug, serviceSlug } = await params;

  return <BookingFlow businessKey={businessSlug} serviceId={serviceSlug} />;
}
