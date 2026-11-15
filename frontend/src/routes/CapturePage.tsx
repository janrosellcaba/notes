import { useEffect, useState } from "react";
import { Navigate } from "react-router";
import { useQuery } from "@tanstack/react-query";

import { Button } from "../components/ui/Button";
import { ApiError, createItem, errorMessage, getMe, newIdempotencyKey } from "../lib/api";
import { queryKeys } from "../lib/queryKeys";
import type { ItemCreate } from "../types/api";

const STORAGE_KEY = "notes.pendingShare";
const QUERY_LIMIT = 32 * 1024;

type PendingShare = { key: string; payload: ItemCreate };
type Prepared = { kind: "too-long" } | { kind: "empty" } | { kind: "pending"; pending: PendingShare };

function readPending(): PendingShare | null {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PendingShare;
    if (!parsed || typeof parsed.key !== "string" || !parsed.payload) return null;
    return parsed;
  } catch {
    return null;
  }
}

function samePayload(left: ItemCreate, right: ItemCreate): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function hostOf(value: string): string | null {
  try {
    const host = new URL(value).host;
    return host || null;
  } catch {
    return null;
  }
}

function buildPayload(title: string, text: string, url: string): ItemCreate {
  const trimmedUrl = url.trim();
  const body = text.trim();
  const withUrl = trimmedUrl && !body.includes(trimmedUrl) ? (body ? `${body}\n\n${trimmedUrl}` : trimmedUrl) : body;
  return {
    type: "note",
    title: title.trim() || hostOf(trimmedUrl) || "Shared note",
    body_md: withUrl,
    project_id: null,
    external_url: trimmedUrl || null,
  };
}

function prepareShare(): Prepared {
  const query = window.location.search;
  if (new TextEncoder().encode(query).length > QUERY_LIMIT) return { kind: "too-long" };
  const params = new URLSearchParams(query);
  const title = params.get("title") ?? "";
  const text = params.get("text") ?? "";
  const url = params.get("url") ?? "";
  if (title.trim() || text.trim() || url.trim()) {
    const payload = buildPayload(title, text, url);
    const existing = readPending();
    const pending = {
      key: existing && samePayload(existing.payload, payload) ? existing.key : newIdempotencyKey(),
      payload,
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(pending));
    window.history.replaceState(null, "", "/capture");
    return { kind: "pending", pending };
  }
  const existing = readPending();
  if (existing) return { kind: "pending", pending: existing };
  return { kind: "empty" };
}

export function CapturePage() {
  const [prepared] = useState(prepareShare);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState("");
  const me = useQuery({
    queryKey: queryKeys.me,
    queryFn: getMe,
    retry: false,
    enabled: prepared.kind === "pending",
  });

  useEffect(() => {
    if (prepared.kind !== "pending" || !me.data) return;
    let cancelled = false;
    setError("");
    void createItem(prepared.pending.payload, prepared.pending.key)
      .then((item) => {
        if (cancelled) return;
        sessionStorage.removeItem(STORAGE_KEY);
        window.location.replace(`/item/${item.id}`);
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        if (caught instanceof ApiError && caught.status === 401) {
          window.location.assign("/login?next=/capture");
          return;
        }
        setError(errorMessage(caught) || "Could not save the shared note");
      });
    return () => {
      cancelled = true;
    };
  }, [prepared, me.data, attempt]);

  if (prepared.kind === "empty") return <Navigate to="/" replace />;

  const body = prepared.kind === "pending" ? prepared.pending.payload.body_md ?? "" : "";
  const title = prepared.kind === "pending" ? prepared.pending.payload.title ?? "Shared note" : "Capture";

  return (
    <main className="min-h-dvh bg-canvas px-4 py-8 text-fg">
      <section className="mx-auto w-full max-w-3xl">
        <h1 className="text-[20px]">{title}</h1>
        {prepared.kind === "too-long" ? (
          <p className="mt-4 text-fg-secondary">
            This share is too long to open from a link. Paste it inside the app.
          </p>
        ) : null}
        {prepared.kind === "pending" && !error ? <p className="mt-4 text-fg-muted">Saving the shared note…</p> : null}
        {error ? (
          <div className="mt-4 flex flex-col items-start gap-3">
            <p>{error}</p>
            <Button variant="go" onClick={() => setAttempt((current) => current + 1)}>
              Retry
            </Button>
          </div>
        ) : null}
        {body ? <pre className="mt-6 whitespace-pre-wrap text-fg-secondary">{body}</pre> : null}
      </section>
    </main>
  );
}
