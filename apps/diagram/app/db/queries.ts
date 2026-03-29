import { eq, and, inArray, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { db } from './connection'
import {
  spines,
  handles,
  lines,
  ontologies,
  annotations,
  capabilities,
  diagrams,
  diagramSpines,
  diagramLines,
  tasks,
  taskFailures,
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

  // Handles from handles table
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

  // Spine ontologies via annotations
  const spineOnts = await db
    .select({
      entityId: annotations.entityId,
      name: ontologies.name,
      color: ontologies.color,
    })
    .from(annotations)
    .innerJoin(ontologies, eq(annotations.refId, ontologies.id))
    .where(
      and(
        inArray(annotations.entityId, spineIds),
        eq(annotations.entityType, 'spine'),
        eq(annotations.kind, 'ontology')
      )
    )

  const ontsBySpine = new Map<string, { name: string; color: string | null }[]>()
  for (const row of spineOnts) {
    const list = ontsBySpine.get(row.entityId) ?? []
    list.push({ name: row.name, color: row.color })
    ontsBySpine.set(row.entityId, list)
  }

  // Spine marks via annotations
  const markRows = await db
    .select({ entityId: annotations.entityId, mark: annotations.textValue })
    .from(annotations)
    .where(
      and(inArray(annotations.entityId, spineIds), eq(annotations.entityType, 'spine'), eq(annotations.kind, 'mark'))
    )

  const marksBySpine = new Map<string, string[]>()
  for (const row of markRows) {
    if (!row.mark) continue
    const list = marksBySpine.get(row.entityId) ?? []
    list.push(row.mark)
    marksBySpine.set(row.entityId, list)
  }

  // Lines via handles
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

  // Line ontologies via annotations
  const lineIds = lineRows.map(l => l.lineId)
  const lineOnts =
    lineIds.length > 0
      ? await db
          .select({
            entityId: annotations.entityId,
            name: ontologies.name,
            color: ontologies.color,
          })
          .from(annotations)
          .innerJoin(ontologies, eq(annotations.refId, ontologies.id))
          .where(
            and(
              inArray(annotations.entityId, lineIds),
              eq(annotations.entityType, 'line'),
              eq(annotations.kind, 'ontology')
            )
          )
      : []

  const ontsByLine = new Map<string, { name: string; color: string | null }[]>()
  for (const row of lineOnts) {
    const list = ontsByLine.get(row.entityId) ?? []
    list.push({ name: row.name, color: row.color })
    ontsByLine.set(row.entityId, list)
  }

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

export async function getOntology(id: string) {
  const [row] = await db.select().from(ontologies).where(eq(ontologies.id, id))
  return row ?? null
}

export async function createOntology(name: string, color: string | null) {
  const [row] = await db.insert(ontologies).values({ name, color }).returning()
  return row
}

// ============================================
// CRUD — Spines
// ============================================

export async function createSpine(diagramId: string, x: number, y: number, label?: string, layerId?: string) {
  const [spine] = await db.insert(spines).values({ layerId }).returning()
  await db.insert(diagramSpines).values({ diagramId, spineId: spine.id, x, y, label })
  await db.insert(handles).values({ spineId: spine.id, name: 'default' })
  return spine
}

export async function getSpine(id: string) {
  const [row] = await db.select().from(spines).where(eq(spines.id, id))
  return row ?? null
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

export async function getHandle(id: string) {
  const [row] = await db.select().from(handles).where(eq(handles.id, id))
  return row ?? null
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

export async function getHandlesForSpine(spineId: string) {
  return db.select().from(handles).where(eq(handles.spineId, spineId))
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

// ============================================
// Annotations — general metadata on any thing
// ============================================

export async function createAnnotation(
  entityId: string,
  entityType: string,
  kind: string,
  values: {
    textValue?: string
    jsonValue?: unknown
    urlValue?: string
    refId?: string
    refType?: string
    numberValue?: number
    boolValue?: boolean
  } = {}
) {
  const [row] = await db
    .insert(annotations)
    .values({
      entityId,
      entityType,
      kind,
      textValue: values.textValue,
      jsonValue: values.jsonValue,
      urlValue: values.urlValue,
      refId: values.refId,
      refType: values.refType,
      numberValue: values.numberValue,
      boolValue: values.boolValue,
    })
    .returning()
  return row
}

export async function getAnnotation(id: string) {
  const [row] = await db.select().from(annotations).where(eq(annotations.id, id))
  return row ?? null
}

export async function getAnnotationsForEntity(entityId: string, kind?: string) {
  const conditions = [eq(annotations.entityId, entityId)]
  if (kind) conditions.push(eq(annotations.kind, kind))
  return db
    .select()
    .from(annotations)
    .where(and(...conditions))
}

export async function deleteAnnotation(id: string) {
  await db.delete(annotations).where(eq(annotations.id, id))
}

// Ontology-specific annotation helpers (convenience wrappers)
export async function getEntityOntologies(entityId: string, entityType: string) {
  return db
    .select({ id: ontologies.id, name: ontologies.name, color: ontologies.color })
    .from(annotations)
    .innerJoin(ontologies, eq(annotations.refId, ontologies.id))
    .where(
      and(eq(annotations.entityId, entityId), eq(annotations.entityType, entityType), eq(annotations.kind, 'ontology'))
    )
}

export async function setEntityOntology(entityId: string, entityType: string, ontologyId: string) {
  return createAnnotation(entityId, entityType, 'ontology', { refId: ontologyId, refType: 'ontology' })
}

export async function removeEntityOntology(entityId: string, entityType: string, ontologyId: string) {
  await db
    .delete(annotations)
    .where(
      and(
        eq(annotations.entityId, entityId),
        eq(annotations.entityType, entityType),
        eq(annotations.kind, 'ontology'),
        eq(annotations.refId, ontologyId)
      )
    )
}

export async function getEntityMarks(entityId: string) {
  const rows = await db
    .select({ mark: annotations.textValue })
    .from(annotations)
    .where(and(eq(annotations.entityId, entityId), eq(annotations.kind, 'mark')))
  return rows.filter(r => r.mark != null).map(r => ({ mark: r.mark! }))
}

// Cross-entity queries
export async function getSpinesWithOntology(ontologyId: string) {
  return db
    .select({ id: annotations.entityId, label: diagramSpines.label })
    .from(annotations)
    .leftJoin(diagramSpines, eq(annotations.entityId, diagramSpines.spineId))
    .where(
      and(eq(annotations.kind, 'ontology'), eq(annotations.refId, ontologyId), eq(annotations.entityType, 'spine'))
    )
}

export async function getLinesWithOntology(ontologyId: string) {
  const sourceHandle = alias(handles, 'sh')
  const targetHandle = alias(handles, 'th')
  return db
    .select({
      id: annotations.entityId,
      sourceSpineId: sourceHandle.spineId,
      targetSpineId: targetHandle.spineId,
    })
    .from(annotations)
    .innerJoin(lines, eq(annotations.entityId, lines.id))
    .innerJoin(sourceHandle, eq(lines.sourceHandleId, sourceHandle.id))
    .innerJoin(targetHandle, eq(lines.targetHandleId, targetHandle.id))
    .where(and(eq(annotations.kind, 'ontology'), eq(annotations.refId, ontologyId), eq(annotations.entityType, 'line')))
}

// ============================================
// Inspection — thing detail queries
// ============================================

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

export async function getEditsForEntity(entityId: string, limit = 10) {
  return db
    .select()
    .from(edits)
    .where(eq(edits.rowId, entityId))
    .orderBy(sql`${edits.ts} DESC`)
    .limit(limit)
}

// ============================================
// Capabilities
// ============================================

export async function listCapabilities() {
  return db.select().from(capabilities)
}

export async function getCapability(id: string) {
  const [row] = await db.select().from(capabilities).where(eq(capabilities.id, id))
  return row ?? null
}

export async function createCapability(name: string, url: string, description: string | null, triggerOn: string) {
  const [row] = await db.insert(capabilities).values({ name, url, description, triggerOn }).returning()
  return row
}

export async function attachCapability(entityId: string, entityType: string, capabilityId: string) {
  return createAnnotation(entityId, entityType, 'capability', { refId: capabilityId, refType: 'capability' })
}

export async function getCapabilitiesForEntity(entityId: string) {
  return db
    .select({
      annotationId: annotations.id,
      capabilityId: capabilities.id,
      name: capabilities.name,
      url: capabilities.url,
      description: capabilities.description,
      triggerOn: capabilities.triggerOn,
    })
    .from(annotations)
    .innerJoin(capabilities, eq(annotations.refId, capabilities.id))
    .where(and(eq(annotations.entityId, entityId), eq(annotations.kind, 'capability')))
}

// ============================================
// Tasks
// ============================================

export async function queueTask(
  capabilityId: string,
  entityId: string,
  entityType: string,
  triggerEditId?: number,
  context?: unknown
) {
  const [row] = await db
    .insert(tasks)
    .values({ capabilityId, entityId, entityType, triggerEditId, context })
    .returning()
  return row
}

export async function getPendingTasks() {
  return db
    .select({
      id: tasks.id,
      entityId: tasks.entityId,
      entityType: tasks.entityType,
      triggerEditId: tasks.triggerEditId,
      context: tasks.context,
      capabilityId: capabilities.id,
      capabilityName: capabilities.name,
      capabilityUrl: capabilities.url,
    })
    .from(tasks)
    .innerJoin(capabilities, eq(tasks.capabilityId, capabilities.id))
}

export async function clearTask(taskId: string) {
  await db.delete(tasks).where(eq(tasks.id, taskId))
}

export async function clearAllTasks() {
  await db.delete(tasks)
}

export async function recordFailure(
  task: {
    capabilityId: string
    entityId: string
    entityType: string
    triggerEditId?: number | null
    context?: unknown
  },
  error: string
) {
  const [row] = await db
    .insert(taskFailures)
    .values({
      capabilityId: task.capabilityId,
      entityId: task.entityId,
      entityType: task.entityType,
      triggerEditId: task.triggerEditId ?? undefined,
      context: task.context,
      error,
    })
    .returning()
  return row
}

export async function getTaskFailures(limit = 20) {
  return db
    .select({
      id: taskFailures.id,
      entityId: taskFailures.entityId,
      entityType: taskFailures.entityType,
      error: taskFailures.error,
      failedAt: taskFailures.failedAt,
      capabilityId: capabilities.id,
      capabilityName: capabilities.name,
    })
    .from(taskFailures)
    .innerJoin(capabilities, eq(taskFailures.capabilityId, capabilities.id))
    .orderBy(sql`${taskFailures.failedAt} DESC`)
    .limit(limit)
}

export async function retryFailure(failureId: string) {
  const [failure] = await db.select().from(taskFailures).where(eq(taskFailures.id, failureId))
  if (!failure) return null
  const task = await queueTask(
    failure.capabilityId,
    failure.entityId,
    failure.entityType,
    failure.triggerEditId,
    failure.context
  )
  await db.delete(taskFailures).where(eq(taskFailures.id, failureId))
  return task
}

export async function dismissFailure(failureId: string) {
  await db.delete(taskFailures).where(eq(taskFailures.id, failureId))
}

export async function findExistingTask(capabilityId: string, entityId: string) {
  const [row] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.capabilityId, capabilityId), eq(tasks.entityId, entityId)))
  return row ?? null
}

// ============================================
// Change notification — find capabilities and queue tasks
// ============================================

export async function notifyChange(entityType: string, entityId: string, operation: string) {
  // Collect capabilities from the changed entity and related entities
  const allCaps: Awaited<ReturnType<typeof getCapabilitiesForEntity>> = []

  const directCaps = await getCapabilitiesForEntity(entityId)
  allCaps.push(...directCaps)

  // Check related entities for capabilities
  if (entityType === 'line') {
    const line = await getLine(entityId)
    if (line) {
      allCaps.push(...(await getCapabilitiesForEntity(line.sourceHandleId)))
      allCaps.push(...(await getCapabilitiesForEntity(line.targetHandleId)))
    }
  } else if (entityType === 'handle') {
    const handle = await getHandle(entityId)
    if (handle) {
      allCaps.push(...(await getCapabilitiesForEntity(handle.spineId)))
    }
  } else if (entityType === 'spine') {
    const spineHandles = await getHandlesForSpine(entityId)
    for (const h of spineHandles) {
      allCaps.push(...(await getCapabilitiesForEntity(h.id)))
    }
  }

  // Deduplicate by capability ID
  const seen = new Set<string>()
  const uniqueCaps = allCaps.filter(c => {
    if (seen.has(c.capabilityId)) return false
    seen.add(c.capabilityId)
    return true
  })

  for (const cap of uniqueCaps) {
    // Check trigger condition
    if (cap.triggerOn !== operation && cap.triggerOn !== 'change') continue

    // Replace existing task for same capability + entity, or insert new
    const existing = await findExistingTask(cap.capabilityId, entityId)
    if (existing) {
      await clearTask(existing.id)
    }

    await queueTask(cap.capabilityId, entityId, entityType, undefined, { operation })
  }
}
