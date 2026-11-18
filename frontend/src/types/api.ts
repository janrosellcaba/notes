export type ItemType = "note" | "task" | "meeting";
export type ItemStatus = "backlog" | "todo" | "in_progress" | "blocked" | "done";
export type ItemPriority = "none" | "low" | "medium" | "high" | "urgent";

export type Context = {
  id: string;
  slug: string;
  name: string;
  color: string;
  icon: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type ContextRef = {
  id: string;
  slug: string;
  name: string;
  color: string;
  icon: string | null;
};

export type ProjectRef = {
  id: string;
  name: string;
  color: string;
  context: ContextRef;
};

export type ProjectStatus = "active" | "done" | "cancelled";

export type Project = {
  id: string;
  name: string;
  color: string;
  color_override: string | null;
  context: ContextRef;
  due_on: string | null;
  status: ProjectStatus;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Item = {
  id: string;
  type: ItemType;
  title: string;
  body_md: string;
  project: ProjectRef | null;
  status: ItemStatus | null;
  priority: ItemPriority | null;
  due_on: string | null;
  completed_at: string | null;
  position: number | null;
  pinned: boolean;
  transcript_raw: string | null;
  ai_summary: string | null;
  ai_action_items: string | null;
  calendar_event_id: string | null;
  calendar_provider: string | null;
  external_url: string | null;
  source_item_id: string | null;
  source_selection: string | null;
  archived_at: string | null;
  deleted_at: string | null;
  daily_on: string | null;
  recurrence: "weekly" | "monthly" | null;
  recurrence_weekday: number | null;
  recurrence_monthday: number | null;
  context: ContextRef | null;
  parent_id: string | null;
  starts_on: string | null;
  assignee: string | null;
  subtask_total: number;
  subtask_done: number;
  created_at: string;
  updated_at: string;
};

export type Attachment = {
  id: string;
  item_id: string;
  filename: string;
  content_type: string;
  size: number;
  created_at: string;
};

export type ItemList = {
  items: Item[];
  next_cursor: string | null;
};

export type ItemCreate = {
  type: ItemType;
  title?: string;
  body_md?: string;
  project_id?: string | null;
  context_id?: string | null;
  status?: ItemStatus | null;
  priority?: ItemPriority | null;
  due_on?: string | null;
  starts_on?: string | null;
  assignee?: string | null;
  parent_id?: string | null;
  pinned?: boolean;
  transcript_raw?: string | null;
  external_url?: string | null;
};

export type ItemPatch = {
  title?: string;
  body_md?: string;
  project_id?: string | null;
  status?: ItemStatus;
  priority?: ItemPriority;
  due_on?: string | null;
  starts_on?: string | null;
  assignee?: string | null;
  parent_id?: string | null;
  context_id?: string | null;
  pinned?: boolean;
  transcript_raw?: string | null;
  external_url?: string | null;
  recurrence?: "weekly" | "monthly" | null;
  recurrence_weekday?: number | null;
  recurrence_monthday?: number | null;
};

export type ItemFilters = {
  type?: ItemType;
  project_id?: string;
  context_id?: string;
  pinned?: boolean;
  status?: ItemStatus;
  due?: "overdue" | "today" | "upcoming" | "none";
  today?: string;
  include_done?: boolean;
  parent_id?: string;
  roots?: boolean;
  archived?: boolean;
  trashed?: boolean;
  limit?: number;
  cursor?: string;
};

export type HomeFeed = {
  today: string;
  inbox_count: number;
  pinned: Item[];
  today_tasks: Item[];
};

export type SearchHit = {
  id: string;
  type: ItemType | string;
  title: string;
  snippet: string;
  snippet_field: string;
  project: ProjectRef | null;
  updated_at: string;
};

export type SearchResults = {
  results: SearchHit[];
};

export type AuthUser = {
  username: string;
};

export type SettingsView = {
  timezone: string;
  schema_version: number;
};

export type Integrations = {
  ai: { configured: boolean; provider: string | null };
  google_calendar: { configured: boolean };
  microsoft_calendar: { configured: boolean };
};

export type AIProcessResult = {
  detail: string;
  code: string;
  item_id: string;
  planned_effects: {
    writes: string[];
    may_create: string;
  };
};

export type ProjectList = { projects: Project[] };
export type ContextList = { contexts: Context[] };
