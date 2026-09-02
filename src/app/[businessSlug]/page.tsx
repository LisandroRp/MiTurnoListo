import { PublicServicesCatalog } from "@/features/booking-flow/components/PublicServicesCatalog";

type BusinessCatalogPageProps = {
  params: Promise<{
    businessSlug: string;
  }>;
};

export default async function BusinessCatalogPage({ params }: BusinessCatalogPageProps) {
  const { businessSlug } = await params;

  return <PublicServicesCatalog businessId={businessSlug} />;
}
