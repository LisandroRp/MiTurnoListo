import { getPublicPageMetadata } from "@/lib/networking/public-page-metadata";
import { notFound } from "next/navigation";

import { BookingFlow } from "@/features/booking-flow/components/BookingFlow";
import { isReservedPublicSlug } from "@/lib/slugs";

type BusinessServiceBookingPageProps = {
  params: Promise<{
    businessSlug: string;
    serviceSlug: string;
  }>;
};

export async function generateMetadata({ params }: BusinessServiceBookingPageProps) {
  const { businessSlug, serviceSlug } = await params;
  return getPublicPageMetadata(businessSlug, serviceSlug);
}

export default async function BusinessServiceBookingPage({ params }: BusinessServiceBookingPageProps) {
  const { businessSlug, serviceSlug } = await params;

  if (isReservedPublicSlug(businessSlug)) {
    notFound();
  }

  return <BookingFlow businessKey={businessSlug} serviceId={serviceSlug} />;
}
