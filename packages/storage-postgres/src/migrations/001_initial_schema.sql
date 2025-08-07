-- Migration 001: Initial Schema
-- Creates the base tables and indexes for Bassline PostgreSQL storage

-- Networks table
CREATE TABLE IF NOT EXISTS bassline_networks (
  id TEXT PRIMARY KEY,
  state JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Groups table  
CREATE TABLE IF NOT EXISTS bassline_groups (
  network_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  state JSONB NOT NULL,
  search_vector TSVECTOR,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (network_id, group_id)
);

-- Add foreign key if not exists (PostgreSQL doesn't have IF NOT EXISTS for constraints)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'bassline_groups_network_fkey'
  ) THEN
    ALTER TABLE bassline_groups 
    ADD CONSTRAINT bassline_groups_network_fkey 
    FOREIGN KEY (network_id) REFERENCES bassline_networks(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Contacts table
CREATE TABLE IF NOT EXISTS bassline_contacts (
  network_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  contact_id TEXT NOT NULL,
  content JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (network_id, group_id, contact_id)
);

-- Add foreign key if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'bassline_contacts_group_fkey'
  ) THEN
    ALTER TABLE bassline_contacts 
    ADD CONSTRAINT bassline_contacts_group_fkey 
    FOREIGN KEY (network_id, group_id) REFERENCES bassline_groups(network_id, group_id) ON DELETE CASCADE;
  END IF;
END $$;

-- Snapshots table
CREATE TABLE IF NOT EXISTS bassline_snapshots (
  network_id TEXT NOT NULL,
  snapshot_id TEXT NOT NULL,
  label TEXT,
  state JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (network_id, snapshot_id)
);

-- Add foreign key if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'bassline_snapshots_network_fkey'
  ) THEN
    ALTER TABLE bassline_snapshots 
    ADD CONSTRAINT bassline_snapshots_network_fkey 
    FOREIGN KEY (network_id) REFERENCES bassline_networks(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_networks_state_gin ON bassline_networks USING GIN (state);
CREATE INDEX IF NOT EXISTS idx_networks_created_at ON bassline_networks (created_at);
CREATE INDEX IF NOT EXISTS idx_networks_updated_at ON bassline_networks (updated_at);

CREATE INDEX IF NOT EXISTS idx_groups_state_gin ON bassline_groups USING GIN (state);
CREATE INDEX IF NOT EXISTS idx_groups_search ON bassline_groups USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS idx_groups_created_at ON bassline_groups (network_id, created_at);

CREATE INDEX IF NOT EXISTS idx_contacts_content_gin ON bassline_contacts USING GIN (content);
CREATE INDEX IF NOT EXISTS idx_contacts_created_at ON bassline_contacts (network_id, group_id, created_at);

CREATE INDEX IF NOT EXISTS idx_snapshots_created_at ON bassline_snapshots (network_id, created_at DESC);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at (with IF NOT EXISTS check)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_bassline_networks_updated_at'
  ) THEN
    CREATE TRIGGER update_bassline_networks_updated_at 
    BEFORE UPDATE ON bassline_networks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_bassline_groups_updated_at'
  ) THEN
    CREATE TRIGGER update_bassline_groups_updated_at 
    BEFORE UPDATE ON bassline_groups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_bassline_contacts_updated_at'
  ) THEN
    CREATE TRIGGER update_bassline_contacts_updated_at 
    BEFORE UPDATE ON bassline_contacts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Create full-text search update trigger
CREATE OR REPLACE FUNCTION update_group_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', 
    COALESCE(NEW.state->>'name', '') || ' ' ||
    COALESCE(NEW.state->'group'->'attributes'->>'description', '') || ' ' ||
    COALESCE(NEW.state->'group'->'attributes'->>'bassline.description', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add full-text search trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_group_search_vector_trigger'
  ) THEN
    CREATE TRIGGER update_group_search_vector_trigger 
    BEFORE INSERT OR UPDATE ON bassline_groups
    FOR EACH ROW EXECUTE FUNCTION update_group_search_vector();
  END IF;
END $$;