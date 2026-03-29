-- Prevent duplicate lines between the same two handles (undirected)
CREATE UNIQUE INDEX IF NOT EXISTS lines_unique_handles
  ON lines (LEAST(source_handle_id, target_handle_id), GREATEST(source_handle_id, target_handle_id));

-- Edit log trigger function
-- Automatically captures INSERT/UPDATE/DELETE into the edits table
CREATE OR REPLACE FUNCTION log_edit() RETURNS TRIGGER AS $$
DECLARE
  rid UUID;
  rec RECORD;
BEGIN
  rec := COALESCE(NEW, OLD);
  -- Tables with an id column use it; join tables get a generated UUID
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

-- Attach triggers to all structural tables
CREATE OR REPLACE TRIGGER spines_edit
  AFTER INSERT OR UPDATE OR DELETE ON spines
  FOR EACH ROW EXECUTE FUNCTION log_edit();

CREATE OR REPLACE TRIGGER handles_edit
  AFTER INSERT OR UPDATE OR DELETE ON handles
  FOR EACH ROW EXECUTE FUNCTION log_edit();

CREATE OR REPLACE TRIGGER lines_edit
  AFTER INSERT OR UPDATE OR DELETE ON lines
  FOR EACH ROW EXECUTE FUNCTION log_edit();

-- Attach triggers to all semantic tables
CREATE OR REPLACE TRIGGER ontologies_edit
  AFTER INSERT OR UPDATE OR DELETE ON ontologies
  FOR EACH ROW EXECUTE FUNCTION log_edit();

CREATE OR REPLACE TRIGGER spine_ontologies_edit
  AFTER INSERT OR UPDATE OR DELETE ON spine_ontologies
  FOR EACH ROW EXECUTE FUNCTION log_edit();

CREATE OR REPLACE TRIGGER line_ontologies_edit
  AFTER INSERT OR UPDATE OR DELETE ON line_ontologies
  FOR EACH ROW EXECUTE FUNCTION log_edit();

CREATE OR REPLACE TRIGGER spine_marks_edit
  AFTER INSERT OR UPDATE OR DELETE ON spine_marks
  FOR EACH ROW EXECUTE FUNCTION log_edit();

-- Attach triggers to all perspective tables
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
