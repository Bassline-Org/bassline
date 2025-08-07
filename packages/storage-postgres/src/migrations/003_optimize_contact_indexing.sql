-- Migration 003: Optimize Contact Indexing
-- Improves query performance for contact lookups by group

-- Add index for efficient group-based contact queries
CREATE INDEX IF NOT EXISTS idx_contacts_by_group 
  ON bassline_contacts (network_id, group_id);

-- Add index for contact lookup by ID pattern (useful for queries)
CREATE INDEX IF NOT EXISTS idx_contacts_by_id 
  ON bassline_contacts (contact_id);

-- Composite index for counting contacts per group
CREATE INDEX IF NOT EXISTS idx_contacts_group_count 
  ON bassline_contacts (network_id, group_id, contact_id);

-- Add partial index for contacts with non-null content
CREATE INDEX IF NOT EXISTS idx_contacts_with_content 
  ON bassline_contacts (network_id, group_id) 
  WHERE content IS NOT NULL;

-- Create a function to enforce contact limits per group
CREATE OR REPLACE FUNCTION check_group_contact_limit()
RETURNS TRIGGER AS $$
DECLARE
  contact_count INTEGER;
  max_contacts_per_group INTEGER := 10000; -- Configurable limit
BEGIN
  -- Count existing contacts in the group
  SELECT COUNT(*) INTO contact_count
  FROM bassline_contacts
  WHERE network_id = NEW.network_id 
    AND group_id = NEW.group_id;
  
  -- Check if limit would be exceeded
  IF contact_count >= max_contacts_per_group THEN
    RAISE EXCEPTION 'Group contact limit exceeded. Maximum % contacts allowed per group.', max_contacts_per_group
      USING ERRCODE = '22000'; -- Data exception
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger for contact limits (disabled by default, uncomment to enable)
-- CREATE TRIGGER enforce_group_contact_limit
-- BEFORE INSERT ON bassline_contacts
-- FOR EACH ROW EXECUTE FUNCTION check_group_contact_limit();

-- Create a function to get group size statistics
CREATE OR REPLACE FUNCTION get_group_size_stats(p_network_id TEXT)
RETURNS TABLE (
  group_id TEXT,
  contact_count BIGINT,
  total_size_bytes BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.group_id,
    COUNT(c.contact_id) as contact_count,
    SUM(pg_column_size(c.content)) as total_size_bytes
  FROM bassline_contacts c
  WHERE c.network_id = p_network_id
  GROUP BY c.group_id
  ORDER BY contact_count DESC;
END;
$$ LANGUAGE plpgsql;

-- Create a materialized view for network statistics (refresh periodically)
CREATE MATERIALIZED VIEW IF NOT EXISTS bassline_network_size_stats AS
SELECT 
  network_id,
  COUNT(DISTINCT group_id) as group_count,
  COUNT(*) as total_contacts,
  SUM(pg_column_size(content)) as total_content_size_bytes,
  MAX(updated_at) as last_updated
FROM bassline_contacts
GROUP BY network_id;

-- Create index on the materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_network_size_stats_network 
  ON bassline_network_size_stats (network_id);

-- Function to refresh network stats
CREATE OR REPLACE FUNCTION refresh_network_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY bassline_network_size_stats;
END;
$$ LANGUAGE plpgsql;

-- Add comment documentation
COMMENT ON FUNCTION check_group_contact_limit() IS 
  'Enforces a maximum number of contacts per group to prevent unbounded growth';
COMMENT ON FUNCTION get_group_size_stats(TEXT) IS 
  'Returns size statistics for all groups in a network';
COMMENT ON MATERIALIZED VIEW bassline_network_size_stats IS 
  'Cached network size statistics for performance monitoring';