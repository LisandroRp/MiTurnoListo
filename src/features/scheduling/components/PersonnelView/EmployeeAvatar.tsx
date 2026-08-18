import { cx } from "@/components/ui/utils";
import { employeeColorClasses } from "@/features/scheduling/components/employeeColors";
import { Employee } from "@/features/scheduling/types";

export function EmployeeAvatar({ employee }: { employee: Employee }) {
  return (
    <span
      className={cx(
        "grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full text-sm font-bold text-on-brand",
        employee.imageUrl ? "bg-surface-strong bg-contain bg-center bg-no-repeat" : employeeColorClasses[employee.color]
      )}
      style={{ backgroundImage: employee.imageUrl ? `url(${employee.imageUrl})` : undefined }}
    >
      {employee.imageUrl ? null : employee.initials}
    </span>
  );
}
