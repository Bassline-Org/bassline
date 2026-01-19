-- Dedicated stamps table schema
-- Stamps are reusable templates and vocabulary definitions

-- Main stamps table
CREATE TABLE IF NOT EXISTS stamps (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  category TEXT,
  kind TEXT NOT NULL DEFAULT 'template',  -- 'template' | 'vocabulary'
  created_at INTEGER DEFAULT (unixepoch()),
  modified_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_stamps_kind ON stamps(kind);
CREATE INDEX IF NOT EXISTS idx_stamps_category ON stamps(category);

-- Stamp attrs (applied when stamping)
CREATE TABLE IF NOT EXISTS stamp_attrs (
  stamp_id TEXT NOT NULL REFERENCES stamps(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT,
  type TEXT DEFAULT 'string',
  PRIMARY KEY (stamp_id, key)
);

CREATE INDEX IF NOT EXISTS idx_stamp_attrs_stamp ON stamp_attrs(stamp_id);

-- Stamp children (for hierarchical stamps)
CREATE TABLE IF NOT EXISTS stamp_members (
  id TEXT PRIMARY KEY,
  stamp_id TEXT NOT NULL REFERENCES stamps(id) ON DELETE CASCADE,
  local_id TEXT NOT NULL,  -- stable reference within stamp
  UNIQUE(stamp_id, local_id)
);

CREATE INDEX IF NOT EXISTS idx_stamp_members_stamp ON stamp_members(stamp_id);

-- Child attrs
CREATE TABLE IF NOT EXISTS stamp_member_attrs (
  member_id TEXT NOT NULL REFERENCES stamp_members(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT,
  type TEXT DEFAULT 'string',
  PRIMARY KEY (member_id, key)
);

CREATE INDEX IF NOT EXISTS idx_stamp_member_attrs_member ON stamp_member_attrs(member_id);

-- Internal relationships within stamps
CREATE TABLE IF NOT EXISTS stamp_relationships (
  id TEXT PRIMARY KEY,
  stamp_id TEXT NOT NULL REFERENCES stamps(id) ON DELETE CASCADE,
  from_local_id TEXT,  -- NULL = root stamp entity
  to_local_id TEXT,    -- NULL = root stamp entity
  kind TEXT DEFAULT 'connects'
);

CREATE INDEX IF NOT EXISTS idx_stamp_rels_stamp ON stamp_relationships(stamp_id);

-- Track which stamps were applied to entities
CREATE TABLE IF NOT EXISTS entity_stamps (
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  stamp_id TEXT NOT NULL REFERENCES stamps(id) ON DELETE CASCADE,
  applied_at INTEGER DEFAULT (unixepoch()),
  PRIMARY KEY (entity_id, stamp_id)
);

CREATE INDEX IF NOT EXISTS idx_entity_stamps_entity ON entity_stamps(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_stamps_stamp ON entity_stamps(stamp_id);

-- Migrate existing stamps from _stamps project (if any exist)
-- This copies stamp entities to the new stamps table
INSERT OR IGNORE INTO stamps (id, name, kind, created_at, modified_at)
SELECT
  e.id,
  COALESCE(a_name.value, 'Unnamed'),
  'template',
  e.created_at,
  e.modified_at
FROM entities e
JOIN attrs a_stamp ON e.id = a_stamp.entity_id AND a_stamp.key = 'stamp' AND a_stamp.value = 'true'
LEFT JOIN attrs a_name ON e.id = a_name.entity_id AND a_name.key = 'stamp.name'
WHERE e.project_id = '_stamps';

-- Copy stamp attrs (excluding stamp markers and position)
INSERT OR IGNORE INTO stamp_attrs (stamp_id, key, value, type)
SELECT
  a.entity_id,
  a.key,
  a.value,
  a.type
FROM attrs a
WHERE a.entity_id IN (SELECT id FROM stamps)
  AND a.key NOT IN ('stamp', 'stamp.name', 'x', 'y');

-- Note: stamp_members and stamp_relationships migration would require
-- more complex queries to handle child entities. For now, new stamps
-- will use the new structure and old stamps just carry their root attrs.
