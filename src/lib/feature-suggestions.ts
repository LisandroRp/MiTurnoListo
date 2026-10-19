export const featureSuggestionTitleMaxLength = 120;
export const featureSuggestionDescriptionMaxLength = 2000;
export const featureSuggestionStatuses = ["pending", "done", "rejected"] as const;

export type FeatureSuggestionStatus = typeof featureSuggestionStatuses[number];

export type FeatureSuggestionInput = {
  description: string;
  title: string;
};

export type FeatureSuggestionValidationResult =
  | { input: FeatureSuggestionInput; isValid: true }
  | { isValid: false };

export function validateFeatureSuggestionInput(input: unknown): FeatureSuggestionValidationResult {
  if (!isRecord(input)) {
    return { isValid: false };
  }

  const title = typeof input.title === "string" ? input.title.trim() : "";
  const description = typeof input.description === "string" ? input.description.trim() : "";

  if (
    title.length < 3 ||
    title.length > featureSuggestionTitleMaxLength ||
    description.length < 10 ||
    description.length > featureSuggestionDescriptionMaxLength
  ) {
    return { isValid: false };
  }

  return {
    input: {
      description,
      title
    },
    isValid: true
  };
}

export function isFeatureSuggestionStatus(value: unknown): value is FeatureSuggestionStatus {
  return typeof value === "string" && featureSuggestionStatuses.includes(value as FeatureSuggestionStatus);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
