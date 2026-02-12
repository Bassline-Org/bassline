-- Entity-Attribute-Value data model
-- Everything is an entity. Properties are attributes. Edges are relationships.

-- Drop old tables from previous schema (if upgrading)
DROP TABLE IF EXISTS connections;
DROP TABLE IF EXISTS resources;

-- Core entity table - just identity and timestamps
CREATE TABLE IF NOT EXISTS entities (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_at INTEGER DEFAULT (unixepoch()),
  modified_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_entities_project ON entities(project_id);

-- Attributes (EAV pattern)
-- All properties as queryable key/value pairs
CREATE TABLE IF NOT EXISTS attrs (
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT,
  type TEXT DEFAULT 'string',  -- 'string', 'number', 'boolean', 'json'
  PRIMARY KEY (entity_id, key)
);

CREATE INDEX IF NOT EXISTS idx_attrs_key ON attrs(key);
CREATE INDEX IF NOT EXISTS idx_attrs_key_value ON attrs(key, value);

-- Relationships between entities
-- Unified: contains, connects, binds
CREATE TABLE IF NOT EXISTS relationships (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  from_entity TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  to_entity TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'connects',
  -- 'contains': parent contains child (circuits, node->port)
  -- 'connects': data flow connection
  -- 'binds': kit binding (capability transfer)
  label TEXT,
  binding_name TEXT  -- For 'binds': the kit segment name
);

CREATE INDEX IF NOT EXISTS idx_rel_project ON relationships(project_id);
CREATE INDEX IF NOT EXISTS idx_rel_kind ON relationships(kind);
CREATE INDEX IF NOT EXISTS idx_rel_from ON relationships(from_entity);
CREATE INDEX IF NOT EXISTS idx_rel_to ON relationships(to_entity);

-- Stored views (named queries)
CREATE TABLE IF NOT EXISTS views (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,  -- NULL = global view
  name TEXT NOT NULL,
  description TEXT,
  query TEXT NOT NULL,
  layout TEXT DEFAULT 'graph',  -- 'graph', 'table', 'tree', 'cards'
  layout_config TEXT,  -- JSON
  created_at INTEGER DEFAULT (unixepoch())
);

