-- Migration 008: Configurable Durability
--
-- This migration updates our append-only tables to support both
-- LOGGED (durable) and UNLOGGED (performance) modes.
-- 
-- By default, we use LOGGED tables for production safety.
-- The application can dynamically choose which tables to use based on config.

-- First, create LOGGED versions of our main tables (these are durable)
-- These will be the default tables used in production

-- Convert existing UNLOGGED tables to LOGGED
ALTER TABLE bassline_contact_values SET LOGGED;
ALTER TABLE bassline_contact_collections SET LOGGED;
ALTER TABLE bassline_contact_versions SET LOGGED;
ALTER TABLE bassline_propagation_log SET LOGGED;

-- Keep the _fast versions as UNLOGGED for performance mode
-- These are used when durability='performance' in config
-- (They already exist from migration 007)

-- Create a function that returns the appropriate table name based on mode
CREATE OR REPLACE FUNCTION get_values_table(use_unlogged BOOLEAN DEFAULT FALSE)
RETURNS TEXT AS $$
BEGIN
  IF use_unlogged THEN
    RETURN 'bassline_contact_values_fast';
  ELSE
    RETURN 'bassline_contact_values';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update our append functions to support both modes
CREATE OR REPLACE FUNCTION append_contact_value(
  p_network_id TEXT,
  p_group_id TEXT,
  p_contact_id TEXT,
  p_content_value TEXT,
  p_content_type TEXT DEFAULT 'json',
  p_use_unlogged BOOLEAN DEFAULT FALSE
) RETURNS BIGINT AS $$
DECLARE
  v_version BIGINT;
  v_table_name TEXT;
BEGIN
  -- Get next version
  v_version := nextval('bassline_version_seq');
  
  -- Insert to appropriate table based on mode
  IF p_use_unlogged THEN
    -- Performance mode - use unlogged table
    INSERT INTO bassline_contact_values_fast (
      network_id, group_id, contact_id, version, content_value, content_type
    ) VALUES (
      p_network_id, p_group_id, p_contact_id, v_version, p_content_value, p_content_type
    );
    
    -- Update version tracker (also unlogged)
    INSERT INTO bassline_contact_versions_fast (
      network_id, group_id, contact_id, latest_version
    ) VALUES (
      p_network_id, p_group_id, p_contact_id, v_version
    )
    ON CONFLICT (network_id, group_id, contact_id)
    DO UPDATE SET 
      latest_version = v_version,
      updated_at = NOW();
  ELSE
    -- Full durability mode - use logged tables
    INSERT INTO bassline_contact_values (
      network_id, group_id, contact_id, version, content_value, content_type
    ) VALUES (
      p_network_id, p_group_id, p_contact_id, v_version, p_content_value, p_content_type
    );
    
    -- Update version tracker (logged)
    INSERT INTO bassline_contact_versions (
      network_id, group_id, contact_id, latest_version
    ) VALUES (
      p_network_id, p_group_id, p_contact_id, v_version
    )
    ON CONFLICT (network_id, group_id, contact_id)
    DO UPDATE SET 
      latest_version = v_version,
      updated_at = NOW();
  END IF;
  
  RETURN v_version;
END;
$$ LANGUAGE plpgsql;

-- Update batch append to support both modes
CREATE OR REPLACE FUNCTION batch_append_values(
  p_values JSONB[],
  p_use_unlogged BOOLEAN DEFAULT FALSE
) RETURNS TABLE(version BIGINT) AS $$
DECLARE
  v_base_version BIGINT;
  v_count INT;
BEGIN
  v_count := array_length(p_values, 1);
  
  -- Reserve version numbers in bulk
  v_base_version := nextval('bassline_version_seq');
  PERFORM setval('bassline_version_seq', v_base_version + v_count - 1);
  
  IF p_use_unlogged THEN
    -- Insert to unlogged table
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
    
    -- Update version trackers
    INSERT INTO bassline_contact_versions_fast AS v (
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
    WHERE v.latest_version < EXCLUDED.latest_version;
  ELSE
    -- Insert to logged table
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
    
    -- Update version trackers
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
    WHERE v.latest_version < EXCLUDED.latest_version;
  END IF;
  
  -- Return versions
  RETURN QUERY
  SELECT generate_series(v_base_version, v_base_version + v_count - 1);
END;
$$ LANGUAGE plpgsql;

-- Update get_latest_value to support both modes
CREATE OR REPLACE FUNCTION get_latest_value(
  p_network_id TEXT,
  p_group_id TEXT,
  p_contact_id TEXT,
  p_use_unlogged BOOLEAN DEFAULT FALSE
) RETURNS TABLE(
  content_value TEXT,
  content_type TEXT,
  version BIGINT
) AS $$
BEGIN
  IF p_use_unlogged THEN
    RETURN QUERY
    SELECT cv.content_value, cv.content_type, cv.version
    FROM bassline_contact_values_fast cv
    JOIN bassline_contact_versions_fast ver 
      ON cv.network_id = ver.network_id 
      AND cv.group_id = ver.group_id 
      AND cv.contact_id = ver.contact_id
      AND cv.version = ver.latest_version
    WHERE cv.network_id = p_network_id
      AND cv.group_id = p_group_id
      AND cv.contact_id = p_contact_id
      AND NOT cv.subsumed
    LIMIT 1;
  ELSE
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
      AND NOT cv.subsumed
    LIMIT 1;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create wrapper functions that respect the application's default mode
-- These will be removed in favor of the parameterized versions
DROP FUNCTION IF EXISTS append_value_unlogged;
DROP FUNCTION IF EXISTS batch_append_unlogged;

-- Add comments
COMMENT ON FUNCTION append_contact_value IS 'Append a value with configurable durability (LOGGED vs UNLOGGED)';
COMMENT ON FUNCTION batch_append_values IS 'Batch append values with configurable durability';
COMMENT ON FUNCTION get_latest_value IS 'Get latest value from appropriate table based on durability mode';

-- Performance comparison view updated
CREATE OR REPLACE VIEW bassline_storage_comparison AS
SELECT 
  'LOGGED (Durable)' as mode,
  COUNT(*) as total_records,
  pg_size_pretty(pg_total_relation_size('bassline_contact_values')) as table_size,
  'Full durability, crash-safe, slower writes' as description
FROM bassline_contact_values
UNION ALL
SELECT 
  'UNLOGGED (Performance)' as mode,
  COUNT(*) as total_records,
  pg_size_pretty(pg_total_relation_size('bassline_contact_values_fast')) as table_size,
  'No durability, data lost on crash, faster writes' as description
FROM bassline_contact_values_fast;