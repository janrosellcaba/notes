import { useQuery } from "@tanstack/react-query";
import { Navigate, useParams } from "react-router";

import { lookupTitle } from "../lib/api";
import { useI18n } from "../lib/i18n";

export function GoPage() {
  const { title = "" } = useParams();
  const decoded = decodeURIComponent(title);
  const { t } = useI18n();
  const found = useQuery({
    queryKey: ["lookup", decoded],
    queryFn: () => lookupTitle(decoded),
    retry: false,
    enabled: decoded.length > 0,
  });
  if (found.data) return <Navigate to={`/item/${found.data.id}`} replace />;
  if (found.isPending) return <p className="text-fg-muted">{t("go.opening")}</p>;
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-[20px]">{t("go.missing", { title: decoded })}</h1>
      <p className="mt-2 text-fg-secondary">{t("go.hint")}</p>
    </div>
  );
}
