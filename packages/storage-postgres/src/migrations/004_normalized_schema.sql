-- Migration 004: Normalized Schema
-- Redesigns tables to use proper normalization with minimal JSONB usage

-- Drop old views and functions that depend on old schema
DROP MATERIALIZED VIEW IF EXISTS bassline_network_size_stats CASCADE;
DROP VIEW IF EXISTS bassline_network_stats CASCADE;
DROP FUNCTION IF EXISTS get_group_size_stats(TEXT);
DROP FUNCTION IF EXISTS refresh_network_stats();

-- Create new normalized tables

-- Networks table (minimal)
CREATE TABLE IF NOT EXISTS bassline_networks_v2 (
  id TEXT PRIMARY KEY,
  root_group_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Groups table (minimal)
CREATE TABLE IF NOT EXISTS bassline_groups_v2 (
  network_id TEXT NOT NULL REFERENCES bassline_networks_v2(id) ON DELETE CASCADE,
  group_id TEXT NOT NULL,
  parent_group_id TEXT,
  group_type TEXT DEFAULT 'standard', -- 'standard', 'primitive', etc
  primitive_type TEXT, -- 'add', 'multiply', etc if group_type = 'primitive'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (network_id, group_id)
);

-- Group attributes table (EAV pattern for flexibility)
CREATE TABLE IF NOT EXISTS bassline_group_attributes (
  network_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  attribute_key TEXT NOT NULL,
  attribute_value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (network_id, group_id, attribute_key),
  FOREIGN KEY (network_id, group_id) REFERENCES bassline_groups_v2(network_id, group_id) ON DELETE CASCADE
);

-- Contacts table (minimal, no JSONB for content)
CREATE TABLE IF NOT EXISTS bassline_contacts_v2 (
  network_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  contact_id TEXT NOT NULL,
  contact_type TEXT DEFAULT 'standard', -- 'input', 'output', 'standard'
  blend_mode TEXT DEFAULT 'accept-last', -- 'accept-last', 'merge', etc
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (network_id, group_id, contact_id),
  FOREIGN KEY (network_id, group_id) REFERENCES bassline_groups_v2(network_id, group_id) ON DELETE CASCADE
);

-- Contact content table (separate for better performance)
CREATE TABLE IF NOT EXISTS bassline_contact_content (
  network_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  contact_id TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'json', -- 'json', 'text', 'number', 'boolean'
  content_value TEXT, -- Store as text, parse based on content_type
  content_size INTEGER GENERATED ALWAYS AS (octet_length(content_value)) STORED,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (network_id, group_id, contact_id),
  FOREIGN KEY (network_id, group_id, contact_id) 
    REFERENCES bassline_contacts_v2(network_id, group_id, contact_id) ON DELETE CASCADE
);

-- Wires table (connections between contacts)
CREATE TABLE IF NOT EXISTS bassline_wires (
  network_id TEXT NOT NULL,
  wire_id TEXT NOT NULL,
  from_group_id TEXT NOT NULL,
  from_contact_id TEXT NOT NULL,
  to_group_id TEXT NOT NULL,
  to_contact_id TEXT NOT NULL,
  wire_type TEXT DEFAULT 'bidirectional', -- 'bidirectional', 'forward', 'backward'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (network_id, wire_id),
  FOREIGN KEY (network_id, from_group_id, from_contact_id) 
    REFERENCES bassline_contacts_v2(network_id, group_id, contact_id) ON DELETE CASCADE,
  FOREIGN KEY (network_id, to_group_id, to_contact_id) 
    REFERENCES bassline_contacts_v2(network_id, group_id, contact_id) ON DELETE CASCADE
);

-- Boundary contacts mapping
CREATE TABLE IF NOT EXISTS bassline_boundary_contacts (
  network_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  boundary_type TEXT NOT NULL, -- 'input' or 'output'
  boundary_name TEXT NOT NULL,
  contact_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (network_id, group_id, boundary_type, boundary_name),
  FOREIGN KEY (network_id, group_id, contact_id) 
    REFERENCES bassline_contacts_v2(network_id, group_id, contact_id) ON DELETE CASCADE
);

-- Snapshots table (still uses JSONB for full state capture)
CREATE TABLE IF NOT EXISTS bassline_snapshots_v2 (
  network_id TEXT NOT NULL REFERENCES bassline_networks_v2(id) ON DELETE CASCADE,
  snapshot_id TEXT NOT NULL,
  label TEXT,
  state JSONB NOT NULL, -- Full state for restore
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (network_id, snapshot_id)
);

-- Create indexes for performance

-- Groups indexes
CREATE INDEX IF NOT EXISTS idx_groups_v2_parent ON bassline_groups_v2(network_id, parent_group_id);
CREATE INDEX IF NOT EXISTS idx_groups_v2_type ON bassline_groups_v2(group_type, primitive_type);
CREATE INDEX IF NOT EXISTS idx_groups_v2_updated ON bassline_groups_v2(updated_at DESC);

-- Attributes indexes
CREATE INDEX IF NOT EXISTS idx_attributes_key ON bassline_group_attributes(attribute_key);
CREATE INDEX IF NOT EXISTS idx_attributes_value ON bassline_group_attributes(attribute_value);
CREATE INDEX IF NOT EXISTS idx_attributes_key_value ON bassline_group_attributes(attribute_key, attribute_value);

-- Contacts indexes
CREATE INDEX IF NOT EXISTS idx_contacts_v2_type ON bassline_contacts_v2(contact_type);
CREATE INDEX IF NOT EXISTS idx_contacts_v2_updated ON bassline_contacts_v2(updated_at DESC);

-- Content indexes
CREATE INDEX IF NOT EXISTS idx_content_size ON bassline_contact_content(content_size);
CREATE INDEX IF NOT EXISTS idx_content_type ON bassline_contact_content(content_type);
CREATE INDEX IF NOT EXISTS idx_content_updated ON bassline_contact_content(updated_at DESC);

-- Wires indexes
CREATE INDEX IF NOT EXISTS idx_wires_from ON bassline_wires(network_id, from_group_id, from_contact_id);
CREATE INDEX IF NOT EXISTS idx_wires_to ON bassline_wires(network_id, to_group_id, to_contact_id);
CREATE INDEX IF NOT EXISTS idx_wires_type ON bassline_wires(wire_type);

-- Boundary indexes
CREATE INDEX IF NOT EXISTS idx_boundary_contact ON bassline_boundary_contacts(network_id, group_id, contact_id);
CREATE INDEX IF NOT EXISTS idx_boundary_type ON bassline_boundary_contacts(boundary_type);

-- Create materialized view for statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS bassline_network_stats_v2 AS
SELECT 
  n.id as network_id,
  COUNT(DISTINCT g.group_id) as group_count,
  COUNT(DISTINCT c.contact_id) as contact_count,
  COUNT(DISTINCT w.wire_id) as wire_count,
  COALESCE(SUM(cc.content_size), 0) as total_content_bytes,
  MAX(GREATEST(n.updated_at, g.updated_at, c.updated_at)) as last_updated
FROM bassline_networks_v2 n
LEFT JOIN bassline_groups_v2 g ON n.id = g.network_id
LEFT JOIN bassline_contacts_v2 c ON g.network_id = c.network_id AND g.group_id = c.group_id
LEFT JOIN bassline_contact_content cc ON c.network_id = cc.network_id 
  AND c.group_id = cc.group_id AND c.contact_id = cc.contact_id
LEFT JOIN bassline_wires w ON n.id = w.network_id
GROUP BY n.id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_network_stats_v2_id ON bassline_network_stats_v2(network_id);

-- Function to check group limits
CREATE OR REPLACE FUNCTION check_group_limits_v2()
RETURNS TRIGGER AS $$
DECLARE
  contact_count INTEGER;
  group_count INTEGER;
  max_contacts INTEGER := 10000; -- configurable
  max_groups INTEGER := 1000; -- configurable
BEGIN
  IF TG_TABLE_NAME = 'bassline_contacts_v2' THEN
    -- Check contact limit for group
    SELECT COUNT(*) INTO contact_count
    FROM bassline_contacts_v2
    WHERE network_id = NEW.network_id AND group_id = NEW.group_id;
    
    IF contact_count >= max_contacts THEN
      RAISE EXCEPTION 'Group contact limit (%) exceeded', max_contacts;
    END IF;
  ELSIF TG_TABLE_NAME = 'bassline_groups_v2' THEN
    -- Check group limit for network
    SELECT COUNT(*) INTO group_count
    FROM bassline_groups_v2
    WHERE network_id = NEW.network_id;
    
    IF group_count >= max_groups THEN
      RAISE EXCEPTION 'Network group limit (%) exceeded', max_groups;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for limits (disabled by default)
-- CREATE TRIGGER check_contact_limits BEFORE INSERT ON bassline_contacts_v2
-- FOR EACH ROW EXECUTE FUNCTION check_group_limits_v2();

-- CREATE TRIGGER check_group_limits BEFORE INSERT ON bassline_groups_v2
-- FOR EACH ROW EXECUTE FUNCTION check_group_limits_v2();

-- Add update triggers
CREATE TRIGGER update_networks_v2_updated_at 
BEFORE UPDATE ON bassline_networks_v2
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_groups_v2_updated_at 
BEFORE UPDATE ON bassline_groups_v2
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contacts_v2_updated_at 
BEFORE UPDATE ON bassline_contacts_v2
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_content_updated_at 
BEFORE UPDATE ON bassline_contact_content
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();