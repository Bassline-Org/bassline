import { eq, and, inArray, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { db } from './connection'
import {
  spines,
  handles,
  lines,
  ontologies,
  spineOntologies,
  lineOntologies,
  spineMarks,
  diagrams,
  diagramSpines,
  diagramLines,
  edits,
} from './schema'
// ============================================
// Types
// ============================================

export type HandleData = { id: string; name: string }

export type NodeData = {
  label: string | null
  ontologies: { name: string; color: string | null }[]
  marks: string[]
  expanded: boolean
  handles: HandleData[]
}

export type EdgeData = {
  label: string | null
  ontologies: { name: string; color: string | null }[]
}

// Plain serializable types for loader data (no ReactNode fields)
export type ReactFlowNode = {
  id: string
  type: string
  position: { x: number; y: number }
  data: NodeData
  width?: number
  height?: number
}

export type ReactFlowEdge = {
  id: string
  type: string
  source: string
  target: string
  sourceHandle: string
  targetHandle: string
  data: EdgeData
}

// ============================================
// Materialize — core read query
// ============================================

export async function materialize(diagramId: string): Promise<{ nodes: ReactFlowNode[]; edges: ReactFlowEdge[] }> {
  // 1. Get spines in this diagram
  const spineRows = await db
    .select({
      spineId: diagramSpines.spineId,
      x: diagramSpines.x,
      y: diagramSpines.y,
      width: diagramSpines.width,
      height: diagramSpines.height,
      label: diagramSpines.label,
      expanded: diagramSpines.expanded,
    })
    .from(diagramSpines)
    .where(eq(diagramSpines.diagramId, diagramId))

  const spineIds = spineRows.map(s => s.spineId)
  if (spineIds.length === 0) return { nodes: [], edges: [] }

  // 2. Get handles for all spines (from handles table, not derived)
  const handleRows = await db
    .select({ id: handles.id, spineId: handles.spineId, name: handles.name })
    .from(handles)
    .where(inArray(handles.spineId, spineIds))

  const handlesBySpine = new Map<string, HandleData[]>()
  for (const h of handleRows) {
    const list = handlesBySpine.get(h.spineId) ?? []
    list.push({ id: h.id, name: h.name })
    handlesBySpine.set(h.spineId, list)
  }

  // 3. Get spine ontologies
  const spineOnts = await db
    .select({
      spineId: spineOntologies.spineId,
      name: ontologies.name,
      color: ontologies.color,
    })
    .from(spineOntologies)
    .innerJoin(ontologies, eq(spineOntologies.ontologyId, ontologies.id))
    .where(inArray(spineOntologies.spineId, spineIds))

  const ontsBySpine = new Map<string, { name: string; color: string | null }[]>()
  for (const row of spineOnts) {
    const list = ontsBySpine.get(row.spineId) ?? []
    list.push({ name: row.name, color: row.color })
    ontsBySpine.set(row.spineId, list)
  }

  // 4. Get spine marks
  const markRows = await db
    .select({ spineId: spineMarks.spineId, mark: spineMarks.mark })
    .from(spineMarks)
    .where(inArray(spineMarks.spineId, spineIds))

  const marksBySpine = new Map<string, string[]>()
  for (const row of markRows) {
    const list = marksBySpine.get(row.spineId) ?? []
    list.push(row.mark)
    marksBySpine.set(row.spineId, list)
  }

  // 5. Get lines — join through handles to get spine IDs
  const sourceHandle = alias(handles, 'source_handle')
  const targetHandle = alias(handles, 'target_handle')

  const lineRows = await db
    .select({
      lineId: diagramLines.lineId,
      lineLabel: diagramLines.label,
      sourceHandleId: lines.sourceHandleId,
      targetHandleId: lines.targetHandleId,
      sourceSpine: sourceHandle.spineId,
      targetSpine: targetHandle.spineId,
    })
    .from(diagramLines)
    .innerJoin(lines, eq(diagramLines.lineId, lines.id))
    .innerJoin(sourceHandle, eq(lines.sourceHandleId, sourceHandle.id))
    .innerJoin(targetHandle, eq(lines.targetHandleId, targetHandle.id))
    .where(eq(diagramLines.diagramId, diagramId))

  // 6. Get line ontologies
  const lineIds = lineRows.map(l => l.lineId)
  const lineOnts =
    lineIds.length > 0
      ? await db
          .select({
            lineId: lineOntologies.lineId,
            name: ontologies.name,
            color: ontologies.color,
          })
          .from(lineOntologies)
          .innerJoin(ontologies, eq(lineOntologies.ontologyId, ontologies.id))
          .where(inArray(lineOntologies.lineId, lineIds))
      : []

  const ontsByLine = new Map<string, { name: string; color: string | null }[]>()
  for (const row of lineOnts) {
    const list = ontsByLine.get(row.lineId) ?? []
    list.push({ name: row.name, color: row.color })
    ontsByLine.set(row.lineId, list)
  }

  // 7. Build nodes
  const nodes: ReactFlowNode[] = spineRows.map(s => ({
    id: s.spineId,
    type: 'spine',
    position: { x: s.x, y: s.y },
    data: {
      label: s.label,
      ontologies: ontsBySpine.get(s.spineId) ?? [],
      marks: marksBySpine.get(s.spineId) ?? [],
      expanded: s.expanded,
      handles: handlesBySpine.get(s.spineId) ?? [],
    },
    width: s.width ?? undefined,
    height: s.height ?? undefined,
  }))

  // 8. Build edges — handle IDs go directly to React Flow
  const edges: ReactFlowEdge[] = lineRows.map(l => ({
    id: l.lineId,
    type: 'line',
    source: l.sourceSpine,
    target: l.targetSpine,
    sourceHandle: l.sourceHandleId,
    targetHandle: l.targetHandleId,
    data: {
      label: l.lineLabel,
      ontologies: ontsByLine.get(l.lineId) ?? [],
    },
  }))

  return { nodes, edges }
}

// ============================================
// CRUD — Diagrams
// ============================================

export async function listDiagrams() {
  return db.select().from(diagrams)
}

export async function getDiagram(id: string) {
  const [row] = await db.select().from(diagrams).where(eq(diagrams.id, id))
  return row ?? null
}

export async function createDiagram(name: string) {
  const [row] = await db.insert(diagrams).values({ name }).returning()
  return row
}

// ============================================
// CRUD — Ontologies
// ============================================

export async function listOntologies() {
  return db.select().from(ontologies)
}

export async function createOntology(name: string, color: string | null) {
  const [row] = await db.insert(ontologies).values({ name, color }).returning()
  return row
}

// ============================================
// CRUD — Spines
// ============================================

export async function createSpine(diagramId: string, x: number, y: number, label?: string) {
  const [spine] = await db.insert(spines).values({}).returning()
  await db.insert(diagramSpines).values({ diagramId, spineId: spine.id, x, y, label })
  // Every spine gets a default handle
  await db.insert(handles).values({ spineId: spine.id, name: 'default' })
  return spine
}

export async function deleteSpine(spineId: string) {
  await db.delete(spines).where(eq(spines.id, spineId))
}

export async function updateSpinePosition(diagramId: string, spineId: string, x: number, y: number) {
  await db
    .update(diagramSpines)
    .set({ x, y })
    .where(and(eq(diagramSpines.diagramId, diagramId), eq(diagramSpines.spineId, spineId)))
}

export async function updateSpineLabel(diagramId: string, spineId: string, label: string | null) {
  await db
    .update(diagramSpines)
    .set({ label })
    .where(and(eq(diagramSpines.diagramId, diagramId), eq(diagramSpines.spineId, spineId)))
}

// ============================================
// CRUD — Handles
// ============================================

export async function createHandle(spineId: string, name: string) {
  const [row] = await db.insert(handles).values({ spineId, name }).returning()
  return row
}

export async function getHandleByName(spineId: string, name: string) {
  const [row] = await db
    .select()
    .from(handles)
    .where(and(eq(handles.spineId, spineId), eq(handles.name, name)))
  return row ?? null
}

export async function deleteHandle(handleId: string) {
  await db.delete(handles).where(eq(handles.id, handleId))
}

// ============================================
// CRUD — Lines
// ============================================

export async function createLine(diagramId: string, sourceHandleId: string, targetHandleId: string) {
  const [line] = await db.insert(lines).values({ sourceHandleId, targetHandleId }).returning()
  await db.insert(diagramLines).values({ diagramId, lineId: line.id })
  return line
}

export async function deleteLine(lineId: string) {
  await db.delete(lines).where(eq(lines.id, lineId))
}

// ============================================
// CRUD — Ontology associations
// ============================================

export async function setSpineOntology(spineId: string, ontologyId: string) {
  await db.insert(spineOntologies).values({ spineId, ontologyId }).onConflictDoNothing()
}

export async function removeSpineOntology(spineId: string, ontologyId: string) {
  await db
    .delete(spineOntologies)
    .where(and(eq(spineOntologies.spineId, spineId), eq(spineOntologies.ontologyId, ontologyId)))
}

export async function setLineOntology(lineId: string, ontologyId: string) {
  await db.insert(lineOntologies).values({ lineId, ontologyId }).onConflictDoNothing()
}

export async function removeLineOntology(lineId: string, ontologyId: string) {
  await db
    .delete(lineOntologies)
    .where(and(eq(lineOntologies.lineId, lineId), eq(lineOntologies.ontologyId, ontologyId)))
}

// ============================================
// Inspection — thing detail queries
// ============================================

export async function getSpine(id: string) {
  const [row] = await db.select().from(spines).where(eq(spines.id, id))
  return row ?? null
}

export async function getHandlesForSpine(spineId: string) {
  return db.select().from(handles).where(eq(handles.spineId, spineId))
}

export async function getSpineOntologies(spineId: string) {
  return db
    .select({ id: ontologies.id, name: ontologies.name, color: ontologies.color })
    .from(spineOntologies)
    .innerJoin(ontologies, eq(spineOntologies.ontologyId, ontologies.id))
    .where(eq(spineOntologies.spineId, spineId))
}

export async function getSpineMarks(spineId: string) {
  return db.select({ mark: spineMarks.mark }).from(spineMarks).where(eq(spineMarks.spineId, spineId))
}

export async function getLinesForSpine(spineId: string) {
  const sourceHandle = alias(handles, 'sh')
  const targetHandle = alias(handles, 'th')

  return db
    .select({
      lineId: lines.id,
      sourceHandleId: lines.sourceHandleId,
      targetHandleId: lines.targetHandleId,
      sourceSpineId: sourceHandle.spineId,
      targetSpineId: targetHandle.spineId,
      sourceHandleName: sourceHandle.name,
      targetHandleName: targetHandle.name,
    })
    .from(lines)
    .innerJoin(sourceHandle, eq(lines.sourceHandleId, sourceHandle.id))
    .innerJoin(targetHandle, eq(lines.targetHandleId, targetHandle.id))
    .where(sql`${sourceHandle.spineId} = ${spineId} OR ${targetHandle.spineId} = ${spineId}`)
}

export async function getDiagramsForSpine(spineId: string) {
  return db
    .select({ id: diagrams.id, name: diagrams.name, label: diagramSpines.label })
    .from(diagramSpines)
    .innerJoin(diagrams, eq(diagramSpines.diagramId, diagrams.id))
    .where(eq(diagramSpines.spineId, spineId))
}

export async function getHandle(id: string) {
  const [row] = await db.select().from(handles).where(eq(handles.id, id))
  return row ?? null
}

export async function getLinesForHandle(handleId: string) {
  const sourceHandle = alias(handles, 'sh')
  const targetHandle = alias(handles, 'th')

  return db
    .select({
      lineId: lines.id,
      sourceHandleId: lines.sourceHandleId,
      targetHandleId: lines.targetHandleId,
      sourceSpineId: sourceHandle.spineId,
      targetSpineId: targetHandle.spineId,
      sourceHandleName: sourceHandle.name,
      targetHandleName: targetHandle.name,
    })
    .from(lines)
    .innerJoin(sourceHandle, eq(lines.sourceHandleId, sourceHandle.id))
    .innerJoin(targetHandle, eq(lines.targetHandleId, targetHandle.id))
    .where(sql`${lines.sourceHandleId} = ${handleId} OR ${lines.targetHandleId} = ${handleId}`)
}

export async function getLine(id: string) {
  const sourceHandle = alias(handles, 'sh')
  const targetHandle = alias(handles, 'th')

  const [row] = await db
    .select({
      id: lines.id,
      sourceHandleId: lines.sourceHandleId,
      targetHandleId: lines.targetHandleId,
      sourceSpineId: sourceHandle.spineId,
      targetSpineId: targetHandle.spineId,
      sourceHandleName: sourceHandle.name,
      targetHandleName: targetHandle.name,
    })
    .from(lines)
    .innerJoin(sourceHandle, eq(lines.sourceHandleId, sourceHandle.id))
    .innerJoin(targetHandle, eq(lines.targetHandleId, targetHandle.id))
    .where(eq(lines.id, id))

  return row ?? null
}

export async function getLineOntologies(lineId: string) {
  return db
    .select({ id: ontologies.id, name: ontologies.name, color: ontologies.color })
    .from(lineOntologies)
    .innerJoin(ontologies, eq(lineOntologies.ontologyId, ontologies.id))
    .where(eq(lineOntologies.lineId, lineId))
}

export async function getOntology(id: string) {
  const [row] = await db.select().from(ontologies).where(eq(ontologies.id, id))
  return row ?? null
}

export async function getSpinesWithOntology(ontologyId: string) {
  return db
    .select({ id: spines.id, label: diagramSpines.label })
    .from(spineOntologies)
    .innerJoin(spines, eq(spineOntologies.spineId, spines.id))
    .leftJoin(diagramSpines, eq(spines.id, diagramSpines.spineId))
    .where(eq(spineOntologies.ontologyId, ontologyId))
}

export async function getLinesWithOntology(ontologyId: string) {
  const sourceHandle = alias(handles, 'sh')
  const targetHandle = alias(handles, 'th')

  return db
    .select({
      id: lines.id,
      sourceSpineId: sourceHandle.spineId,
      targetSpineId: targetHandle.spineId,
    })
    .from(lineOntologies)
    .innerJoin(lines, eq(lineOntologies.lineId, lines.id))
    .innerJoin(sourceHandle, eq(lines.sourceHandleId, sourceHandle.id))
    .innerJoin(targetHandle, eq(lines.targetHandleId, targetHandle.id))
    .where(eq(lineOntologies.ontologyId, ontologyId))
}

export async function getEditsForEntity(entityId: string, limit = 10) {
  return db
    .select()
    .from(edits)
    .where(eq(edits.rowId, entityId))
    .orderBy(sql`${edits.ts} DESC`)
    .limit(limit)
}
