import { useQuery } from "@tanstack/react-query";
import { Navigate, useParams } from "react-router";

import { lookupTitle } from "../lib/api";

export function GoPage() {
  const { title = "" } = useParams();
  const decoded = decodeURIComponent(title);
  const found = useQuery({
    queryKey: ["lookup", decoded],
    queryFn: () => lookupTitle(decoded),
    retry: false,
    enabled: decoded.length > 0,
  });
  if (found.data) return <Navigate to={`/item/${found.data.id}`} replace />;
  if (found.isPending) return <p className="text-fg-muted">Opening…</p>;
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-[20px]">No note titled “{decoded}”</h1>
      <p className="mt-2 text-fg-secondary">Create it from Home, then the link will open it.</p>
    </div>
  );
}
