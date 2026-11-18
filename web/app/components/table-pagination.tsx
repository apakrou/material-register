import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "~/components/ui/button";
import type { MaterialsResponse } from "~/lib/api";
import { useUpdateParams } from "~/lib/use-update-params";

type Props = { total: number; pageCount: number; query: MaterialsResponse["query"] };

export function TablePagination({ total, pageCount, query }: Props) {
  const updateParams = useUpdateParams();
  const { page, pageSize } = query;
  const goTo = (p: number) => updateParams({ page: p > 1 ? String(p) : null });

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <p className="text-muted-foreground">
        {total === 0 ? "No results" : `Showing ${from.toLocaleString()}–${to.toLocaleString()} of ${total.toLocaleString()}`}
      </p>
      <div className="flex items-center gap-1">
        <span className="text-muted-foreground mr-2">
          Page {page} of {Math.max(pageCount, 1)}
        </span>
        <Button variant="outline" size="icon" aria-label="First page" disabled={page <= 1} onClick={() => goTo(1)}>
          <ChevronsLeft />
        </Button>
        <Button variant="outline" size="icon" aria-label="Previous page" disabled={page <= 1} onClick={() => goTo(page - 1)}>
          <ChevronLeft />
        </Button>
        <Button variant="outline" size="icon" aria-label="Next page" disabled={page >= pageCount} onClick={() => goTo(page + 1)}>
          <ChevronRight />
        </Button>
        <Button variant="outline" size="icon" aria-label="Last page" disabled={page >= pageCount} onClick={() => goTo(pageCount)}>
          <ChevronsRight />
        </Button>
      </div>
    </div>
  );
}
