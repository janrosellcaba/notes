import { useQuery } from "@tanstack/react-query";

import { listItems } from "../lib/api";
import { queryKeys } from "../lib/queryKeys";
import { useProjectList } from "../lib/queries";
import type { ItemFilters } from "../types/api";
import { EmptyState } from "../components/ui/EmptyState";
import { InboxCard } from "../components/items/InboxCard";

const INBOX: ItemFilters = { project_id: "none", limit: 200 };

export function InboxPage() {
  const items = useQuery({
    queryKey: queryKeys.items(INBOX),
    queryFn: () => listItems(INBOX),
  });
  const projects = useProjectList("all");
  const cards = items.data?.items ?? [];

  return (
    <div className="mx-auto w-full max-w-3xl">
      <header className="mb-4 flex items-baseline gap-3">
        <h1 className="text-[20px]">Inbox</h1>
        <span className="font-mono text-[13px] text-fg-muted">{items.data ? cards.length : ""}</span>
      </header>
      {items.isPending ? <p className="font-mono text-[13px] text-fg-muted">Loading…</p> : null}
      {items.isError ? <p className="text-fg-secondary">Could not load the inbox.</p> : null}
      {items.data && cards.length === 0 ? <EmptyState>Nothing in the inbox</EmptyState> : null}
      <div className="flex flex-col gap-3">
        {cards.map((item) => (
          <InboxCard key={item.id} item={item} projects={projects.data?.projects ?? []} />
        ))}
      </div>
    </div>
  );
}
