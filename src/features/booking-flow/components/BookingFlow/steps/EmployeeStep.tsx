import { cx } from "@/components/ui/utils";
import { BookingSlot } from "@/features/booking-flow/types";
import { employeeColorClasses } from "@/features/scheduling/components/employeeColors";
import { Messages } from "@/features/scheduling/i18n/messages";
import { Employee } from "@/features/scheduling/types";

export function EmployeeStep({
  messages,
  employees,
  selectedSlot,
  showRemainingCapacity,
  selectedEmployeeId,
  onSelectEmployee
}: {
  messages: Messages;
  employees: Employee[];
  selectedSlot: BookingSlot | null;
  showRemainingCapacity: boolean;
  selectedEmployeeId: string | null;
  onSelectEmployee: (employeeId: string) => void;
}) {
  return (
    <div className="grid gap-4">
      {employees.length > 0 ? (
        <div className="grid items-start gap-4 md:grid-cols-2 lg:max-h-[calc(100vh-22rem)] lg:grid-cols-1 lg:auto-rows-max lg:overflow-y-auto lg:pr-2 lg:py-3.5">
          {employees.map((employee) => {
            const remainingCapacity = selectedSlot?.employeeAvailability.find((availability) => availability.employeeId === employee.id)?.remainingCapacity ?? 0;

            return (
              <button
                key={employee.id}
                type="button"
                onClick={() => onSelectEmployee(employee.id)}
                className={cx(
                  "h-fit w-full cursor-pointer rounded-3xl border bg-sidebar p-5 text-left transition-all",
                  "hover:-translate-y-1 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
                  selectedEmployeeId === employee.id ? "border-2 border-brand !bg-brand-soft" : "border-subtle"
                )}
              >
                <div className="flex items-center gap-3">
                  <span className={cx("h-4 w-4 rounded-full", employeeColorClasses[employee.color])} />
                  <div>
                    <h3 className="text-lg font-bold text-primary">{employee.name}</h3>
                    <p className="text-sm text-muted">{employee.role}</p>
                  </div>
                </div>
                {showRemainingCapacity ? (
                  <p className="mt-3 text-xs font-bold uppercase text-brand-strong">
                    {formatRemainingCapacity(remainingCapacity, messages)}
                  </p>
                ) : null}
                <p className="mt-4 text-sm leading-6 text-muted">{employee.description}</p>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="rounded-3xl border border-subtle bg-sidebar p-6 text-center">
          <p className="text-base font-bold text-primary">{messages.bookingFlow.noEmployeesAvailable}</p>
          <p className="mt-2 text-sm leading-6 text-muted">{messages.bookingFlow.chooseEmployeeHint}</p>
        </div>
      )}
    </div>
  );
}

function formatRemainingCapacity(remainingCapacity: number, messages: Messages) {
  return remainingCapacity === 1
    ? messages.bookingFlow.remainingSpot
    : `${remainingCapacity} ${messages.bookingFlow.remainingSpots}`;
}
