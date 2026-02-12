-- Typed Attributes Extension
-- Extends the EAV model to support typed values: string, number, json, blob
-- Replaces the ambiguous 'value' column with explicit typed columns

-- SQLite doesn't support DROP COLUMN, so we rebuild the table

-- Step 1: Create new table with typed columns
CREATE TABLE attrs_new (
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'string',  -- 'string', 'number', 'json', 'blob'
  string_value TEXT,
  number_value REAL,
  json_value TEXT,
  blob_value BLOB,
  PRIMARY KEY (entity_id, key)
);

-- Step 2: Migrate existing data (all values become string_value)
INSERT INTO attrs_new (entity_id, key, type, string_value)
SELECT entity_id, key, 'string', value
FROM attrs;

-- Step 3: Drop old table and rename new one
DROP TABLE attrs;
ALTER TABLE attrs_new RENAME TO attrs;

-- Step 4: Recreate indexes
CREATE INDEX IF NOT EXISTS idx_attrs_key ON attrs(key);
CREATE INDEX IF NOT EXISTS idx_attrs_type ON attrs(type);
CREATE INDEX IF NOT EXISTS idx_attrs_key_string ON attrs(key, string_value);
