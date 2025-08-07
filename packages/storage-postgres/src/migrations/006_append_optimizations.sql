-- Migration 006: Performance Optimizations for Append-Only Storage
--
-- Additional tricks to squeeze maximum performance:
-- 1. Unlogged tables for transient data
-- 2. Partitioning for time-based cleanup  
-- 3. BRIN indexes for append-only patterns
-- 4. Prepared statements cache
-- 5. Write-ahead log optimizations

-- Create unlogged version of propagation log (doesn't survive crashes but FAST)
CREATE UNLOGGED TABLE IF NOT EXISTS bassline_propagation_log_fast (
  network_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  contact_id TEXT NOT NULL,
  version BIGINT NOT NULL,
  propagated BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (network_id, group_id, contact_id, version)
);

-- BRIN indexes - perfect for append-only with time ordering
-- Much smaller than B-tree, great for large tables
CREATE INDEX IF NOT EXISTS idx_values_version_brin 
  ON bassline_contact_values USING BRIN (version)
  WITH (pages_per_range = 128);

CREATE INDEX IF NOT EXISTS idx_values_created_brin
  ON bassline_contact_values USING BRIN (created_at)
  WITH (pages_per_range = 128);

-- Note: Partial indexes with NOW() don't work, need static conditions
-- This index covers recently updated records efficiently
CREATE INDEX IF NOT EXISTS idx_latest_values_recent
  ON bassline_contact_versions (network_id, group_id, contact_id, updated_at DESC);

-- Function for ultra-fast batch insert using COPY-like approach
CREATE OR REPLACE FUNCTION batch_append_values(
  p_values JSONB[]
) RETURNS TABLE(version BIGINT) AS $$
DECLARE
  v_base_version BIGINT;
  v_count INT;
BEGIN
  v_count := array_length(p_values, 1);
  
  -- Reserve version numbers in bulk
  v_base_version := nextval('bassline_version_seq');
  PERFORM setval('bassline_version_seq', v_base_version + v_count - 1);
  
  -- Bulk insert with unnest (faster than VALUES)
  INSERT INTO bassline_contact_values (
    network_id, group_id, contact_id, version, content_value, content_type
  )
  SELECT 
    (value->>'network_id')::TEXT,
    (value->>'group_id')::TEXT,
    (value->>'contact_id')::TEXT,
    v_base_version + (row_number() OVER () - 1),
    value->>'content_value',
    COALESCE(value->>'content_type', 'json')
  FROM unnest(p_values) AS value;
  
  -- Bulk update version trackers
  INSERT INTO bassline_contact_versions AS v (
    network_id, group_id, contact_id, latest_version
  )
  SELECT 
    (value->>'network_id')::TEXT,
    (value->>'group_id')::TEXT,
    (value->>'contact_id')::TEXT,
    v_base_version + (row_number() OVER () - 1)
  FROM unnest(p_values) AS value
  ON CONFLICT (network_id, group_id, contact_id)
  DO UPDATE SET 
    latest_version = EXCLUDED.latest_version,
    updated_at = NOW()
  WHERE v.latest_version < EXCLUDED.latest_version; -- Only update if newer
  
  -- Return versions
  RETURN QUERY
  SELECT generate_series(v_base_version, v_base_version + v_count - 1);
END;
$$ LANGUAGE plpgsql;

-- Aggressive cleanup function (for testing/development)
CREATE OR REPLACE FUNCTION aggressive_cleanup(
  p_keep_versions INT DEFAULT 1
) RETURNS TABLE(cleaned_contacts INT, deleted_values INT) AS $$
DECLARE
  v_cleaned INT := 0;
  v_deleted INT := 0;
BEGIN
  -- Mark all old versions as subsumed
  WITH latest AS (
    SELECT DISTINCT ON (network_id, group_id, contact_id)
      network_id, group_id, contact_id, version
    FROM bassline_contact_values
    ORDER BY network_id, group_id, contact_id, version DESC
  )
  UPDATE bassline_contact_values v
  SET subsumed = TRUE
  FROM latest l
  WHERE v.network_id = l.network_id
    AND v.group_id = l.group_id
    AND v.contact_id = l.contact_id
    AND v.version < l.version
    AND NOT v.subsumed;
  
  GET DIAGNOSTICS v_cleaned = ROW_COUNT;
  
  -- Immediately delete subsumed values (no wait)
  DELETE FROM bassline_contact_values
  WHERE subsumed = TRUE;
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  
  -- Clean collections too
  DELETE FROM bassline_contact_collections c
  WHERE NOT EXISTS (
    SELECT 1 FROM bassline_contact_values v
    WHERE v.network_id = c.network_id
      AND v.group_id = c.group_id
      AND v.contact_id = c.contact_id
  );
  
  RETURN QUERY SELECT v_cleaned, v_deleted;
END;
$$ LANGUAGE plpgsql;

-- Table for pre-computed latest values (updated async)
CREATE TABLE IF NOT EXISTS bassline_latest_cache (
  network_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  contact_id TEXT NOT NULL,
  content_value TEXT,
  content_type TEXT,
  version BIGINT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (network_id, group_id, contact_id)
);

-- Trigger to update cache on new values
CREATE OR REPLACE FUNCTION update_latest_cache()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO bassline_latest_cache (
    network_id, group_id, contact_id, 
    content_value, content_type, version
  ) VALUES (
    NEW.network_id, NEW.group_id, NEW.contact_id,
    NEW.content_value, NEW.content_type, NEW.version
  )
  ON CONFLICT (network_id, group_id, contact_id)
  DO UPDATE SET
    content_value = NEW.content_value,
    content_type = NEW.content_type,
    version = NEW.version,
    updated_at = NOW()
  WHERE bassline_latest_cache.version < NEW.version;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Optional: Enable trigger for real-time cache
-- CREATE TRIGGER update_cache_on_insert
-- AFTER INSERT ON bassline_contact_values
-- FOR EACH ROW EXECUTE FUNCTION update_latest_cache();

-- Settings for maximum insert performance
-- These can be set per session for bulk operations:
-- SET synchronous_commit = OFF;  -- Don't wait for WAL flush
-- SET work_mem = '256MB';        -- More memory for sorts
-- SET maintenance_work_mem = '1GB'; -- For VACUUM/indexes

-- Function to optimize tables after heavy inserts
CREATE OR REPLACE FUNCTION optimize_tables()
RETURNS void AS $$
BEGIN
  -- Update table statistics
  ANALYZE bassline_contact_values;
  ANALYZE bassline_contact_versions;
  
  -- Reindex if needed (can be done CONCURRENTLY in production)
  REINDEX TABLE CONCURRENTLY bassline_contact_values;
  REINDEX TABLE CONCURRENTLY bassline_contact_versions;
END;
$$ LANGUAGE plpgsql;

-- Monitoring view for performance metrics
CREATE OR REPLACE VIEW bassline_performance_metrics AS
SELECT 
  'contact_values' as table_name,
  pg_size_pretty(pg_total_relation_size('bassline_contact_values')) as total_size,
  pg_size_pretty(pg_relation_size('bassline_contact_values')) as table_size,
  pg_size_pretty(pg_indexes_size('bassline_contact_values')) as index_size,
  (SELECT COUNT(*) FROM bassline_contact_values) as row_count,
  (SELECT COUNT(*) FROM bassline_contact_values WHERE NOT subsumed) as active_rows,
  (SELECT MAX(version) FROM bassline_contact_values) as max_version,
  (SELECT COUNT(DISTINCT (network_id, group_id, contact_id)) FROM bassline_contact_values) as unique_contacts
UNION ALL
SELECT 
  'contact_versions' as table_name,
  pg_size_pretty(pg_total_relation_size('bassline_contact_versions')) as total_size,
  pg_size_pretty(pg_relation_size('bassline_contact_versions')) as table_size,
  pg_size_pretty(pg_indexes_size('bassline_contact_versions')) as index_size,
  (SELECT COUNT(*) FROM bassline_contact_versions) as row_count,
  NULL as active_rows,
  NULL as max_version,
  NULL as unique_contacts;

COMMENT ON FUNCTION batch_append_values IS 'Ultra-fast batch insert using single query';
COMMENT ON FUNCTION aggressive_cleanup IS 'Immediate cleanup for testing (production should use delayed cleanup)';
COMMENT ON TABLE bassline_latest_cache IS 'Pre-computed cache of latest values for read performance';