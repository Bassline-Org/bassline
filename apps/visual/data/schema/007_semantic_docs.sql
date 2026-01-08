-- Semantic documentation storage
-- Stores documentation extracted from docs/semantics/*.md files
-- Used to populate help.* attributes when creating new semantics

CREATE TABLE IF NOT EXISTS semantic_docs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  summary TEXT,
  description TEXT,
  usage TEXT,
  examples TEXT,
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  modified_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);
