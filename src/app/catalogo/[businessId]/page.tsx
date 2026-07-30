import { PublicServicesCatalog } from "@/features/booking-flow/components/PublicServicesCatalog";

type CatalogPageProps = {
  params: Promise<{
    businessId: string;
  }>;
};

export default async function CatalogPage({ params }: CatalogPageProps) {
  const { businessId } = await params;

  return <PublicServicesCatalog businessId={businessId} />;
}
