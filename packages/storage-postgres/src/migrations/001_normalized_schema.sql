-- Migration 001: Normalized Schema
-- Creates properly normalized tables for Bassline storage with efficient indexing

-- Enable pgcrypto extension for hash functions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Networks table (top level)
CREATE TABLE bassline_networks (
  id TEXT PRIMARY KEY,
  name TEXT,
  description TEXT,
  attributes JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Groups table (normalized - metadata only)
CREATE TABLE bassline_groups (
  network_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  name TEXT,
  description TEXT,
  group_type TEXT DEFAULT 'regular', -- 'regular', 'primitive', 'sub-bassline'
  boundary_contact_ids TEXT[], -- Array of boundary contact IDs
  attributes JSONB DEFAULT '{}', -- For custom attributes
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (network_id, group_id),
  FOREIGN KEY (network_id) REFERENCES bassline_networks(id) ON DELETE CASCADE
);

-- Contacts table (normalized)
CREATE TABLE bassline_contacts (
  network_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  contact_id TEXT NOT NULL,
  name TEXT,
  blend_mode TEXT DEFAULT 'accept-last',
  is_boundary BOOLEAN DEFAULT FALSE,
  boundary_direction TEXT, -- 'input', 'output', null
  content JSONB,
  content_hash TEXT, -- For change detection and gossip
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (network_id, group_id, contact_id),
  FOREIGN KEY (network_id, group_id) REFERENCES bassline_groups(network_id, group_id) ON DELETE CASCADE
);

-- Wires table (topology connections)
CREATE TABLE bassline_wires (
  network_id TEXT NOT NULL,
  wire_id TEXT NOT NULL,
  from_contact_id TEXT NOT NULL,
  from_group_id TEXT NOT NULL,
  to_contact_id TEXT NOT NULL,
  to_group_id TEXT NOT NULL,
  wire_type TEXT DEFAULT 'bidirectional', -- 'bidirectional', 'directed'
  priority INTEGER DEFAULT 1,
  attributes JSONB DEFAULT '{}', -- For custom wire attributes
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (network_id, wire_id),
  FOREIGN KEY (network_id, from_group_id) REFERENCES bassline_groups(network_id, group_id) ON DELETE CASCADE,
  FOREIGN KEY (network_id, to_group_id) REFERENCES bassline_groups(network_id, group_id) ON DELETE CASCADE,
  FOREIGN KEY (network_id, from_group_id, from_contact_id) REFERENCES bassline_contacts(network_id, group_id, contact_id) ON DELETE CASCADE,
  FOREIGN KEY (network_id, to_group_id, to_contact_id) REFERENCES bassline_contacts(network_id, group_id, contact_id) ON DELETE CASCADE
);

-- Snapshots table
CREATE TABLE bassline_snapshots (
  network_id TEXT NOT NULL,
  snapshot_id TEXT NOT NULL,
  label TEXT,
  snapshot_data JSONB NOT NULL, -- Full network state at snapshot time
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (network_id, snapshot_id),
  FOREIGN KEY (network_id) REFERENCES bassline_networks(id) ON DELETE CASCADE
);

-- Performance indexes
-- Networks
CREATE INDEX idx_networks_created_at ON bassline_networks (created_at);
CREATE INDEX idx_networks_attributes_gin ON bassline_networks USING GIN (attributes);

-- Groups  
CREATE INDEX idx_groups_network_type ON bassline_groups (network_id, group_type);
CREATE INDEX idx_groups_attributes_gin ON bassline_groups USING GIN (attributes);
CREATE INDEX idx_groups_boundary_gin ON bassline_groups USING GIN (boundary_contact_ids);
CREATE INDEX idx_groups_created_at ON bassline_groups (network_id, created_at);

-- Contacts
CREATE INDEX idx_contacts_network_group ON bassline_contacts (network_id, group_id);
CREATE INDEX idx_contacts_content_gin ON bassline_contacts USING GIN (content);
CREATE INDEX idx_contacts_hash ON bassline_contacts (network_id, content_hash);
CREATE INDEX idx_contacts_boundary ON bassline_contacts (network_id, is_boundary, boundary_direction);
CREATE INDEX idx_contacts_created_at ON bassline_contacts (network_id, group_id, created_at);

-- Wires
CREATE INDEX idx_wires_network ON bassline_wires (network_id);
CREATE INDEX idx_wires_from_contact ON bassline_wires (network_id, from_group_id, from_contact_id);
CREATE INDEX idx_wires_to_contact ON bassline_wires (network_id, to_group_id, to_contact_id);
CREATE INDEX idx_wires_topology ON bassline_wires (network_id, from_contact_id, to_contact_id);

-- Snapshots
CREATE INDEX idx_snapshots_created_at ON bassline_snapshots (network_id, created_at DESC);

-- Timestamp update trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Timestamp update triggers
CREATE TRIGGER update_bassline_networks_updated_at 
  BEFORE UPDATE ON bassline_networks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bassline_groups_updated_at 
  BEFORE UPDATE ON bassline_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bassline_contacts_updated_at 
  BEFORE UPDATE ON bassline_contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Content hash calculation function
CREATE OR REPLACE FUNCTION calculate_content_hash()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.content IS NOT NULL THEN
    NEW.content_hash := encode(digest(NEW.content::text, 'sha256'), 'hex');
  ELSE
    NEW.content_hash := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Auto-calculate content hashes
CREATE TRIGGER calculate_content_hash_trigger 
  BEFORE INSERT OR UPDATE ON bassline_contacts
  FOR EACH ROW EXECUTE FUNCTION calculate_content_hash();

-- Useful views for querying

-- View for easy group state reconstruction (maintains compatibility with old format)
CREATE VIEW bassline_group_states AS
SELECT 
  g.network_id,
  g.group_id,
  g.name,
  g.description,
  g.group_type,
  g.boundary_contact_ids,
  g.attributes,
  g.created_at,
  g.updated_at,
  COALESCE(
    json_agg(
      json_build_object(
        'contact_id', c.contact_id,
        'name', c.name,
        'blend_mode', c.blend_mode,
        'is_boundary', c.is_boundary,
        'boundary_direction', c.boundary_direction,
        'content', c.content,
        'content_hash', c.content_hash,
        'updated_at', c.updated_at
      ) ORDER BY c.contact_id
    ) FILTER (WHERE c.contact_id IS NOT NULL),
    '[]'::json
  ) AS contacts,
  COALESCE(
    (
      SELECT json_agg(
        json_build_object(
          'wire_id', w.wire_id,
          'from_contact_id', w.from_contact_id,
          'from_group_id', w.from_group_id,
          'to_contact_id', w.to_contact_id,
          'to_group_id', w.to_group_id,
          'wire_type', w.wire_type,
          'priority', w.priority,
          'attributes', w.attributes
        )
      )
      FROM bassline_wires w
      WHERE w.network_id = g.network_id 
        AND (w.from_group_id = g.group_id OR w.to_group_id = g.group_id)
    ),
    '[]'::json
  ) AS wires
FROM bassline_groups g
LEFT JOIN bassline_contacts c ON g.network_id = c.network_id AND g.group_id = c.group_id
GROUP BY g.network_id, g.group_id, g.name, g.description, g.group_type, g.boundary_contact_ids, g.attributes, g.created_at, g.updated_at;

-- Network topology overview
CREATE VIEW bassline_network_topology AS
SELECT 
  n.id as network_id,
  n.name as network_name,
  n.created_at as network_created_at,
  n.updated_at as network_updated_at,
  COUNT(DISTINCT g.group_id) as group_count,
  COUNT(DISTINCT c.contact_id) as contact_count,
  COUNT(DISTINCT w.wire_id) as wire_count,
  array_agg(DISTINCT g.group_id ORDER BY g.group_id) as group_ids
FROM bassline_networks n
LEFT JOIN bassline_groups g ON n.id = g.network_id
LEFT JOIN bassline_contacts c ON n.id = c.network_id
LEFT JOIN bassline_wires w ON n.id = w.network_id
GROUP BY n.id, n.name, n.created_at, n.updated_at;