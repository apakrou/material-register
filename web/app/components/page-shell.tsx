export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-7xl space-y-4 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Material Register</h1>
        <p className="text-muted-foreground text-sm">Search and filter spare parts, consumables, raw materials and tools.</p>
      </header>
      {children}
    </main>
  );
}
