import { VerticalLanding } from "@/features/landing/components/VerticalLanding";
import { buildVerticalMetadata } from "@/features/landing/vertical-metadata";
import { verticalLandingConfigs } from "@/features/landing/verticals";

const config = verticalLandingConfigs.estetica;

export const metadata = buildVerticalMetadata(config);

export default function EsteticaPage() {
  return <VerticalLanding config={config} />;
}
