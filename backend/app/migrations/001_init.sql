-- Timestamps are UTC text: 2026-11-15T10:48:00.000Z
-- due_on is a calendar date: 2026-11-15
-- ids are uuid4 strings

CREATE TABLE app_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE contexts (
  id         TEXT PRIMARY KEY,
  slug       TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  color      TEXT NOT NULL,
  sort_order INTEGER NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (length(trim(name)) > 0),
  CHECK (color GLOB '#[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]')
);

CREATE TABLE projects (
  id          TEXT PRIMARY KEY,
  context_id  TEXT NOT NULL REFERENCES contexts(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  name        TEXT NOT NULL,
  color       TEXT,
  archived_at TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  CHECK (length(trim(name)) BETWEEN 1 AND 200),
  CHECK (color IS NULL OR color GLOB '#[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]')
);

CREATE TABLE items (
  id                TEXT PRIMARY KEY,
  type              TEXT NOT NULL,
  title             TEXT NOT NULL DEFAULT '',
  body_md           TEXT NOT NULL DEFAULT '',
  project_id        TEXT REFERENCES projects(id) ON UPDATE CASCADE ON DELETE SET NULL,
  status            TEXT,
  priority          TEXT,
  due_on            TEXT,
  completed_at      TEXT,
  position          REAL,
  pinned            INTEGER NOT NULL DEFAULT 0,
  transcript_raw    TEXT,
  ai_summary        TEXT,
  ai_action_items   TEXT,
  calendar_event_id TEXT,
  calendar_provider TEXT,
  external_url      TEXT,
  source_item_id    TEXT REFERENCES items(id) ON UPDATE CASCADE ON DELETE SET NULL,
  source_selection  TEXT,
  archived_at       TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  CHECK (type IN ('note', 'task', 'meeting')),
  CHECK (length(title) <= 500),
  CHECK (pinned IN (0, 1)),
  CHECK (status IS NULL OR status IN ('backlog', 'todo', 'in_progress', 'cancelled', 'done')),
  CHECK (priority IS NULL OR priority IN ('none', 'low', 'medium', 'high', 'urgent')),
  CHECK (due_on IS NULL OR due_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  CHECK (calendar_provider IS NULL OR calendar_provider IN ('google', 'microsoft')),
  CHECK (source_item_id IS NULL OR source_item_id <> id),
  CHECK (
    (type = 'task'
      AND status IS NOT NULL
      AND priority IS NOT NULL
      AND pinned = 0
      AND transcript_raw IS NULL)
    OR
    (type = 'note'
      AND status IS NULL
      AND priority IS NULL
      AND due_on IS NULL
      AND position IS NULL
      AND completed_at IS NULL
      AND transcript_raw IS NULL)
    OR
    (type = 'meeting'
      AND status IS NULL
      AND priority IS NULL
      AND due_on IS NULL
      AND position IS NULL
      AND completed_at IS NULL)
  )
);

CREATE TABLE idempotency_keys (
  key          TEXT PRIMARY KEY,
  item_id      TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  request_hash TEXT NOT NULL,
  created_at   TEXT NOT NULL
);

CREATE INDEX idx_projects_context
  ON projects (context_id, archived_at, name);

CREATE INDEX idx_items_inbox
  ON items (created_at DESC)
  WHERE project_id IS NULL AND archived_at IS NULL;

CREATE INDEX idx_items_project_type
  ON items (project_id, type, updated_at DESC)
  WHERE archived_at IS NULL;

CREATE INDEX idx_items_tasks_due
  ON items (due_on, status)
  WHERE type = 'task' AND archived_at IS NULL;

CREATE INDEX idx_items_board
  ON items (project_id, status, position)
  WHERE type = 'task' AND archived_at IS NULL;

CREATE INDEX idx_items_pinned
  ON items (updated_at DESC)
  WHERE pinned = 1 AND archived_at IS NULL;

CREATE INDEX idx_items_source
  ON items (source_item_id)
  WHERE source_item_id IS NOT NULL;

CREATE VIRTUAL TABLE fts_search USING fts5(
  title,
  body_md,
  transcript_raw,
  content = 'items',
  content_rowid = 'rowid',
  tokenize = 'unicode61 remove_diacritics 2'
);

CREATE TRIGGER items_fts_ai AFTER INSERT ON items BEGIN
  INSERT INTO fts_search (rowid, title, body_md, transcript_raw)
  VALUES (new.rowid, new.title, new.body_md, COALESCE(new.transcript_raw, ''));
END;

CREATE TRIGGER items_fts_ad AFTER DELETE ON items BEGIN
  INSERT INTO fts_search (fts_search, rowid, title, body_md, transcript_raw)
  VALUES ('delete', old.rowid, old.title, old.body_md, COALESCE(old.transcript_raw, ''));
END;

CREATE TRIGGER items_fts_au
AFTER UPDATE OF title, body_md, transcript_raw ON items BEGIN
  INSERT INTO fts_search (fts_search, rowid, title, body_md, transcript_raw)
  VALUES ('delete', old.rowid, old.title, old.body_md, COALESCE(old.transcript_raw, ''));
  INSERT INTO fts_search (rowid, title, body_md, transcript_raw)
  VALUES (new.rowid, new.title, new.body_md, COALESCE(new.transcript_raw, ''));
END;

INSERT INTO contexts (id, slug, name, color, sort_order, created_at, updated_at) VALUES
  ('ctx_job1', 'job1', 'Job 1', '#3B82F6', 1, '2026-11-15T00:00:00.000Z', '2026-11-15T00:00:00.000Z'),
  ('ctx_job2', 'job2', 'Job 2', '#A855F7', 2, '2026-11-15T00:00:00.000Z', '2026-11-15T00:00:00.000Z'),
  ('ctx_job3', 'job3', 'Job 3', '#F59E0B', 3, '2026-11-15T00:00:00.000Z', '2026-11-15T00:00:00.000Z'),
  ('ctx_personal', 'personal', 'Personal', '#10B981', 4, '2026-11-15T00:00:00.000Z', '2026-11-15T00:00:00.000Z');

INSERT INTO app_meta (key, value) VALUES
  ('schema_version', '1'),
  ('session_version', '1'),
  ('timezone', 'Europe/Madrid');
