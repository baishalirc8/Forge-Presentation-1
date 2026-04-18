import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  startIndex: number;
  endIndex: number;
  onPageChange: (page: number) => void;
  noun?: string;
}

export function PaginationControls({
  currentPage,
  totalPages,
  totalItems,
  startIndex,
  endIndex,
  onPageChange,
  noun = "items",
}: PaginationControlsProps) {
  if (totalPages <= 1) return null;

  const pages = getPageNumbers(currentPage, totalPages);

  return (
    <div className="flex items-center justify-between pt-3 border-t border-border/40" data-testid="pagination-controls">
      <p className="text-sm text-muted-foreground">
        {startIndex}–{endIndex} of {totalItems} {noun}
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          data-testid="pagination-prev"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        {pages.map((p, i) =>
          p === "..." ? (
            <span key={`ellipsis-${i}`} className="px-1 text-sm text-muted-foreground">…</span>
          ) : (
            <Button
              key={p}
              variant={p === currentPage ? "default" : "ghost"}
              size="icon"
              className="h-7 w-7 text-sm"
              onClick={() => onPageChange(p as number)}
              data-testid={`pagination-page-${p}`}
            >
              {p}
            </Button>
          )
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          data-testid="pagination-next"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function getPageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: (number | "...")[] = [1];

  if (current > 3) pages.push("...");

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  for (let i = start; i <= end; i++) pages.push(i);

  if (current < total - 2) pages.push("...");

  pages.push(total);

  return pages;
}
