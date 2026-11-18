import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import type { Material, MaterialsResponse, SortColumn } from "~/lib/api";
import { useUpdateParams } from "~/lib/use-update-params";
import { cn } from "~/lib/utils";

const currency = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" });
const quantity = new Intl.NumberFormat("en-AU");
const date = new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" });

// Also used by the Status filter, so the filter matches the badges in the table.
export const STATUS_STYLES: Record<Material["status"], string> = {
  Active: "border-green-200 bg-green-50 text-green-700",
  Obsolete: "border-neutral-200 bg-neutral-100 text-neutral-600",
  "Pending Review": "border-amber-200 bg-amber-50 text-amber-700",
};

const COLUMN_COUNT = 9;

type Props = {
  materials: Material[];
  query: MaterialsResponse["query"];
  isLoading: boolean;
  onClearFilters: () => void;
};

export function MaterialsTable({ materials, query, isLoading, onClearFilters }: Props) {
  return (
    <div className={cn("bg-card rounded-lg border shadow-sm transition-opacity", isLoading && "opacity-60")}>
      <Table>
        <TableHeader className="bg-muted/70">
          <TableRow>
            <SortableHead column="materialNumber" label="Material" query={query} />
            <SortableHead column="description" label="Description" query={query} />
            <TableHead>Type</TableHead>
            <TableHead>Manufacturer / MPN</TableHead>
            <TableHead>Plant</TableHead>
            <TableHead>Status</TableHead>
            <SortableHead column="unitPrice" label="Unit price" query={query} className="text-right" />
            <SortableHead column="quantityOnHand" label="On hand" query={query} className="text-right" />
            <SortableHead column="updatedAt" label="Last updated" query={query} />
          </TableRow>
        </TableHeader>
        <TableBody>
          {materials.length === 0 ? (
            <TableRow>
              <TableCell colSpan={COLUMN_COUNT} className="h-40 text-center">
                <p className="font-medium">No materials found</p>
                <p className="text-muted-foreground mb-3 text-sm">Try a different search or remove some filters.</p>
                <Button variant="outline" size="sm" onClick={onClearFilters}>
                  Clear filters
                </Button>
              </TableCell>
            </TableRow>
          ) : (
            materials.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-mono text-xs">{m.materialNumber}</TableCell>
                <TableCell className="max-w-80 truncate" title={m.description}>
                  {m.description}
                </TableCell>
                <TableCell>{m.materialType}</TableCell>
                <TableCell>
                  <div>{m.manufacturer}</div>
                  <div className="text-muted-foreground font-mono text-xs">{m.manufacturerPartNumber}</div>
                </TableCell>
                <TableCell>
                  {m.plant.code} · {m.plant.name}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={STATUS_STYLES[m.status]}>
                    {m.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">{currency.format(Number(m.unitPrice))}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {quantity.format(m.quantityOnHand)} <span className="text-muted-foreground text-xs">{m.unitOfMeasure}</span>
                </TableCell>
                <TableCell className="text-muted-foreground">{date.format(new Date(m.updatedAt))}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

type SortableHeadProps = {
  column: SortColumn;
  label: string;
  query: MaterialsResponse["query"];
  className?: string;
};

// Clicking the active column flips the direction; clicking another column sorts it ascending.
function SortableHead({ column, label, query, className }: SortableHeadProps) {
  const updateParams = useUpdateParams();
  const isActive = query.sort === column;
  const Icon = !isActive ? ArrowUpDown : query.order === "asc" ? ArrowUp : ArrowDown;

  return (
    <TableHead
      className={className}
      aria-sort={isActive ? (query.order === "asc" ? "ascending" : "descending") : "none"}
    >
      <Button
        variant="ghost"
        size="sm"
        className="-mx-2"
        onClick={() =>
          updateParams({ sort: column, order: isActive && query.order === "asc" ? "desc" : "asc" })
        }
      >
        {label}
        <Icon className={cn(!isActive && "text-muted-foreground/50")} />
      </Button>
    </TableHead>
  );
}

export function MaterialsTableSkeleton() {
  return (
    <div className="bg-card space-y-2 rounded-lg border p-4 shadow-sm">
      {Array.from({ length: 10 }, (_, i) => (
        <Skeleton key={i} className="h-8" />
      ))}
    </div>
  );
}
