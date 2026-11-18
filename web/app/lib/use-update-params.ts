import { useSearchParams } from "react-router";

/**
 * The URL is the single source of truth for table state (search, filters, sort, page).
 * Components change state by changing the URL; the route's clientLoader then fetches.
 */
export function useUpdateParams() {
  const [, setSearchParams] = useSearchParams();

  return (changes: Record<string, string | null>, options?: { replace?: boolean }) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        // Changing search, filters or sort changes the result set, so go back to page 1.
        if (!("page" in changes)) next.delete("page");
        return next;
      },
      { replace: options?.replace, preventScrollReset: true },
    );
  };
}
