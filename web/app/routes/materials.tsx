import { AlertCircle } from "lucide-react";
import { Link, useNavigation } from "react-router";
import { MaterialsTable } from "~/components/materials-table";
import { MaterialsToolbar } from "~/components/materials-toolbar";
import { PageShell } from "~/components/page-shell";
import { TablePagination } from "~/components/table-pagination";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { getJson, type MaterialsResponse, type Plant } from "~/lib/api";
import { useUpdateParams } from "~/lib/use-update-params";
import type { Route } from "./+types/materials";

// Runs in the browser before the page renders and again whenever the URL changes.
// The page's query string uses the same names as the API, so we pass it straight through;
// the server validates it and applies defaults.
// React Router aborts `request.signal` if the URL changes again before this finishes,
// so a slow, outdated response can never overwrite a newer one.
export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const { search } = new URL(request.url);
  const [materials, plants] = await Promise.all([
    getJson<MaterialsResponse>(`/api/materials${search}`, request.signal),
    getJson<Plant[]>("/api/plants", request.signal),
  ]);
  return { materials, plants };
}

export default function MaterialsPage({ loaderData }: Route.ComponentProps) {
  const { materials, plants } = loaderData;
  const navigation = useNavigation();
  const isLoading = navigation.state === "loading";
  const updateParams = useUpdateParams();
  const clearFilters = () => updateParams({ q: null, type: null, status: null, plant: null });

  return (
    <PageShell>
      <MaterialsToolbar query={materials.query} plants={plants} isLoading={isLoading} onClearFilters={clearFilters} />
      <MaterialsTable
        materials={materials.data}
        query={materials.query}
        isLoading={isLoading}
        onClearFilters={clearFilters}
      />
      <TablePagination total={materials.total} pageCount={materials.pageCount} query={materials.query} />
    </PageShell>
  );
}

// Shown if the clientLoader throws: API down, or invalid params in the URL (400).
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const message = error instanceof Error ? error.message : "Unknown error";
  return (
    <PageShell>
      <Alert variant="destructive">
        <AlertCircle />
        <AlertTitle>Couldn't load materials</AlertTitle>
        <AlertDescription>{message}</AlertDescription>
      </Alert>
      <div className="flex gap-2">
        <Button onClick={() => window.location.reload()}>Try again</Button>
        <Button variant="outline" asChild>
          <Link to="/" reloadDocument>
            Reset view
          </Link>
        </Button>
      </div>
    </PageShell>
  );
}
