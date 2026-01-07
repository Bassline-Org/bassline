-- Core application tables

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch()),
  modified_at INTEGER DEFAULT (unixepoch())
);

-- Recreate ui_state with new schema (drop old version if upgrading)
DROP TABLE IF EXISTS ui_state;
CREATE TABLE ui_state (
  project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  viewport_x REAL DEFAULT 0,
  viewport_y REAL DEFAULT 0,
  viewport_zoom REAL DEFAULT 1,
  selected_entity TEXT
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
