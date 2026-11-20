export const serviceNumericLimits = {
  price: 10_000_000,
  deposit: 5_000_000,
  durationMinutes: 300
} as const;

type LimitedServiceNumbers = { price: number; deposit: number; durationMinutes: number };

export function hasValidServiceNumericLimits(service: LimitedServiceNumbers) {
  return Number.isInteger(service.price) && service.price > 0 && service.price <= serviceNumericLimits.price &&
    Number.isInteger(service.deposit) && service.deposit >= 0 && service.deposit <= serviceNumericLimits.deposit && service.deposit <= service.price &&
    Number.isInteger(service.durationMinutes) && service.durationMinutes > 0 && service.durationMinutes <= serviceNumericLimits.durationMinutes;
}

export function capServiceNumericInput(field: string, value: number) {
  const maximum = Object.hasOwn(serviceNumericLimits, field) ? serviceNumericLimits[field as keyof typeof serviceNumericLimits] : undefined;
  return maximum === undefined ? value : Math.min(value, maximum);
}
