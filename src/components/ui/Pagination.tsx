import { FiChevronLeft, FiChevronRight } from "react-icons/fi";

import { Button } from "@/components/ui/Button";

type PaginationProps = {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  labels: { summary: string; previous: string; next: string; navigation: string };
};

export function Pagination({ currentPage, totalItems, pageSize, onPageChange, labels }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const page = Math.min(Math.max(1, currentPage), totalPages);
  const end = Math.min(totalPages, Math.max(1, page - 2) + 4);
  const start = Math.max(1, end - 4);
  const pages = Array.from({ length: end - start + 1 }, (_, index) => start + index);
  const summary = labels.summary
    .replace("{from}", String(totalItems === 0 ? 0 : (page - 1) * pageSize + 1))
    .replace("{to}", String(Math.min(page * pageSize, totalItems)))
    .replace("{total}", String(totalItems));

  return (
    <nav aria-label={labels.navigation} className="flex flex-col gap-3 border-t border-subtle px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p aria-live="polite" className="text-sm font-semibold text-muted">{summary}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="icon" variant="secondary" aria-label={labels.previous} disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <FiChevronLeft />
        </Button>
        {pages.map((value) => (
          <Button key={value} size="sm" variant={value === page ? "primary" : "secondary"} aria-current={value === page ? "page" : undefined} onClick={() => onPageChange(value)}>
            {value}
          </Button>
        ))}
        <Button size="icon" variant="secondary" aria-label={labels.next} disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          <FiChevronRight />
        </Button>
      </div>
    </nav>
  );
}
