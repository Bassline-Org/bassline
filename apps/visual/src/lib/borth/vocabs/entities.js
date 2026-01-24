// entities vocab - Database entity operations with hookable lifecycle
/* global window */
import { Vocab } from '../primitives.js'

export function createEntitiesVocab(rt) {
  const vocab = new Vocab('entities')
  const saved = rt.current
  rt.current = vocab

  // Helper to get current project ID
  const projectId = () => {
    if (!rt._projectId) {
      throw new Error('No project context set. Call setProject() first.')
    }
    return rt._projectId
  }

  // Helper to run lifecycle hooks
  const runHooks = async (phase, event, data) => {
    const hookKey = `${phase}:${event}`
    const handlers = rt._hooks?.[hookKey]
    if (!handlers) return
    for (const handler of handlers) {
      await rt.runFresh(handler, data)
    }
  }

  // === Entity CRUD ===

  // <entity> ( -- entity ) Create a new entity
  rt.def('<entity>', async () => {
    const result = await window.bl.put(
      { path: `/projects/${projectId()}/entities` },
      {}
    )
    const entity = result.body
    await runHooks('after', 'create', entity)
    return [entity]
  })

  // .destroy ( entity -- ) Delete an entity
  rt.def('.destroy', async entity => {
    await runHooks('before', 'destroy', entity)

    await window.bl.put(
      { path: `/projects/${projectId()}/entities/${entity.id}` },
      null
    )

    await runHooks('after', 'destroy', entity.id)
  })

  // === Attribute Access ===

  // .attr ( entity key -- value ) Get an attribute
  rt.def('.attr', async (entity, key) => {
    const result = await window.bl.get(
      { path: `/projects/${projectId()}/entities/${entity.id}/attrs` }
    )
    return [result.body?.[key] ?? null]
  })

  // .attr! ( entity key value -- ) Set an attribute
  rt.def('.attr!', async (entity, key, value) => {
    await window.bl.put(
      { path: `/projects/${projectId()}/entities/${entity.id}/attrs/${key}` },
      value
    )
  })

  // .attrs ( entity -- attrs ) Get all attributes
  rt.def('.attrs', async entity => {
    const result = await window.bl.get(
      { path: `/projects/${projectId()}/entities/${entity.id}/attrs` }
    )
    return [result.body ?? {}]
  })

  // .attrs! ( entity attrs -- ) Set multiple attributes
  rt.def('.attrs!', async (entity, attrs) => {
    await window.bl.put(
      { path: `/projects/${projectId()}/entities/${entity.id}/attrs` },
      attrs
    )
  })

  // === Relationships ===

  // .connect ( from to kind -- relationship ) Create a relationship
  rt.def('.connect', async (from, to, kind) => {
    const result = await window.bl.put(
      { path: `/projects/${projectId()}/relationships` },
      { from_entity: from.id, to_entity: to.id, kind }
    )
    return [result.body]
  })

  // .disconnect ( from to -- ) Remove relationship(s) between two entities
  rt.def('.disconnect', async (from, to) => {
    const rels = await window.db.query(
      'SELECT id FROM relationships WHERE project_id = ? AND from_entity = ? AND to_entity = ?',
      [projectId(), from.id, to.id]
    )
    if (rels.data) {
      for (const rel of rels.data) {
        await window.bl.put(
          { path: `/projects/${projectId()}/relationships/${rel.id}` },
          null
        )
      }
    }
  })

  // .outgoing ( entity kind -- entities ) Get entities connected from this entity
  rt.def('.outgoing', async (entity, kind) => {
    const result = await window.db.query(
      `SELECT e.id, e.project_id, e.created_at, e.modified_at,
         json_group_object(a.key,
           COALESCE(a.string_value, a.number_value, a.json_value)) as attrs_json
       FROM relationships r
       JOIN entities e ON r.to_entity = e.id
       LEFT JOIN attrs a ON e.id = a.entity_id
       WHERE r.from_entity = ? AND r.kind = ? AND r.project_id = ?
       GROUP BY e.id`,
      [entity.id, kind, projectId()]
    )
    if (!result.data) return [[]]
    return [result.data.map(r => ({
      ...r,
      attrs: parseAttrs(r.attrs_json)
    }))]
  })

  // .incoming ( entity kind -- entities ) Get entities connected to this entity
  rt.def('.incoming', async (entity, kind) => {
    const result = await window.db.query(
      `SELECT e.id, e.project_id, e.created_at, e.modified_at,
         json_group_object(a.key,
           COALESCE(a.string_value, a.number_value, a.json_value)) as attrs_json
       FROM relationships r
       JOIN entities e ON r.from_entity = e.id
       LEFT JOIN attrs a ON e.id = a.entity_id
       WHERE r.to_entity = ? AND r.kind = ? AND r.project_id = ?
       GROUP BY e.id`,
      [entity.id, kind, projectId()]
    )
    if (!result.data) return [[]]
    return [result.data.map(r => ({
      ...r,
      attrs: parseAttrs(r.attrs_json)
    }))]
  })

  // === Query ===

  // entities ( -- entities ) Get all entities in current project
  rt.def('entities', async () => {
    const result = await window.db.query(
      `SELECT e.id, e.project_id, e.created_at, e.modified_at,
         json_group_object(a.key,
           COALESCE(a.string_value, a.number_value, a.json_value)) as attrs_json
       FROM entities e
       LEFT JOIN attrs a ON e.id = a.entity_id
       WHERE e.project_id = ?
       GROUP BY e.id`,
      [projectId()]
    )
    if (!result.data) return [[]]
    return [result.data.map(r => ({
      ...r,
      attrs: parseAttrs(r.attrs_json)
    }))]
  })

  // entity ( id -- entity ) Get entity by ID
  rt.def('entity', async id => {
    const result = await window.bl.get(
      { path: `/projects/${projectId()}/entities/${id}` }
    )
    if (result.headers.condition === 'not-found') {
      return [null]
    }
    return [result.body]
  })

  // === Lifecycle Hooks ===

  // .before ( event handler -- ) Register a before hook
  rt.def('.before', (event, handler) => {
    rt._hooks = rt._hooks || {}
    const key = `before:${event}`
    rt._hooks[key] = rt._hooks[key] || []
    rt._hooks[key].push(handler)
  })

  // .after ( event handler -- ) Register an after hook
  rt.def('.after', (event, handler) => {
    rt._hooks = rt._hooks || {}
    const key = `after:${event}`
    rt._hooks[key] = rt._hooks[key] || []
    rt._hooks[key].push(handler)
  })

  // clear-hooks ( -- ) Clear all entity lifecycle hooks
  rt.def('clear-hooks', () => {
    rt._hooks = {}
  })

  rt.current = saved
  return vocab
}

// Helper to parse JSON attrs, handling null/empty
function parseAttrs(attrsJson) {
  if (!attrsJson) return {}
  try {
    const parsed = JSON.parse(attrsJson)
    // Handle case where json_group_object returns {null: null} for no attrs
    if (parsed && Object.keys(parsed).length === 1 && parsed[null] === null) {
      return {}
    }
    return parsed
  } catch {
    return {}
  }
}
