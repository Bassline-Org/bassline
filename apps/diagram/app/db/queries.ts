import { eq, and, inArray } from 'drizzle-orm'
import { db } from './connection'
import {
  spines,
  lines,
  ontologies,
  spineOntologies,
  lineOntologies,
  spineMarks,
  diagrams,
  diagramSpines,
  diagramLines,
} from './schema'
import type { Node, Edge } from '@xyflow/react'

// ============================================
// Types
// ============================================

type HandleInfo = { id: string; role: 'source' | 'target' }

type NodeData = {
  label: string | null
  ontologies: { name: string; color: string | null }[]
  marks: string[]
  expanded: boolean
  handles: HandleInfo[]
}
export type ReactFlowNode = Node<NodeData>
export type ReactFlowEdge = Edge<EdgeData>

type EdgeData = {
  label: string | null
  ontologies: { name: string; color: string | null }[]
}

// ============================================
// Materialize — core read query
// ============================================

export async function materialize(diagramId: string): Promise<{ nodes: ReactFlowNode[]; edges: ReactFlowEdge[] }> {
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

  // Fetch ontologies for all spines in this diagram
  const spineOnts =
    spineIds.length > 0
      ? await db
          .select({
            spineId: spineOntologies.spineId,
            name: ontologies.name,
            color: ontologies.color,
          })
          .from(spineOntologies)
          .innerJoin(ontologies, eq(spineOntologies.ontologyId, ontologies.id))
          .where(inArray(spineOntologies.spineId, spineIds))
      : []

  // Fetch marks for all spines
  const markRows =
    spineIds.length > 0
      ? await db
          .select({ spineId: spineMarks.spineId, mark: spineMarks.mark })
          .from(spineMarks)
          .where(inArray(spineMarks.spineId, spineIds))
      : []

  // Group ontologies and marks by spine
  const ontsBySpine = new Map<string, { name: string; color: string | null }[]>()
  for (const row of spineOnts) {
    const list = ontsBySpine.get(row.spineId) ?? []
    list.push({ name: row.name, color: row.color })
    ontsBySpine.set(row.spineId, list)
  }

  const marksBySpine = new Map<string, string[]>()
  for (const row of markRows) {
    const list = marksBySpine.get(row.spineId) ?? []
    list.push(row.mark)
    marksBySpine.set(row.spineId, list)
  }

  // Fetch lines in this diagram (before nodes, so we can derive handles)
  const lineRows = await db
    .select({
      lineId: diagramLines.lineId,
      lineLabel: diagramLines.label,
      sourceSpine: lines.sourceSpine,
      sourceHandle: lines.sourceHandle,
      targetSpine: lines.targetSpine,
      targetHandle: lines.targetHandle,
    })
    .from(diagramLines)
    .innerJoin(lines, eq(diagramLines.lineId, lines.id))
    .where(eq(diagramLines.diagramId, diagramId))

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

  // Derive handles per spine from line connections
  // Handle IDs are namespaced as "source:name" / "target:name" so they're unique per node
  const handlesBySpine = new Map<string, HandleInfo[]>()
  for (const l of lineRows) {
    const srcList = handlesBySpine.get(l.sourceSpine) ?? []
    const srcId = `source:${l.sourceHandle}`
    if (!srcList.some(h => h.id === srcId)) {
      srcList.push({ id: srcId, role: 'source' })
    }
    handlesBySpine.set(l.sourceSpine, srcList)

    const tgtList = handlesBySpine.get(l.targetSpine) ?? []
    const tgtId = `target:${l.targetHandle}`
    if (!tgtList.some(h => h.id === tgtId)) {
      tgtList.push({ id: tgtId, role: 'target' })
    }
    handlesBySpine.set(l.targetSpine, tgtList)
  }

  const nodes: ReactFlowNode[] = spineRows.map(s => {
    const onts = ontsBySpine.get(s.spineId) ?? []
    return {
      id: s.spineId,
      type: 'spine',
      position: { x: s.x, y: s.y },
      data: {
        label: s.label,
        ontologies: onts,
        marks: marksBySpine.get(s.spineId) ?? [],
        expanded: s.expanded,
        handles: handlesBySpine.get(s.spineId) ?? [],
      },
      width: s.width ?? undefined,
      height: s.height ?? undefined,
    }
  })

  const edges: ReactFlowEdge[] = lineRows.map(l => ({
    id: l.lineId,
    type: 'line',
    source: l.sourceSpine,
    target: l.targetSpine,
    sourceHandle: `source:${l.sourceHandle}`,
    targetHandle: `target:${l.targetHandle}`,
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
// CRUD — Lines
// ============================================

export async function createLine(
  diagramId: string,
  sourceSpine: string,
  sourceHandle: string,
  targetSpine: string,
  targetHandle: string
) {
  const [line] = await db.insert(lines).values({ sourceSpine, sourceHandle, targetSpine, targetHandle }).returning()
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
