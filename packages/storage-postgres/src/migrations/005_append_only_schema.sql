-- Migration 005: Append-Only Schema for Propagation Networks
-- 
-- Key insight: In propagation networks, information monotonically increases.
-- We never truly "update" - we only add new information that subsumes the old.
-- This schema leverages that property for massive performance gains.

-- Append-only contact values table
-- Each "update" is actually a new INSERT with a version number
CREATE TABLE IF NOT EXISTS bassline_contact_values (
  network_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  contact_id TEXT NOT NULL,
  version BIGINT NOT NULL, -- Monotonically increasing version
  content_value TEXT,
  content_type TEXT DEFAULT 'json',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  subsumed BOOLEAN DEFAULT FALSE, -- Mark when value is superseded
  PRIMARY KEY (network_id, group_id, contact_id, version)
);

-- Collection entries as individual rows (for sets, lists, maps)
CREATE TABLE IF NOT EXISTS bassline_contact_collections (
  network_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  contact_id TEXT NOT NULL,
  collection_type TEXT NOT NULL, -- 'set', 'list', 'map'
  entry_key TEXT NOT NULL, -- For maps, or index for lists, hash for sets
  entry_value TEXT NOT NULL,
  version BIGINT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  subsumed BOOLEAN DEFAULT FALSE,
  PRIMARY KEY (network_id, group_id, contact_id, collection_type, entry_key, version)
);

-- Incremental propagation log
-- Tracks what values need to be propagated
CREATE TABLE IF NOT EXISTS bassline_propagation_log (
  network_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  contact_id TEXT NOT NULL,
  version BIGINT NOT NULL,
  propagated BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (network_id, group_id, contact_id, version)
);

-- Version tracking per contact (for quick latest lookup)
CREATE TABLE IF NOT EXISTS bassline_contact_versions (
  network_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  contact_id TEXT NOT NULL,
  latest_version BIGINT NOT NULL,
  oldest_unsubsumed_version BIGINT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (network_id, group_id, contact_id)
);

-- Indexes for append-only pattern
-- No unique constraints on values - allows concurrent inserts!

-- For finding latest value (most common query)
CREATE INDEX IF NOT EXISTS idx_contact_values_latest 
  ON bassline_contact_values(network_id, group_id, contact_id, version DESC)
  WHERE NOT subsumed;

-- For collection lookups
CREATE INDEX IF NOT EXISTS idx_collections_lookup
  ON bassline_contact_collections(network_id, group_id, contact_id, collection_type, entry_key, version DESC)
  WHERE NOT subsumed;

-- For garbage collection
CREATE INDEX IF NOT EXISTS idx_values_subsumed
  ON bassline_contact_values(subsumed, created_at)
  WHERE subsumed = TRUE;

CREATE INDEX IF NOT EXISTS idx_collections_subsumed
  ON bassline_contact_collections(subsumed, created_at)
  WHERE subsumed = TRUE;

-- For propagation
CREATE INDEX IF NOT EXISTS idx_propagation_pending
  ON bassline_propagation_log(network_id, propagated, created_at)
  WHERE propagated = FALSE;

-- Function to get next version number (uses sequence for performance)
CREATE SEQUENCE IF NOT EXISTS bassline_version_seq;

CREATE OR REPLACE FUNCTION get_next_version()
RETURNS BIGINT AS $$
BEGIN
  RETURN nextval('bassline_version_seq');
END;
$$ LANGUAGE plpgsql;

-- Function to append a value (INSERT only, never UPDATE!)
CREATE OR REPLACE FUNCTION append_contact_value(
  p_network_id TEXT,
  p_group_id TEXT,
  p_contact_id TEXT,
  p_content_value TEXT,
  p_content_type TEXT DEFAULT 'json'
) RETURNS BIGINT AS $$
DECLARE
  v_version BIGINT;
