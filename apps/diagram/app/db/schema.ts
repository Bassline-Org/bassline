import {
  pgTable,
  uuid,
  text,
  real,
  boolean,
  bigserial,
  timestamp,
  primaryKey,
  jsonb,
  unique,
  index,
} from 'drizzle-orm/pg-core'

// ============================================
// STRUCTURE — what exists and what connects
// ============================================

export const spines = pgTable('spines', {
  id: uuid('id').primaryKey().defaultRandom(),
  layerId: uuid('layer_id').references(() => ontologies.id),
})

export const handles = pgTable(
  'handles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    spineId: uuid('spine_id')
      .notNull()
      .references(() => spines.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
  },
  t => [unique().on(t.spineId, t.name)]
)

export const lines = pgTable('lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  sourceHandleId: uuid('source_handle_id')
    .notNull()
    .references(() => handles.id, { onDelete: 'cascade' }),
  targetHandleId: uuid('target_handle_id')
    .notNull()
    .references(() => handles.id, { onDelete: 'cascade' }),
})

// ============================================
// SEMANTICS — facts independent of the viewer
// ============================================

export const ontologies = pgTable('ontologies', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  color: text('color'),
})

export const annotations = pgTable(
  'annotations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entityId: uuid('entity_id').notNull(),
    entityType: text('entity_type').notNull(),
    kind: text('kind').notNull(),
    textValue: text('text_value'),
    jsonValue: jsonb('json_value'),
    urlValue: text('url_value'),
    refId: uuid('ref_id'),
    refType: text('ref_type'),
    numberValue: real('number_value'),
    boolValue: boolean('bool_value'),
  },
  t => [
    index('annotations_entity_kind_idx').on(t.entityId, t.kind),
    index('annotations_kind_idx').on(t.kind),
    index('annotations_ref_idx').on(t.refId),
  ]
)

// ============================================
// CAPABILITIES — registered programs
// ============================================

export const capabilities = pgTable('capabilities', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  url: text('url').notNull(),
  description: text('description'),
  triggerOn: text('trigger_on').notNull(),
})

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
// TASKS — ephemeral pending work
// ============================================

export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  capabilityId: uuid('capability_id')
    .notNull()
    .references(() => capabilities.id, { onDelete: 'cascade' }),
  entityId: uuid('entity_id').notNull(),
  entityType: text('entity_type').notNull(),
  triggerEditId: bigserial('trigger_edit_id', { mode: 'number' }),
  context: jsonb('context'),
})

export const taskFailures = pgTable('task_failures', {
  id: uuid('id').primaryKey().defaultRandom(),
  capabilityId: uuid('capability_id')
    .notNull()
    .references(() => capabilities.id, { onDelete: 'cascade' }),
  entityId: uuid('entity_id').notNull(),
  entityType: text('entity_type').notNull(),
  triggerEditId: bigserial('trigger_edit_id', { mode: 'number' }),
  context: jsonb('context'),
  error: text('error'),
  failedAt: timestamp('failed_at', { withTimezone: true }).notNull().defaultNow(),
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
