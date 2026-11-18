import { Search, X } from "lucide-react";
import type { ReactNode } from "react";

import { useI18n } from "../../lib/i18n";

export function ListFilter({
  value,
  onChange,
  placeholder,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  children?: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="relative min-w-[12rem] flex-1">
        <Search size={14} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-fg-muted" />
        <input
          value={value}
          aria-label={placeholder ?? t("filter.search")}
          placeholder={placeholder ?? t("filter.search")}
          className="min-h-9 w-full rounded-md border border-border bg-canvas py-1.5 pr-8 pl-8 text-[13px] outline-none focus:border-fg"
          onChange={(event) => onChange(event.target.value)}
        />
        {value ? (
          <button
            type="button"
            aria-label={t("filter.clear")}
            className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded p-1 text-fg-muted hover:bg-interactive hover:text-fg"
            onClick={() => onChange("")}
          >
            <X size={12} />
          </button>
        ) : null}
      </label>
      {children}
    </div>
  );
}

export function matchesQuery(haystack: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return haystack.toLowerCase().includes(q);
}
