export function getBrowserTimeZone() {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return timeZone || "UTC";
}

export function buildIsoInTimeZone(date: string, time: string, timeZone: string) {
  const { day, hours, minutes, month, year } = parseDateAndTime(date, time);
  const utcGuess = Date.UTC(year, month - 1, day, hours, minutes, 0);
  let offsetMilliseconds = getTimeZoneOffsetMilliseconds(new Date(utcGuess), timeZone);
  let zonedDate = new Date(utcGuess - offsetMilliseconds);
  const adjustedOffsetMilliseconds = getTimeZoneOffsetMilliseconds(zonedDate, timeZone);

  if (adjustedOffsetMilliseconds !== offsetMilliseconds) {
    offsetMilliseconds = adjustedOffsetMilliseconds;
    zonedDate = new Date(utcGuess - offsetMilliseconds);
  }

  return zonedDate.toISOString();
}

export function formatDateForTimeZone(dateTime: string, timeZone: string) {
  return formatDateParts(new Date(dateTime), timeZone);
}

export function formatTodayForTimeZone(timeZone: string) {
  return formatDateParts(new Date(), timeZone);
}

export function formatTimeForTimeZone(dateTime: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(new Date(dateTime));

  const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";

  return `${hour}:${minute}`;
}

function parseDateAndTime(date: string, time: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);

  if ([year, month, day, hours, minutes].some((value) => Number.isNaN(value))) {
    throw new Error("Invalid date or time.");
  }

  return { day, hours, minutes, month, year };
}

function getTimeZoneOffsetMilliseconds(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  });
  const parts = formatter.formatToParts(date).reduce<Record<string, string>>((accumulator, part) => {
    if (part.type !== "literal") {
      accumulator[part.type] = part.value;
    }

    return accumulator;
  }, {});
  const zonedTimestamp = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );

  return zonedTimestamp - date.getTime();
}

function formatDateParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";

  return `${year}-${month}-${day}`;
}