BEGIN
  -- Get next version
  v_version := get_next_version();
  
  -- Just INSERT - no checks, no updates!
  INSERT INTO bassline_contact_values (
    network_id, group_id, contact_id, version, content_value, content_type
  ) VALUES (
    p_network_id, p_group_id, p_contact_id, v_version, p_content_value, p_content_type
  );
  
  -- Update version tracker (this is the only UPDATE we do)
  INSERT INTO bassline_contact_versions (
    network_id, group_id, contact_id, latest_version
  ) VALUES (
    p_network_id, p_group_id, p_contact_id, v_version
  )
  ON CONFLICT (network_id, group_id, contact_id)
  DO UPDATE SET 
    latest_version = v_version,
    updated_at = NOW();
  
  -- Log for propagation
  INSERT INTO bassline_propagation_log (
    network_id, group_id, contact_id, version
  ) VALUES (
    p_network_id, p_group_id, p_contact_id, v_version
  );
  
  RETURN v_version;
END;
$$ LANGUAGE plpgsql;

-- Function to get latest value (optimized)
CREATE OR REPLACE FUNCTION get_latest_value(
  p_network_id TEXT,
  p_group_id TEXT,
  p_contact_id TEXT
) RETURNS TABLE(content_value TEXT, content_type TEXT, version BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT cv.content_value, cv.content_type, cv.version
  FROM bassline_contact_values cv
  JOIN bassline_contact_versions ver 
    ON cv.network_id = ver.network_id 
    AND cv.group_id = ver.group_id 
    AND cv.contact_id = ver.contact_id
    AND cv.version = ver.latest_version
  WHERE cv.network_id = p_network_id 
    AND cv.group_id = p_group_id 
    AND cv.contact_id = p_contact_id
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Subsumption cleanup (mark old values as subsumed)
CREATE OR REPLACE FUNCTION mark_subsumed_values(
  p_network_id TEXT,
  p_group_id TEXT,
  p_contact_id TEXT,
  p_keep_versions INT DEFAULT 1
) RETURNS INT AS $$
DECLARE
  v_count INT;
BEGIN
  WITH latest_versions AS (
    SELECT version
    FROM bassline_contact_values
    WHERE network_id = p_network_id 
      AND group_id = p_group_id 
      AND contact_id = p_contact_id
      AND NOT subsumed
    ORDER BY version DESC
    LIMIT p_keep_versions
  )
  UPDATE bassline_contact_values
  SET subsumed = TRUE
  WHERE network_id = p_network_id 
    AND group_id = p_group_id 
    AND contact_id = p_contact_id
    AND version NOT IN (SELECT version FROM latest_versions)
    AND NOT subsumed;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Batch cleanup of subsumed values (run periodically)
CREATE OR REPLACE FUNCTION cleanup_subsumed_values(
  p_older_than INTERVAL DEFAULT '1 hour'
) RETURNS TABLE(deleted_values INT, deleted_collections INT) AS $$
DECLARE
  v_deleted_values INT;
  v_deleted_collections INT;
BEGIN
  -- Delete old subsumed values
  DELETE FROM bassline_contact_values
  WHERE subsumed = TRUE 
    AND created_at < NOW() - p_older_than;
  GET DIAGNOSTICS v_deleted_values = ROW_COUNT;
  
  -- Delete old subsumed collections
  DELETE FROM bassline_contact_collections
  WHERE subsumed = TRUE 
    AND created_at < NOW() - p_older_than;
  GET DIAGNOSTICS v_deleted_collections = ROW_COUNT;
  
  RETURN QUERY SELECT v_deleted_values, v_deleted_collections;
END;
$$ LANGUAGE plpgsql;

-- Statistics view for monitoring
CREATE OR REPLACE VIEW bassline_append_stats AS
SELECT 
  COUNT(*) as total_values,
  COUNT(*) FILTER (WHERE subsumed = TRUE) as subsumed_values,
  COUNT(*) FILTER (WHERE subsumed = FALSE) as active_values,
  pg_size_pretty(pg_total_relation_size('bassline_contact_values')) as table_size,
  MAX(version) as max_version,
  MIN(created_at) as oldest_value,
  MAX(created_at) as newest_value
FROM bassline_contact_values;

COMMENT ON TABLE bassline_contact_values IS 'Append-only storage for contact values - never UPDATE, only INSERT';
COMMENT ON TABLE bassline_contact_collections IS 'Collection entries as individual rows for lock-free concurrent updates';
COMMENT ON FUNCTION append_contact_value IS 'Appends a new value version without any locking or blocking';
COMMENT ON FUNCTION mark_subsumed_values IS 'Marks old values as subsumed by newer ones (called by runtime)';
COMMENT ON FUNCTION cleanup_subsumed_values IS 'Physically removes subsumed values after safe delay';