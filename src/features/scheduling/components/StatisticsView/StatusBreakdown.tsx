import { Badge } from "@/components/ui/Badge";
import { cx } from "@/components/ui/utils";

export type StatisticsStatusRow = {
  id: string;
  label: string;
  value: number;
  percentage: number;
  tone: "success" | "warning" | "danger" | "neutral" | "info";
};

const barClasses: Record<StatisticsStatusRow["tone"], string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  neutral: "bg-muted",
  info: "bg-employee-blue"
};

export function StatusBreakdown({ rows, isExpanded }: { rows: StatisticsStatusRow[]; isExpanded: boolean }) {
  return (
    <div className={cx("grid gap-4", isExpanded && "xl:grid-cols-2")}>
      {rows.map((row) => (
        <div key={row.id} className="rounded-xl border border-subtle bg-input p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="font-semibold text-primary">{row.label}</span>
            <Badge tone={row.tone}>{row.value}</Badge>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-strong">
            <div className={cx("h-full rounded-full transition-all", barClasses[row.tone])} style={{ width: `${row.percentage}%` }} />
          </div>
          <p className="mt-2 text-sm text-muted">{Math.round(row.percentage)}%</p>
        </div>
      ))}
    </div>
  );
}
