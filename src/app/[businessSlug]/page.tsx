import { notFound } from "next/navigation";

import { PublicServicesCatalog } from "@/features/booking-flow/components/PublicServicesCatalog";
import { isReservedPublicSlug } from "@/lib/slugs";

type BusinessCatalogPageProps = {
  params: Promise<{
    businessSlug: string;
  }>;
};

export default async function BusinessCatalogPage({ params }: BusinessCatalogPageProps) {
  const { businessSlug } = await params;

  if (isReservedPublicSlug(businessSlug)) {
    notFound();
  }

  return <PublicServicesCatalog businessId={businessSlug} />;
}
