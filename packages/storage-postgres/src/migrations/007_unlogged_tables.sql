-- Migration 007: Unlogged Tables for Maximum Performance
--
-- Key insight: Propagation networks are self-healing and idempotent.
-- If we lose data in a crash, the network will just re-propagate!
-- This allows us to use UNLOGGED tables for massive performance gains.

-- Convert main append-only table to UNLOGGED
-- Note: This is a trade-off - 2-3x faster writes but data lost on crash
ALTER TABLE bassline_contact_values SET UNLOGGED;
ALTER TABLE bassline_contact_collections SET UNLOGGED;
ALTER TABLE bassline_contact_versions SET UNLOGGED;

-- Create unlogged versions of all transient tables
-- These can be recreated from the propagation network if lost
CREATE UNLOGGED TABLE IF NOT EXISTS bassline_contact_values_fast (
  LIKE bassline_contact_values INCLUDING ALL
);

CREATE UNLOGGED TABLE IF NOT EXISTS bassline_contact_versions_fast (
  LIKE bassline_contact_versions INCLUDING ALL
);

-- Function to use unlogged tables for maximum speed
CREATE OR REPLACE FUNCTION append_value_unlogged(
  p_network_id TEXT,
  p_group_id TEXT,
  p_contact_id TEXT,
  p_content_value TEXT,
  p_content_type TEXT DEFAULT 'json'
) RETURNS BIGINT AS $$
DECLARE
  v_version BIGINT;
BEGIN
  -- Get next version (this sequence survives crashes)
  v_version := nextval('bassline_version_seq');
  
  -- Insert to unlogged table (FAST - no WAL writes!)
  INSERT INTO bassline_contact_values_fast (
    network_id, group_id, contact_id, version, content_value, content_type
  ) VALUES (
    p_network_id, p_group_id, p_contact_id, v_version, p_content_value, p_content_type
  );
  
  -- Update unlogged version tracker
  INSERT INTO bassline_contact_versions_fast (
    network_id, group_id, contact_id, latest_version
  ) VALUES (
    p_network_id, p_group_id, p_contact_id, v_version
  )
  ON CONFLICT (network_id, group_id, contact_id)
  DO UPDATE SET 
    latest_version = v_version,
    updated_at = NOW();
  
  RETURN v_version;
END;
$$ LANGUAGE plpgsql;

-- Ultra-fast batch append for unlogged tables
CREATE OR REPLACE FUNCTION batch_append_unlogged(
  p_values JSONB[]
) RETURNS VOID AS $$
DECLARE
  v_base_version BIGINT;
  v_count INT;
BEGIN
  v_count := array_length(p_values, 1);
  
  -- Reserve version numbers
  SELECT nextval('bassline_version_seq') INTO v_base_version;
  PERFORM setval('bassline_version_seq', v_base_version + v_count - 1);
  
  -- Direct insert with no WAL logging
  INSERT INTO bassline_contact_values_fast (
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
END;
$$ LANGUAGE plpgsql;

-- Create recovery function to rebuild from propagation network
CREATE OR REPLACE FUNCTION recover_from_crash()
RETURNS TEXT AS $$
BEGIN
  -- Clear potentially corrupted unlogged tables
  TRUNCATE bassline_contact_values_fast;
  TRUNCATE bassline_contact_versions_fast;
  
  -- The propagation network will refill these tables
  -- as values propagate through the system
  
  RETURN 'Unlogged tables cleared. Network will re-propagate values.';
END;
$$ LANGUAGE plpgsql;

-- Performance comparison view
CREATE OR REPLACE VIEW bassline_table_performance AS
SELECT 
  n.nspname as schemaname,
  c.relname as tablename,
  CASE 
    WHEN c.relpersistence = 'u' THEN 'UNLOGGED'
    WHEN c.relpersistence = 'p' THEN 'LOGGED'
    ELSE 'OTHER'
  END as logging_mode,
  pg_size_pretty(pg_total_relation_size(c.oid)) as size,
  s.n_tup_ins as inserts,
  s.n_tup_upd as updates,
  s.n_tup_del as deletes,
  CASE 
    WHEN s.n_tup_ins > 0 THEN 
      ROUND((s.n_tup_upd::numeric / s.n_tup_ins::numeric) * 100, 2)
    ELSE 0
  END as update_ratio_pct
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
WHERE n.nspname = 'public' 
  AND c.relname LIKE 'bassline%'
  AND c.relkind = 'r'
ORDER BY c.relname;

-- Settings to maximize unlogged table performance
-- Can be set at session level:
COMMENT ON FUNCTION append_value_unlogged IS '
  Ultra-fast append using unlogged tables.
  
  For maximum performance, run with:
  SET synchronous_commit = OFF;
  SET fsync = OFF;  -- DANGEROUS but fast for testing
  SET full_page_writes = OFF;
  SET wal_level = minimal;
  
  These make writes 5-10x faster but data is not crash-safe.
  Perfect for propagation networks that can re-propagate!
';

-- Create a "hot path" for the most recent data
CREATE UNLOGGED TABLE IF NOT EXISTS bassline_hot_values (
  network_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  contact_id TEXT NOT NULL,
  content_value TEXT,
  version BIGINT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (network_id, group_id, contact_id)
);

-- Keep only the absolute latest value in hot table
CREATE OR REPLACE RULE hot_values_insert AS
  ON INSERT TO bassline_hot_values
  WHERE EXISTS (
    SELECT 1 FROM bassline_hot_values
    WHERE network_id = NEW.network_id
      AND group_id = NEW.group_id
      AND contact_id = NEW.contact_id
  )
  DO INSTEAD UPDATE bassline_hot_values
    SET content_value = NEW.content_value,
        version = NEW.version,
        created_at = NEW.created_at
    WHERE network_id = NEW.network_id
      AND group_id = NEW.group_id
      AND contact_id = NEW.contact_id
      AND version < NEW.version;

COMMENT ON TABLE bassline_hot_values IS 'Unlogged table with only latest values for ultra-fast reads';
COMMENT ON FUNCTION recover_from_crash IS 'Call after crash to reset unlogged tables for re-propagation';