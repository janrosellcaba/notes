import type {
  AIProcessResult,
  AuthUser,
  Context,
  ContextList,
  HomeFeed,
  Integrations,
  Attachment,
  Item,
  ItemCreate,
  ItemFilters,
  ItemList,
  ItemPatch,
  ItemStatus,
  Project,
  ProjectList,
  SearchResults,
  SettingsView,
} from "../types/api";

export type FieldError = { loc: Array<string | number>; msg: string };
export type ErrorDetail = string | FieldError[];

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly detail: ErrorDetail;

  constructor(status: number, code: string, detail: ErrorDetail) {
    super(typeof detail === "string" ? detail : "Request failed");
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  idempotencyKey?: string;
  signal?: AbortSignal;
};

let redirectingToLogin = false;

export function redirectToLogin(): void {
  if (redirectingToLogin || window.location.pathname === "/login") return;
  redirectingToLogin = true;
  const next = `${window.location.pathname}${window.location.search}`;
  window.location.assign(`/login?next=${encodeURIComponent(next)}`);
}

export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (typeof error.detail === "string" && error.detail) return error.detail;
    if (Array.isArray(error.detail) && error.detail[0]?.msg) return error.detail[0].msg;
    return "Request failed";
  }
  if (error instanceof DOMException && error.name === "AbortError") return "";
  return "Could not reach the server";
}

function parseJson(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function errorFrom(status: number, payload: unknown, fallback: string): ApiError {
  const record = payload !== null && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const code = typeof record.code === "string" ? record.code : "http_error";
  const detail = record.detail;
  if (typeof detail === "string" || Array.isArray(detail)) {
    return new ApiError(status, code, detail as ErrorDetail);
  }
  return new ApiError(status, code, fallback);
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers();
  if (options.body !== undefined) headers.set("Content-Type", "application/json");
  if (options.idempotencyKey) headers.set("Idempotency-Key", options.idempotencyKey);
  let response: Response;
  try {
    response = await fetch(path, {
      method: options.method ?? "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      credentials: "same-origin",
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(0, "network", "Could not reach the server");
  }
  if (response.status === 204) return undefined as T;
  const payload = parseJson(await response.text());
  if (!response.ok) {
    const error = errorFrom(response.status, payload, response.statusText || "Request failed");
    const anonymousAuth = path.startsWith("/api/auth/login") || path.startsWith("/api/auth/register");
    if (response.status === 401 && !anonymousAuth) redirectToLogin();
    throw error;
  }
  return payload as T;
}

export function login(username: string, password: string): Promise<AuthUser> {
  return api<AuthUser>("/api/auth/login", { method: "POST", body: { username, password } });
}

export function register(username: string, password: string, code: string): Promise<AuthUser> {
  return api<AuthUser>("/api/auth/register", { method: "POST", body: { username, password, code } });
}

export function changePassword(currentPassword: string, newPassword: string): Promise<AuthUser> {
  return api<AuthUser>("/api/auth/password", {
    method: "POST",
    body: { current_password: currentPassword, new_password: newPassword },
  });
}

export function logout(): Promise<void> {
  return api<void>("/api/auth/logout", { method: "POST" });
}

export function getMe(): Promise<AuthUser> {
  return api<AuthUser>("/api/auth/me");
}

export function listContexts(): Promise<ContextList> {
  return api<ContextList>("/api/contexts");
}

export function listProjects(contextId: string | null): Promise<ProjectList> {
  const params = new URLSearchParams();
  if (contextId) params.set("context_id", contextId);
  const query = params.toString();
  return api<ProjectList>(`/api/projects${query ? `?${query}` : ""}`);
}

export function getProject(id: string): Promise<Project> {
  return api<Project>(`/api/projects/${encodeURIComponent(id)}`);
}

export function createProject(body: {
  name: string;
  context_id: string;
  color: string | null;
}): Promise<Project> {
  return api<Project>("/api/projects", { method: "POST", body });
}

export function getHome(today: string, contextId: string | null): Promise<HomeFeed> {
  const params = new URLSearchParams({ today });
  if (contextId) params.set("context_id", contextId);
  return api<HomeFeed>(`/api/home?${params}`);
}

export function listItems(filters: ItemFilters): Promise<ItemList> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined) params.set(key, String(value));
  }
  return api<ItemList>(`/api/items?${params}`);
}

export function getItem(id: string): Promise<Item> {
  return api<Item>(`/api/items/${encodeURIComponent(id)}`);
}

export function createItem(body: ItemCreate, idempotencyKey?: string): Promise<Item> {
  return api<Item>("/api/items", { method: "POST", body, idempotencyKey });
}

export function patchItem(id: string, body: ItemPatch): Promise<Item> {
  return api<Item>(`/api/items/${encodeURIComponent(id)}`, { method: "PATCH", body });
}

export function archiveItem(id: string): Promise<Item> {
  return api<Item>(`/api/items/${encodeURIComponent(id)}/archive`, { method: "POST" });
}

