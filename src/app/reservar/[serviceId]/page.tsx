import { BookingFlow } from "@/features/booking-flow/components/BookingFlow";

type BookingPageProps = {
  params: Promise<{
    serviceId: string;
  }>;
};

export default async function BookingPage({ params }: BookingPageProps) {
  const { serviceId } = await params;

  return <BookingFlow serviceId={serviceId} />;
}
