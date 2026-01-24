-- Boot card support for projects
-- Projects can have a boot_card_id that runs on project open

ALTER TABLE projects ADD COLUMN boot_card_id TEXT;