export function deleteItem(id: string): Promise<void> {
  return api<void>(`/api/items/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function restoreItem(id: string): Promise<Item> {
  return api<Item>(`/api/items/${encodeURIComponent(id)}/restore`, { method: "POST" });
}

export function purgeItem(id: string): Promise<void> {
  return api<void>(`/api/items/${encodeURIComponent(id)}/permanent`, { method: "DELETE" });
}

export function dailyNote(day: string): Promise<Item> {
  return api<Item>(`/api/items/daily?day=${encodeURIComponent(day)}`);
}

export function lookupTitle(title: string): Promise<{ id: string; type: string; title: string }> {
  return api(`/api/items/lookup?title=${encodeURIComponent(title)}`);
}

export function listBacklinks(id: string): Promise<ItemList> {
  return api<ItemList>(`/api/items/${encodeURIComponent(id)}/backlinks`);
}

export function listAttachments(id: string): Promise<Attachment[]> {
  return api<Attachment[]>(`/api/items/${encodeURIComponent(id)}/attachments`);
}

export async function uploadAttachment(id: string, file: File): Promise<Attachment> {
  const body = new FormData();
  body.set("file", file);
  const response = await fetch(`/api/items/${encodeURIComponent(id)}/attachments`, {
    method: "POST",
    body,
    credentials: "same-origin",
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = payload && typeof payload === "object" && "detail" in payload ? String(payload.detail) : "Upload failed";
    throw new ApiError(response.status, "upload", detail);
  }
  return payload as Attachment;
}

export function deleteAttachment(itemId: string, attachmentId: string): Promise<void> {
  return api<void>(`/api/items/${encodeURIComponent(itemId)}/attachments/${encodeURIComponent(attachmentId)}`, {
    method: "DELETE",
  });
}

export function convertItem(id: string): Promise<Item> {
  return api<Item>(`/api/items/${encodeURIComponent(id)}/convert-to-task`, { method: "POST" });
}

export function searchItems(q: string, contextId: string | null, signal?: AbortSignal): Promise<SearchResults> {
  const params = new URLSearchParams({ q, limit: "20" });
  if (contextId) params.set("context_id", contextId);
  return api<SearchResults>(`/api/search?${params}`, { signal });
}

export function aiProcess(id: string): Promise<AIProcessResult> {
  return api<AIProcessResult>(`/api/items/${encodeURIComponent(id)}/ai-process`, { method: "POST" });
}

export function moveItem(
  id: string,
  body: { status: ItemStatus; before_id: string | null; after_id: string | null },
): Promise<Item> {
  return api<Item>(`/api/items/${encodeURIComponent(id)}/move`, { method: "POST", body });
}

export function extractTask(id: string, body: { title: string; selection?: string | null }): Promise<Item> {
  return api<Item>(`/api/items/${encodeURIComponent(id)}/extract-task`, { method: "POST", body });
}

export function patchProject(
  id: string,
  body: { name?: string; context_id?: string; color?: string | null },
): Promise<Project> {
  return api<Project>(`/api/projects/${encodeURIComponent(id)}`, { method: "PATCH", body });
}

export function archiveProject(id: string): Promise<Project> {
  return api<Project>(`/api/projects/${encodeURIComponent(id)}/archive`, { method: "POST" });
}

export function deleteProject(id: string): Promise<void> {
  return api<void>(`/api/projects/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function patchContext(
  id: string,
  body: { name?: string; color?: string; icon?: string },
): Promise<Context> {
  return api<Context>(`/api/contexts/${encodeURIComponent(id)}`, { method: "PATCH", body });
}

export function createContext(body: { name: string; color?: string; icon?: string }): Promise<Context> {
  return api<Context>("/api/contexts", { method: "POST", body });
}

export function deleteContext(id: string): Promise<void> {
  return api<void>(`/api/contexts/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function moveContext(id: string, direction: "up" | "down"): Promise<Context> {
  return api<Context>(`/api/contexts/${encodeURIComponent(id)}/move?direction=${direction}`, { method: "POST" });
}

export function getSettings(): Promise<SettingsView> {
  return api<SettingsView>("/api/settings");
}

export function patchSettings(body: { timezone: string }): Promise<SettingsView> {
  return api<SettingsView>("/api/settings", { method: "PATCH", body });
}

export function getIntegrations(): Promise<Integrations> {
  return api<Integrations>("/api/integrations");
}

export async function downloadFile(path: string, fallbackName: string): Promise<void> {
  const response = await fetch(path, { credentials: "same-origin" });
  if (response.status === 401) {
    redirectToLogin();
    throw new ApiError(401, "unauthenticated", "Sign in required");
  }
  if (!response.ok) {
    const payload = parseJson(await response.text());
    throw errorFrom(response.status, payload, "Download failed");
  }
  const blob = await response.blob();
  const match = /filename="([^"]+)"/.exec(response.headers.get("content-disposition") ?? "");
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(blob);
  anchor.download = match?.[1] ?? fallbackName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(anchor.href);
}
