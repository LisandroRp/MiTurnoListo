"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export const setupCreationQuery = "setup";
export const setupCreationValue = "create";

export function useSetupCreation() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const startsInCreateMode = searchParams.get(setupCreationQuery) === setupCreationValue;

  function leaveSetupCreation() {
    if (!startsInCreateMode) return;

    const params = new URLSearchParams(searchParams.toString());
    params.delete(setupCreationQuery);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return { startsInCreateMode, leaveSetupCreation };
}
