import type { ReactNode } from "react";
import { Link } from "react-router";

import { cn } from "../../lib/cn";

type Props = {
  to?: string;
  title: ReactNode;
  meta?: ReactNode;
  leading?: ReactNode;
  className?: string;
  onClick?: () => void;
};

const rowClass =
  "flex min-h-11 w-full items-center gap-3 rounded-[8px] px-2 text-left text-[14px] hover:bg-interactive";

export function RowLink({ to, title, meta, leading, className, onClick }: Props) {
  const body = (
    <>
      {leading}
      <span className="min-w-0 flex-1 truncate">{title}</span>
      {meta ? <span className="shrink-0 font-mono text-[12px] text-fg-muted">{meta}</span> : null}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={cn(rowClass, className)} onClick={onClick}>
        {body}
      </Link>
    );
  }

  return (
    <button type="button" className={cn(rowClass, className)} onClick={onClick}>
      {body}
    </button>
  );
}
