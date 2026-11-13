interface DashboardProps {
  /** Where the dashboard is rendered; New Tab and the dashboard tab share this UI. */
  surface: 'newtab' | 'dashboard';
}

export function Dashboard({ surface }: DashboardProps) {
  return (
    <main className="flex h-full items-center justify-center p-6">
      <section className="rounded-(--radius-tile) bg-(--color-surface) px-8 py-6 text-center shadow-sm backdrop-blur">
        <h1 className="text-2xl font-semibold tracking-tight">Arca</h1>
        <p className="mt-1 text-sm text-(--color-ink-muted)">
          {surface === 'newtab' ? 'New Tab' : 'Dashboard'} · bookmarks coming soon
        </p>
      </section>
    </main>
  );
}
