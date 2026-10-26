import Link from "next/link";
import { ComponentProps } from "react";

import { BrandMark } from "@/components/composed/BrandMark";
import { PublicBusinessDetails } from "@/features/booking-flow/components/PublicBusinessDetails";

export function PublicBusinessHeader(props: ComponentProps<typeof PublicBusinessDetails>) {
  return (
    <header className="relative grid justify-items-center gap-4 pt-8 text-center md:pt-0">
      <Link href="/" className="absolute left-0 top-0 hidden md:block" aria-label="Ir al inicio">
        <BrandMark variant="full" size="md" />
      </Link>
      <Link href="/" className="absolute left-0 top-0 md:hidden" aria-label="Ir al inicio">
        <BrandMark variant="compact" size="md" />
      </Link>
      <PublicBusinessDetails {...props} />
    </header>
  );
}
