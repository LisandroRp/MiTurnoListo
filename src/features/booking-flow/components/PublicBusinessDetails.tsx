import Link from "next/link";
import { FiClock, FiMapPin } from "react-icons/fi";

import { FormattedText } from "@/components/ui/FormattedText";

type PublicBusinessDetailsProps = {
  businessName: string;
  catalogHref?: string;
  address?: string;
  description?: string;
  logoUrl?: string;
  openingHours?: string;
};

export function PublicBusinessDetails({
  businessName,
  catalogHref,
  address,
  description,
  logoUrl,
  openingHours
}: PublicBusinessDetailsProps) {
  const identity = (
    logoUrl ? (
        // Native dimensions preserve the aspect ratio of arbitrary public business logos.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="mx-auto block h-auto max-h-36 w-auto max-w-full object-contain sm:max-h-44"
          src={logoUrl}
          alt={businessName}
        />
      ) : (
        <h1 className="text-4xl font-bold text-primary">{businessName}</h1>
      )
  );
  return (
    <div className="mx-auto w-full max-w-3xl text-center">
      {catalogHref ? (
        <Link href={catalogHref} className="mx-auto block w-fit max-w-full rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-focus" aria-label={businessName}>
          {identity}
        </Link>
      ) : identity}
      {description?.trim() ? (
        <FormattedText className="mx-auto mt-3 w-full max-w-3xl text-sm leading-6 text-muted" value={description} align="center" />
      ) : null}
      {address?.trim() || openingHours?.trim() ? (
        <div className="mt-2 grid gap-1 text-xs leading-5 text-muted">
          {address?.trim() ? (
            <div className="flex items-start justify-center gap-1.5">
              <FiMapPin className="mt-1 shrink-0 text-brand-strong" aria-hidden="true" />
              <span className="min-w-0 whitespace-pre-line break-words">{address}</span>
            </div>
          ) : null}
          {openingHours?.trim() ? (
            <div className="flex items-start justify-center gap-1.5">
              <FiClock className="mt-1 shrink-0 text-brand-strong" aria-hidden="true" />
              <span className="min-w-0 whitespace-pre-line break-words">{openingHours}</span>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
