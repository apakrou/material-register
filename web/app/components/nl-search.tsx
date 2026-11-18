import { Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { postJson, type NlFilters } from "~/lib/api";
import { useUpdateParams } from "~/lib/use-update-params";

/**
 * "Obsolete bearings in Brisbane" -> the API asks an LLM for filters -> we write them to the URL.
 * The normal search box and filter dropdowns then show exactly what the LLM chose,
 * so the user can check and adjust it.
 */
export function NaturalLanguageSearch() {
  const updateParams = useUpdateParams();
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault(); // submitted explicitly (Enter or button), not on every keystroke: each call costs an LLM request
    if (!text.trim()) return;
    setPending(true);
    setError(null);
    try {
      const filters = await postJson<NlFilters>("/api/nl-filters", { text });
      if (Object.keys(filters).length === 0) {
        setError("Couldn't find any filters in that. Try rephrasing, or use the filters below.");
        return;
      }
      // Replace the current search and filters with the LLM's; sort is kept.
      updateParams({
        q: filters.q ?? null,
        type: filters.type ?? null,
        status: filters.status ?? null,
        plant: filters.plant ?? null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-1">
      <div className="flex gap-2">
        <div className="relative w-full sm:w-[28rem]">
          <Sparkles className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            placeholder='Describe what you need, e.g. "obsolete bearings in Brisbane"'
            aria-label="Describe what you're looking for"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="pl-8"
            maxLength={200}
          />
        </div>
        <Button type="submit" variant="secondary" disabled={pending || !text.trim()}>
          {pending && <Loader2 className="animate-spin" />}
          Apply
        </Button>
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
    </form>
  );
}
