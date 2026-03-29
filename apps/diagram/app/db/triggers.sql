-- Prevent duplicate lines between the same two handles (undirected)
CREATE UNIQUE INDEX IF NOT EXISTS lines_unique_handles
  ON lines (LEAST(source_handle_id, target_handle_id), GREATEST(source_handle_id, target_handle_id));

-- Edit log trigger function
CREATE OR REPLACE FUNCTION log_edit() RETURNS TRIGGER AS $$
DECLARE
  rid UUID;
  rec RECORD;
BEGIN
  rec := COALESCE(NEW, OLD);
  BEGIN
    EXECUTE format('SELECT ($1).id') INTO rid USING rec;
  EXCEPTION WHEN undefined_column THEN
    rid := gen_random_uuid();
  END;
  INSERT INTO edits (table_name, row_id, op, before, after)
  VALUES (
    TG_TABLE_NAME,
    rid,
    lower(TG_OP),
    CASE WHEN TG_OP != 'INSERT' THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP != 'DELETE' THEN to_jsonb(NEW) END
  );
  RETURN rec;
END;
$$ LANGUAGE plpgsql;

-- Structure
CREATE OR REPLACE TRIGGER spines_edit
  AFTER INSERT OR UPDATE OR DELETE ON spines
  FOR EACH ROW EXECUTE FUNCTION log_edit();

CREATE OR REPLACE TRIGGER handles_edit
  AFTER INSERT OR UPDATE OR DELETE ON handles
  FOR EACH ROW EXECUTE FUNCTION log_edit();

CREATE OR REPLACE TRIGGER lines_edit
  AFTER INSERT OR UPDATE OR DELETE ON lines
  FOR EACH ROW EXECUTE FUNCTION log_edit();

-- Semantics
CREATE OR REPLACE TRIGGER ontologies_edit
  AFTER INSERT OR UPDATE OR DELETE ON ontologies
  FOR EACH ROW EXECUTE FUNCTION log_edit();

CREATE OR REPLACE TRIGGER annotations_edit
  AFTER INSERT OR UPDATE OR DELETE ON annotations
  FOR EACH ROW EXECUTE FUNCTION log_edit();

-- Capabilities
CREATE OR REPLACE TRIGGER capabilities_edit
  AFTER INSERT OR UPDATE OR DELETE ON capabilities
  FOR EACH ROW EXECUTE FUNCTION log_edit();

-- Perspective
CREATE OR REPLACE TRIGGER diagrams_edit
  AFTER INSERT OR UPDATE OR DELETE ON diagrams
  FOR EACH ROW EXECUTE FUNCTION log_edit();

CREATE OR REPLACE TRIGGER diagram_spines_edit
  AFTER INSERT OR UPDATE OR DELETE ON diagram_spines
  FOR EACH ROW EXECUTE FUNCTION log_edit();

CREATE OR REPLACE TRIGGER diagram_lines_edit
  AFTER INSERT OR UPDATE OR DELETE ON diagram_lines
  FOR EACH ROW EXECUTE FUNCTION log_edit();

CREATE OR REPLACE TRIGGER regions_edit
  AFTER INSERT OR UPDATE OR DELETE ON regions
  FOR EACH ROW EXECUTE FUNCTION log_edit();

CREATE OR REPLACE TRIGGER region_spines_edit
  AFTER INSERT OR UPDATE OR DELETE ON region_spines
  FOR EACH ROW EXECUTE FUNCTION log_edit();

CREATE OR REPLACE TRIGGER expansions_edit
  AFTER INSERT OR UPDATE OR DELETE ON expansions
  FOR EACH ROW EXECUTE FUNCTION log_edit();

-- Tasks (log tasks and failures for audit)
CREATE OR REPLACE TRIGGER tasks_edit
  AFTER INSERT OR UPDATE OR DELETE ON tasks
  FOR EACH ROW EXECUTE FUNCTION log_edit();

CREATE OR REPLACE TRIGGER task_failures_edit
  AFTER INSERT OR UPDATE OR DELETE ON task_failures
  FOR EACH ROW EXECUTE FUNCTION log_edit();
