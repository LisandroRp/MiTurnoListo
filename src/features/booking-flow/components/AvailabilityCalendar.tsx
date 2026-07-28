"use client";

import { useEffect, useState } from "react";
import { FiChevronLeft, FiChevronRight, FiClock, FiX } from "react-icons/fi";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cx } from "@/components/ui/utils";
import { BookingSlot } from "@/features/booking-flow/types";
import { formatLongDate, formatMonthLabel, getMonthGrid, toDateKey } from "@/features/booking-flow/utils/booking";
import { Messages } from "@/features/scheduling/i18n/messages";

type AvailabilityCalendarProps = {
  messages: Messages;
  locale: string;
  monthDate: Date;
  slots: BookingSlot[];
  selectedDate: string | null;
  selectedStartTime: string | null;
  onMonthChange: (date: Date) => void;
  onSelectDate: (date: string) => void;
  onSelectSlot: (slot: BookingSlot) => void;
  showDesktopHours?: boolean;
};

const weekdayLabels = ["L", "M", "X", "J", "V", "S", "D"];
const weekdayLabelsEn = ["M", "T", "W", "T", "F", "S", "S"];

export function AvailabilityCalendar({
  messages,
  locale,
  monthDate,
  slots,
  selectedDate,
  selectedStartTime,
  onMonthChange,
  onSelectDate,
  onSelectSlot,
  showDesktopHours = true
}: AvailabilityCalendarProps) {
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);
  const monthGrid = getMonthGrid(monthDate);
  const copy = messages.bookingFlow;
  const slotsByDate = slots.reduce<Record<string, BookingSlot[]>>((accumulator, slot) => {
    accumulator[slot.date] = [...(accumulator[slot.date] ?? []), slot];
    return accumulator;
  }, {});
  const visibleWeekdays = locale.startsWith("es") ? weekdayLabels : weekdayLabelsEn;
  const selectedDaySlots = selectedDate ? (slotsByDate[selectedDate] ?? []) : [];

  function handleSelectDay(date: string) {
    if (!(slotsByDate[date]?.length)) {
      return;
    }

    onSelectDate(date);

    if (window.innerWidth < 1024) {
      setIsMobileSheetOpen(true);
    }
  }

  function handleSelectSlot(slot: BookingSlot) {
    onSelectSlot(slot);
    setIsMobileSheetOpen(false);
  }

  useEffect(() => {
    if (!isMobileSheetOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileSheetOpen]);

  return (
    <div className="grid gap-4">
      <Card className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <Button
            size="icon"
            variant="ghost"
            aria-label={copy.previousMonth}
            onClick={() => onMonthChange(new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1))}
          >
            <FiChevronLeft />
          </Button>
          <h3 className="text-lg font-bold capitalize text-primary">{formatMonthLabel(monthDate, locale)}</h3>
          <Button
            size="icon"
            variant="ghost"
            aria-label={copy.nextMonth}
            onClick={() => onMonthChange(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1))}
          >
            <FiChevronRight />
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-2 text-center">
          {visibleWeekdays.map((label) => (
            <span key={label} className="text-xs font-semibold uppercase text-muted">
              {label}
            </span>
          ))}

          {monthGrid.map((date) => {
            const dateKey = toDateKey(date);
            const isInMonth = date.getMonth() === monthDate.getMonth();
            const daySlots = slotsByDate[dateKey] ?? [];
            const isActive = daySlots.length > 0;
            const isSelected = selectedDate === dateKey;

            return (
              <button
                key={dateKey}
                type="button"
                disabled={!isActive}
                onClick={() => handleSelectDay(dateKey)}
                className={cx(
                  "grid aspect-square cursor-pointer place-items-center rounded-2xl border text-sm font-semibold transition-all",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
                  !isInMonth && "opacity-30",
                  isActive
                    ? "border-brand bg-brand-soft text-brand-strong hover:-translate-y-0.5 hover:shadow-sm"
                    : "cursor-not-allowed border-subtle bg-input text-placeholder",
                  isSelected && "border-brand bg-brand text-on-brand"
                )}
              >
                <span>{date.getDate()}</span>
              </button>
            );
          })}
        </div>

        {!selectedDate ? (
          <p className="mt-4 text-sm text-muted">{copy.selectDay}</p>
        ) : null}
      </Card>

      <div className={cx("hidden lg:block", (!showDesktopHours || isMobileSheetOpen) && "lg:hidden")}>
        <AvailabilityHourList
          messages={messages}
          locale={locale}
          selectedDate={selectedDate}
          slots={selectedDaySlots}
          selectedStartTime={selectedStartTime}
          onSelectSlot={handleSelectSlot}
        />
      </div>

      {isMobileSheetOpen && selectedDate ? (
        <div className="p-safe fixed inset-0 z-50 grid overscroll-contain bg-primary/35 lg:hidden">
          <div className="pb-safe mt-auto max-h-[85dvh] overflow-y-auto overscroll-contain rounded-[28px] bg-sidebar px-5 pt-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-lg font-bold text-primary">{formatLongDate(selectedDate, locale)}</h3>
              <Button size="icon" variant="ghost" aria-label="Close schedule" onClick={() => setIsMobileSheetOpen(false)}>
                <FiX />
              </Button>
            </div>
            <AvailabilityHourList
              messages={messages}
              locale={locale}
              selectedDate={selectedDate}
              slots={selectedDaySlots}
              selectedStartTime={selectedStartTime}
              onSelectSlot={handleSelectSlot}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function AvailabilityHourList({
  messages,
  locale,
  selectedDate,
  slots,
  selectedStartTime,
  onSelectSlot
}: {
  messages: Messages;
  locale: string;
  selectedDate: string | null;
  slots: BookingSlot[];
  selectedStartTime: string | null;
  onSelectSlot: (slot: BookingSlot) => void;
}) {
  const copy = messages.bookingFlow;

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center gap-2 text-brand-strong">
        <FiClock aria-hidden="true" />
        <h3 className="text-lg font-bold text-primary">
          {selectedDate ? formatLongDate(selectedDate, locale) : copy.availableHours}
        </h3>
      </div>

      {slots.length === 0 ? (
        <p className="mt-4 text-sm text-muted">
          {selectedDate ? copy.noHoursAvailable : copy.selectDay}
        </p>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {slots.map((slot) => {
            const isSelected = selectedStartTime === slot.startTime;

            return (
              <button
                key={`${slot.date}-${slot.startTime}`}
                type="button"
                onClick={() => onSelectSlot(slot)}
                className={cx(
                  "cursor-pointer rounded-2xl border p-4 text-left transition-all",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
                  isSelected
                    ? "border-brand bg-brand text-on-brand shadow-sm"
                    : "border-subtle bg-input text-primary hover:-translate-y-0.5 hover:shadow-sm"
                )}
              >
                <p className="text-base font-bold">{slot.startTime}</p>
                <p className={cx("mt-1 text-sm", isSelected ? "text-on-brand/85" : "text-muted")}>
                  {slot.endTime}
                </p>
                <p className={cx("mt-3 text-xs font-semibold uppercase", isSelected ? "text-on-brand/85" : "text-brand-strong")}>
                  {slot.remainingCapacity} {copy.remainingSpots}
                </p>
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );
}
