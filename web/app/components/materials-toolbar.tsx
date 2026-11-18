import { Loader2, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { MATERIAL_STATUSES, MATERIAL_TYPES, type MaterialsResponse, type Plant } from "~/lib/api";
import { useUpdateParams } from "~/lib/use-update-params";

const SEARCH_DEBOUNCE_MS = 300;
const ALL = "all"; // Radix Select can't use "" as a value, so "all" means "no filter"

type Props = {
  query: MaterialsResponse["query"];
  plants: Plant[];
  isLoading: boolean;
  onClearFilters: () => void;
};

export function MaterialsToolbar({ query, plants, isLoading, onClearFilters }: Props) {
  const updateParams = useUpdateParams();
  const urlSearch = query.q ?? "";
  const [search, setSearch] = useState(urlSearch);

  // If the URL changes from somewhere else (Clear button, back/forward), update the input.
  useEffect(() => {
    setSearch((current) => (current.trim() === urlSearch ? current : urlSearch));
  }, [urlSearch]);

  // Debounce: only update the URL (and so fetch) once the user stops typing.
  useEffect(() => {
    if (search.trim() === urlSearch) return;
    const timer = setTimeout(() => {
      // replace: don't add a history entry for every search term
      updateParams({ q: search.trim() || null }, { replace: true });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasFilters = Boolean(query.q || query.type || query.status || query.plant);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full sm:w-80">
        <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        <Input
          type="search"
          placeholder="Search number, description or MPN"
          aria-label="Search materials"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>

      <FilterSelect
        label="Type"
        value={query.type}
        options={MATERIAL_TYPES.map((t) => ({ value: t, label: t }))}
        onChange={(value) => updateParams({ type: value })}
      />
      <FilterSelect
        label="Status"
        value={query.status}
        options={MATERIAL_STATUSES.map((s) => ({ value: s, label: s }))}
        onChange={(value) => updateParams({ status: value })}
      />
      <FilterSelect
        label="Plant"
        value={query.plant}
        options={plants.map((p) => ({ value: p.code, label: `${p.code} · ${p.name}` }))}
        onChange={(value) => updateParams({ plant: value })}
      />

      {hasFilters && (
        <Button
          variant="ghost"
          onClick={() => {
            setSearch(""); // also clears text that hasn't been debounced into the URL yet
            onClearFilters();
          }}
        >
          <X /> Clear
        </Button>
      )}

      {isLoading && <Loader2 className="text-muted-foreground size-4 animate-spin" aria-label="Loading" />}
    </div>
  );
}

type FilterSelectProps = {
  label: string;
  value: string | undefined;
  options: { value: string; label: string }[];
  onChange: (value: string | null) => void;
};

function FilterSelect({ label, value, options, onChange }: FilterSelectProps) {
  return (
    <Select value={value ?? ALL} onValueChange={(v) => onChange(v === ALL ? null : v)}>
      <SelectTrigger aria-label={label} className="w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>All {label.toLowerCase()}s</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
