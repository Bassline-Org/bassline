-- Theme system tables

-- Token definitions (what can be themed)
CREATE TABLE IF NOT EXISTS token_definitions (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT
);

-- Available themes
CREATE TABLE IF NOT EXISTS themes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  author TEXT DEFAULT 'user',
  is_system INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch()),
  modified_at INTEGER DEFAULT (unixepoch())
);

-- Theme color values (normalized)
CREATE TABLE IF NOT EXISTS theme_colors (
  theme_id TEXT NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
  token_id TEXT NOT NULL REFERENCES token_definitions(id),
  value TEXT NOT NULL,
  PRIMARY KEY (theme_id, token_id)
);

-- Global settings
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_theme_colors_theme ON theme_colors(theme_id);
