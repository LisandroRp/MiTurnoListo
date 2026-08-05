const blockedLegacyImageMarkers = ["images.unsplash.com"];

export function normalizeStoredImageUrl(value: string | null | undefined) {
  const trimmedValue = value?.trim() ?? "";

  if (!trimmedValue) {
    return "";
  }

  if (trimmedValue.toLowerCase().startsWith("data:image/")) {
    return "";
  }

  if (blockedLegacyImageMarkers.some((marker) => trimmedValue.includes(marker))) {
    return "";
  }

  return trimmedValue;
}
