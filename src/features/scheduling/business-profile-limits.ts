export const businessProfileTextLimits = {
  publicDescription: 333,
  publicOpeningHours: 200,
  address: 100
} as const;

export function hasInvalidBusinessProfileText(profile: {
  publicDescription?: unknown;
  publicOpeningHours?: unknown;
  address?: unknown;
}) {
  return Object.entries(businessProfileTextLimits).some(([field, limit]) => {
    const value = profile[field as keyof typeof businessProfileTextLimits];
    return value !== undefined && (typeof value !== "string" || value.length > limit);
  });
}
