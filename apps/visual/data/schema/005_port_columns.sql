-- Add port columns to relationships table for port-to-port connections
-- These store which specific port the connection originates from and terminates at

ALTER TABLE relationships ADD COLUMN from_port TEXT;
ALTER TABLE relationships ADD COLUMN to_port TEXT;
