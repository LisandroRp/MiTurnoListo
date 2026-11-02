export const serviceDescriptionMaxLength = 333;

export function isValidServiceDescription(value: unknown): value is string {
  return typeof value === "string" && value.length <= serviceDescriptionMaxLength;
}
