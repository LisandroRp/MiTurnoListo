import type { Messages } from "../../scheduling/i18n/messages";

export function getProfessionalLabel(count: number, messages: Messages) {
  return count === 1 ? messages.services.professionalColumn : messages.services.professionalsColumn;
}

export function getServiceTitleOverflowClass(name: string) {
  return /[ \t\n\r]/.test(name.trim()) ? "line-clamp-2" : "truncate";
}

export function getCatalogDescription(description: string) {
  return description.trim();
}
