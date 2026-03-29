import { pgTable, uuid, text, real, boolean, bigserial, timestamp, primaryKey, jsonb } from 'drizzle-orm/pg-core'

// ============================================
// STRUCTURE — what exists and what connects
// ============================================

export const spines = pgTable('spines', {
  id: uuid('id').primaryKey().defaultRandom(),
})

export const lines = pgTable('lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  sourceSpine: uuid('source_spine')
    .notNull()
    .references(() => spines.id, { onDelete: 'cascade' }),
  sourceHandle: text('source_handle').notNull(),
  targetSpine: uuid('target_spine')
    .notNull()
    .references(() => spines.id, { onDelete: 'cascade' }),
  targetHandle: text('target_handle').notNull(),
})

// ============================================
// SEMANTICS — facts independent of the viewer
// ============================================

export const ontologies = pgTable('ontologies', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  color: text('color'),
})

export const spineOntologies = pgTable(
  'spine_ontologies',
  {
    spineId: uuid('spine_id')
      .notNull()
      .references(() => spines.id, { onDelete: 'cascade' }),
    ontologyId: uuid('ontology_id')
      .notNull()
      .references(() => ontologies.id, { onDelete: 'cascade' }),
  },
  t => [primaryKey({ columns: [t.spineId, t.ontologyId] })]
)

export const lineOntologies = pgTable(
  'line_ontologies',
  {
    lineId: uuid('line_id')
      .notNull()
      .references(() => lines.id, { onDelete: 'cascade' }),
    ontologyId: uuid('ontology_id')
      .notNull()
      .references(() => ontologies.id, { onDelete: 'cascade' }),
  },
  t => [primaryKey({ columns: [t.lineId, t.ontologyId] })]
)

export const spineMarks = pgTable(
  'spine_marks',
  {
    spineId: uuid('spine_id')
      .notNull()
      .references(() => spines.id, { onDelete: 'cascade' }),
    mark: text('mark').notNull(),
  },
  t => [primaryKey({ columns: [t.spineId, t.mark] })]
)

// ============================================
// PERSPECTIVE — how things are seen in a diagram
// ============================================

export const diagrams = pgTable('diagrams', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
})

export const diagramSpines = pgTable(
  'diagram_spines',
  {
    diagramId: uuid('diagram_id')
      .notNull()
      .references(() => diagrams.id, { onDelete: 'cascade' }),
    spineId: uuid('spine_id')
      .notNull()
      .references(() => spines.id, { onDelete: 'cascade' }),
    x: real('x').notNull().default(0),
    y: real('y').notNull().default(0),
    width: real('width'),
    height: real('height'),
    label: text('label'),
    expanded: boolean('expanded').notNull().default(false),
  },
  t => [primaryKey({ columns: [t.diagramId, t.spineId] })]
)

export const diagramLines = pgTable(
  'diagram_lines',
  {
    diagramId: uuid('diagram_id')
      .notNull()
      .references(() => diagrams.id, { onDelete: 'cascade' }),
    lineId: uuid('line_id')
      .notNull()
      .references(() => lines.id, { onDelete: 'cascade' }),
    label: text('label'),
  },
  t => [primaryKey({ columns: [t.diagramId, t.lineId] })]
)

export const regions = pgTable('regions', {
  id: uuid('id').primaryKey().defaultRandom(),
  diagramId: uuid('diagram_id')
    .notNull()
    .references(() => diagrams.id, { onDelete: 'cascade' }),
  parentId: uuid('parent_id'),
  label: text('label'),
})

export const regionSpines = pgTable(
  'region_spines',
  {
    regionId: uuid('region_id')
      .notNull()
      .references(() => regions.id, { onDelete: 'cascade' }),
    spineId: uuid('spine_id')
      .notNull()
      .references(() => spines.id, { onDelete: 'cascade' }),
  },
  t => [primaryKey({ columns: [t.regionId, t.spineId] })]
)

export const expansions = pgTable('expansions', {
  spineId: uuid('spine_id')
    .primaryKey()
    .references(() => spines.id, { onDelete: 'cascade' }),
  diagramId: uuid('diagram_id')
    .notNull()
    .references(() => diagrams.id, { onDelete: 'cascade' }),
})

// ============================================
// HISTORY — how understanding changed
// ============================================

export const edits = pgTable('edits', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  ts: timestamp('ts', { withTimezone: true }).notNull().defaultNow(),
  tableName: text('table_name').notNull(),
  rowId: uuid('row_id').notNull(),
  op: text('op').notNull(),
  before: jsonb('before'),
  after: jsonb('after'),
})
