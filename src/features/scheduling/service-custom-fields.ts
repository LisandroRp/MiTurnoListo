import type { AppointmentCustomFieldResponse, ServiceCustomField } from "./types";

export const maxServiceCustomFields = 3;

export function normalizeServiceCustomFields(customFields: ServiceCustomField[] | undefined) {
  return (customFields ?? [])
    .map((field) => ({
      id: field.id,
      isRequired: field.isRequired,
      label: field.label.trim()
    }))
    .filter((field) => field.label)
    .slice(0, maxServiceCustomFields)
    .map((field, index) => ({
      ...field,
      id: field.id || `custom-field-${index}`,
      sortOrder: index
    }));
}

export function hasValidServiceCustomFields(customFields: ServiceCustomField[] | undefined) {
  const configuredFields = (customFields ?? []).filter((field) => field.label.trim());

  return configuredFields.length === (customFields ?? []).length && configuredFields.length <= maxServiceCustomFields;
}

export function buildCustomFieldResponses(
  customFields: ServiceCustomField[] | undefined,
  responses: Record<string, string>
): AppointmentCustomFieldResponse[] {
  return normalizeServiceCustomFields(customFields).map((field) => ({
    ...field,
    value: responses[field.id]?.trim() ?? ""
  }));
}

export function mapCustomFieldResponsesById(responses: AppointmentCustomFieldResponse[] | undefined) {
  return Object.fromEntries((responses ?? []).map((response) => [response.id, response.value]));
}
