import { cx } from "@/components/ui/utils";
import { employeeColorClasses } from "@/features/scheduling/components/employeeColors";
import { Employee } from "@/features/scheduling/types";

export function EmployeeAvatar({ employee, size = "default" }: { employee: Employee; size?: "default" | "review" }) {
  return (
    <span
      className={cx(
        "grid shrink-0 place-items-center overflow-hidden rounded-full font-bold text-on-brand",
        size === "review" ? "h-24 w-24 text-3xl sm:h-32 sm:w-32 sm:text-4xl" : "h-12 w-12 text-sm",
        employee.imageUrl ? "bg-surface-strong bg-cover bg-center bg-no-repeat" : employeeColorClasses[employee.color]
      )}
      style={{ backgroundImage: employee.imageUrl ? `url(${employee.imageUrl})` : undefined }}
    >
      {employee.imageUrl ? null : employee.initials}
    </span>
  );
}
