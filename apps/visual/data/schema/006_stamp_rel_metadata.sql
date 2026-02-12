-- Add metadata columns to stamp_relationships table
-- These match the columns in the main relationships table for full preservation

ALTER TABLE stamp_relationships ADD COLUMN label TEXT;
ALTER TABLE stamp_relationships ADD COLUMN binding_name TEXT;
ALTER TABLE stamp_relationships ADD COLUMN from_port TEXT;
ALTER TABLE stamp_relationships ADD COLUMN to_port TEXT;
