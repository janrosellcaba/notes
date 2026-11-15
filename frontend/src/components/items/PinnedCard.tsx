import { Link } from "react-router";

import { relativeTime } from "../../lib/dates";
import { useI18n } from "../../lib/i18n";
import type { Item } from "../../types/api";

export function PinnedCard({ item }: { item: Item }) {
  const { t } = useI18n();
  return (
    <li className="min-w-[220px] md:min-w-0">
      <Link
        to={`/item/${item.id}`}
        className="flex h-full min-h-[88px] flex-col justify-between rounded-[10px] border border-border bg-elevated p-3 hover:bg-interactive"
      >
        <span className="line-clamp-2">{item.title || t("common.untitled")}</span>
        <span className="mt-3 flex items-center justify-between gap-2 text-[13px] text-fg-muted">
          <span className="truncate">{item.project?.name ?? t("inbox.title")}</span>
          <time className="shrink-0 font-mono" dateTime={item.updated_at}>
            {relativeTime(item.updated_at)}
          </time>
        </span>
      </Link>
    </li>
  );
}
