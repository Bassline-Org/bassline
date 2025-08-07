-- Migration 002: Network Statistics View
-- Creates a view for efficient network statistics queries

CREATE OR REPLACE VIEW bassline_network_stats AS
SELECT 
  n.id as network_id,
  n.created_at,
  n.updated_at,
  (SELECT COUNT(*) FROM bassline_groups g WHERE g.network_id = n.id) as group_count,
  (SELECT COUNT(*) FROM bassline_contacts c 
   WHERE c.network_id = n.id) as contact_count,
  (SELECT COUNT(*) FROM bassline_snapshots s WHERE s.network_id = n.id) as snapshot_count,
  pg_column_size(n.state) + 
  COALESCE((SELECT SUM(pg_column_size(g.state)) FROM bassline_groups g WHERE g.network_id = n.id), 0) +
  COALESCE((SELECT SUM(pg_column_size(c.content)) FROM bassline_contacts c WHERE c.network_id = n.id), 0) as total_size_bytes
FROM bassline_networks n;