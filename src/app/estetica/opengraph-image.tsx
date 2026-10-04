import { renderVerticalOpenGraphImage, verticalOpenGraphImageSize } from "@/features/landing/vertical-og";
import { verticalLandingConfigs } from "@/features/landing/verticals";

export const size = verticalOpenGraphImageSize;
export const contentType = "image/png";

export default function Image() {
  return renderVerticalOpenGraphImage(verticalLandingConfigs.estetica);
}
