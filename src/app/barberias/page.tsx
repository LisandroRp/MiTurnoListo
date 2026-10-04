import { VerticalLanding } from "@/features/landing/components/VerticalLanding";
import { buildVerticalMetadata } from "@/features/landing/vertical-metadata";
import { verticalLandingConfigs } from "@/features/landing/verticals";

const config = verticalLandingConfigs.barberias;

export const metadata = buildVerticalMetadata(config);

export default function BarberiasPage() {
  return <VerticalLanding config={config} />;
}
