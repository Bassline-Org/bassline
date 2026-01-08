import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import { randomUUID } from 'crypto'
import { runMigrations, seed } from './seed'
import type { AttrType, AttrValue } from '../src/types'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// =============================================================================
// Typed Attribute Helpers
// =============================================================================

interface AttrRow {
  entity_id: string
  key: string
  type: AttrType
  string_value: string | null
  number_value: number | null
  json_value: string | null
  blob_value: Buffer | null
}

/**
 * Deserialize a typed attribute row to its runtime value
 */
function deserializeAttr(row: AttrRow): AttrValue {
  switch (row.type) {
    case 'number':
      return row.number_value ?? 0
    case 'json':
      try {
        return row.json_value ? JSON.parse(row.json_value) : {}
      } catch {
        return {}
      }
    case 'blob':
      return row.blob_value ?? new ArrayBuffer(0)
    default:
      return row.string_value ?? ''
  }
}

/**
 * Serialize a value to typed column values for INSERT
 */
function serializeAttr(value: AttrValue, type: AttrType): {
  string_value: string | null
  number_value: number | null
  json_value: string | null
  blob_value: Buffer | null
} {
  return {
    string_value: type === 'string' ? String(value) : null,
    number_value: type === 'number' ? Number(value) : null,
    json_value: type === 'json' ? JSON.stringify(value) : null,
    blob_value: type === 'blob' ? Buffer.from(value as ArrayBuffer) : null,
  }
}

/**
 * Infer the type from a value for backwards compatibility
 */
function inferAttrType(value: AttrValue): AttrType {
  if (typeof value === 'number') return 'number'
  if (typeof value === 'object' && value !== null) {
    if (value instanceof ArrayBuffer || Buffer.isBuffer(value)) return 'blob'
    return 'json'
  }
  return 'string'
}

/**
 * Deserialize a stamp attr (stored as string value + type) to its runtime value
 */
function deserializeStampAttr(value: string | null, type: AttrType | null): AttrValue {
  if (value === null) return ''
  const attrType = type || 'string'
  switch (attrType) {
    case 'number':
      return parseFloat(value) || 0
    case 'json':
      try {
        return JSON.parse(value)
      } catch {
        return {}
      }
    default:
      return value
  }
}

let database: Database.Database | null = null

function getDb(): Database.Database {
  if (!database) {
    const dbPath = path.join(app.getPath('userData'), 'visual.db')
    database = new Database(dbPath)
    database.pragma('journal_mode = WAL')
    database.pragma('foreign_keys = ON')
  }
  return database
}

export const db = {
  init() {
    const db = getDb()
    const dataDir = app.isPackaged
      ? path.join(process.resourcesPath, 'data')
      : path.join(__dirname, '../data')

    // Always run migrations (idempotent)
    runMigrations(db, dataDir)

    // Always seed themes (idempotent - uses INSERT OR REPLACE)
    seed(db, dataDir)
  },

  // =========================================================================
  // Projects
  // =========================================================================

  projects: {
    list() {
      const db = getDb()
      // Filter out the hidden _stamps project (legacy, can be removed after migration)
      return db.prepare("SELECT * FROM projects WHERE id != '_stamps' ORDER BY modified_at DESC").all()
    },

    get(id: string) {
      const db = getDb()
      return db.prepare('SELECT * FROM projects WHERE id = ?').get(id) || null
    },

    create(name: string) {
      const db = getDb()
      const id = randomUUID()
      const now = Date.now()
      db.prepare('INSERT INTO projects (id, name, created_at, modified_at) VALUES (?, ?, ?, ?)')
        .run(id, name, now, now)

      db.prepare('INSERT INTO ui_state (project_id) VALUES (?)').run(id)

      return { id, name, created_at: now, modified_at: now }
    },

    delete(id: string) {
      const db = getDb()
      db.prepare('DELETE FROM projects WHERE id = ?').run(id)
    },

    touch(id: string) {
      const db = getDb()
      db.prepare('UPDATE projects SET modified_at = ? WHERE id = ?').run(Date.now(), id)
    },

    update(id: string, data: { name?: string }) {
      const db = getDb()
      const updates: string[] = []
      const values: unknown[] = []

      if (data.name !== undefined) {
        updates.push('name = ?')
        values.push(data.name)
      }

      if (updates.length > 0) {
        updates.push('modified_at = ?')
        values.push(Date.now())
        values.push(id)
        db.prepare(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`).run(...values)
      }

      return this.get(id)
    },
  },

  // =========================================================================
  // Entities
  // =========================================================================

  entities: {
    list(projectId: string) {
      const db = getDb()
      const entities = db.prepare('SELECT * FROM entities WHERE project_id = ?').all(projectId) as Array<{
        id: string
        project_id: string
        created_at: number
        modified_at: number
      }>

      // Batch fetch all attrs for these entities
      const entityIds = entities.map(e => e.id)
      if (entityIds.length === 0) return []

      const placeholders = entityIds.map(() => '?').join(',')
      const attrRows = db.prepare(
        `SELECT entity_id, key, type, string_value, number_value, json_value, blob_value FROM attrs WHERE entity_id IN (${placeholders})`
      ).all(...entityIds) as AttrRow[]

      // Group attrs by entity with typed deserialization
      const attrsByEntity: Record<string, Record<string, AttrValue>> = {}
      for (const row of attrRows) {
        if (!attrsByEntity[row.entity_id]) attrsByEntity[row.entity_id] = {}
        attrsByEntity[row.entity_id][row.key] = deserializeAttr(row)
      }

      // Return entities with attrs (including injected id)
      return entities.map(e => ({
        ...e,
        attrs: {
          id: e.id, // Inject entity id into attrs
          ...attrsByEntity[e.id] || {},
        },
      }))
    },

    get(id: string) {
      const db = getDb()
      const entity = db.prepare('SELECT * FROM entities WHERE id = ?').get(id) as {
        id: string
        project_id: string
        created_at: number
        modified_at: number
      } | undefined

      if (!entity) return null

      const attrRows = db.prepare(
        'SELECT key, type, string_value, number_value, json_value, blob_value FROM attrs WHERE entity_id = ?'
      ).all(id) as Array<Omit<AttrRow, 'entity_id'>>

      const attrs: Record<string, AttrValue> = { id: entity.id } // Inject id
      for (const row of attrRows) {
        attrs[row.key] = deserializeAttr({ entity_id: id, ...row })
      }

      return { ...entity, attrs }
    },

    create(projectId: string) {
      const db = getDb()
      const id = randomUUID()
      const now = Date.now()

      db.prepare('INSERT INTO entities (id, project_id, created_at, modified_at) VALUES (?, ?, ?, ?)')
        .run(id, projectId, now, now)

      this._touchProject(projectId)
      return { id, project_id: projectId, created_at: now, modified_at: now }
    },

    /** Create entity with a specific ID (used for undo/restore) */
    createWithId(projectId: string, id: string, timestamps?: { created_at: number; modified_at: number }) {
      const db = getDb()
      const now = Date.now()
      const created_at = timestamps?.created_at ?? now
      const modified_at = timestamps?.modified_at ?? now

      db.prepare('INSERT INTO entities (id, project_id, created_at, modified_at) VALUES (?, ?, ?, ?)')
        .run(id, projectId, created_at, modified_at)

      this._touchProject(projectId)
      return { id, project_id: projectId, created_at, modified_at }
    },

    delete(id: string) {
      const db = getDb()
      const entity = db.prepare('SELECT project_id FROM entities WHERE id = ?').get(id) as { project_id: string } | undefined
      if (entity) {
        db.prepare('DELETE FROM entities WHERE id = ?').run(id)
        this._touchProject(entity.project_id)
      }
    },

    _touchProject(projectId: string) {
      const db = getDb()
      db.prepare('UPDATE projects SET modified_at = ? WHERE id = ?').run(Date.now(), projectId)
    },
  },

  // =========================================================================
  // Stamps (dedicated table)
  // =========================================================================

  stamps: {
    /** List all stamps with optional filtering */
    list(filter?: { kind?: 'template' | 'vocabulary'; category?: string }) {
      const db = getDb()
      let sql = 'SELECT * FROM stamps'
      const conditions: string[] = []
      const params: string[] = []

      if (filter?.kind) {
        conditions.push('kind = ?')
        params.push(filter.kind)
      }
      if (filter?.category) {
        conditions.push('category = ?')
        params.push(filter.category)
      }

      if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ')
      }
      sql += ' ORDER BY modified_at DESC'

      const stamps = db.prepare(sql).all(...params) as Array<{
        id: string
        name: string
        description: string | null
        icon: string | null
        category: string | null
        kind: string
        created_at: number
        modified_at: number
      }>

      // Batch fetch attrs for all stamps
      if (stamps.length === 0) return []

      const stampIds = stamps.map(s => s.id)
      const placeholders = stampIds.map(() => '?').join(',')
      const attrRows = db.prepare(
        `SELECT stamp_id, key, value, type FROM stamp_attrs WHERE stamp_id IN (${placeholders})`
      ).all(...stampIds) as Array<{ stamp_id: string; key: string; value: string | null; type: AttrType | null }>

      const attrsByStamp: Record<string, Record<string, AttrValue>> = {}
      for (const row of attrRows) {
        if (!attrsByStamp[row.stamp_id]) attrsByStamp[row.stamp_id] = {}
        if (row.value !== null) attrsByStamp[row.stamp_id][row.key] = deserializeStampAttr(row.value, row.type)
      }

      return stamps.map(s => ({
        ...s,
        kind: s.kind as 'template' | 'vocabulary',
        attrs: attrsByStamp[s.id] || {},
      }))
    },

    /** Get a stamp with all its members and relationships */
    get(id: string) {
      const db = getDb()
      const stamp = db.prepare('SELECT * FROM stamps WHERE id = ?').get(id) as {
        id: string
        name: string
        description: string | null
        icon: string | null
        category: string | null
        kind: string
        created_at: number
        modified_at: number
      } | undefined

      if (!stamp) return null

      // Get stamp attrs (with type for proper deserialization)
      const attrRows = db.prepare('SELECT key, value, type FROM stamp_attrs WHERE stamp_id = ?').all(id) as Array<{
        key: string
        value: string | null
        type: AttrType | null
      }>
      const attrs: Record<string, AttrValue> = {}
      for (const row of attrRows) {
        if (row.value !== null) attrs[row.key] = deserializeStampAttr(row.value, row.type)
      }

      // Get members
      const members = db.prepare('SELECT * FROM stamp_members WHERE stamp_id = ?').all(id) as Array<{
        id: string
        stamp_id: string
        local_id: string
      }>

      // Get member attrs (with type for proper deserialization)
      const memberIds = members.map(m => m.id)
      const memberAttrs: Record<string, Record<string, AttrValue>> = {}
      if (memberIds.length > 0) {
        const placeholders = memberIds.map(() => '?').join(',')
        const memberAttrRows = db.prepare(
          `SELECT member_id, key, value, type FROM stamp_member_attrs WHERE member_id IN (${placeholders})`
        ).all(...memberIds) as Array<{ member_id: string; key: string; value: string | null; type: AttrType | null }>

        for (const row of memberAttrRows) {
          if (!memberAttrs[row.member_id]) memberAttrs[row.member_id] = {}
          if (row.value !== null) memberAttrs[row.member_id][row.key] = deserializeStampAttr(row.value, row.type)
        }
      }

      // Get relationships (including binding metadata)
      const relationships = db.prepare('SELECT * FROM stamp_relationships WHERE stamp_id = ?').all(id) as Array<{
        id: string
        stamp_id: string
        from_local_id: string | null
        to_local_id: string | null
        kind: string
        label: string | null
        binding_name: string | null
        from_port: string | null
        to_port: string | null
      }>

      return {
        ...stamp,
        kind: stamp.kind as 'template' | 'vocabulary',
        attrs,
        members: members.map(m => ({
          ...m,
          attrs: memberAttrs[m.id] || {},
        })),
        relationships,
      }
    },

    /** Create a stamp, optionally from an existing entity */
    create(data: {
      name: string
      sourceEntityId?: string
      kind?: 'template' | 'vocabulary'
      category?: string
      description?: string
    }) {
      const db = getDb()
      const now = Date.now()
      const stampId = randomUUID()
      const kind = data.kind || 'template'

      const transaction = db.transaction(() => {
        // Create stamp
        db.prepare(`
          INSERT INTO stamps (id, name, description, category, kind, created_at, modified_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(stampId, data.name, data.description || null, data.category || null, kind, now, now)

        // If sourceEntityId provided, copy from entity
        if (data.sourceEntityId) {
          const sourceEntity = db.prepare('SELECT project_id FROM entities WHERE id = ?')
            .get(data.sourceEntityId) as { project_id: string } | undefined
          if (!sourceEntity) throw new Error('Source entity not found')

          // Copy entity attrs to stamp_attrs (excluding position and name - stamp has its own name)
          // Read typed attrs and convert to string for storage in stamp_attrs
          const attrs = db.prepare(
            'SELECT key, type, string_value, number_value, json_value FROM attrs WHERE entity_id = ?'
          ).all(data.sourceEntityId) as Array<{
            key: string
            type: AttrType
            string_value: string | null
            number_value: number | null
            json_value: string | null
          }>

          const excludeKeysRoot = new Set(['x', 'y', 'name']) // Root: exclude name (stamp has own name)
          const excludeKeysMember = new Set(['x', 'y'])        // Members: keep name!
          const attrStmt = db.prepare('INSERT INTO stamp_attrs (stamp_id, key, value, type) VALUES (?, ?, ?, ?)')

          for (const attr of attrs) {
            // Convert typed value to string for stamp storage
            let stringValue: string | null = null
            if (attr.type === 'string') stringValue = attr.string_value
            else if (attr.type === 'number' && attr.number_value !== null) stringValue = String(attr.number_value)
            else if (attr.type === 'json') stringValue = attr.json_value

            if (!excludeKeysRoot.has(attr.key) && stringValue !== null) {
              attrStmt.run(stampId, attr.key, stringValue, attr.type)
            }
          }

          // Get children and copy as members
          const localIdMap = new Map<string, string>()
          localIdMap.set(data.sourceEntityId, 'root')

          const getChildren = (entityId: string) => {
            return db.prepare(`
              SELECT to_entity FROM relationships
              WHERE from_entity = ? AND project_id = ? AND kind = 'contains'
            `).all(entityId, sourceEntity.project_id) as { to_entity: string }[]
          }

          const copyMember = (entityId: string, _parentLocalId: string) => {
            const memberId = randomUUID()
            const localId = `member_${localIdMap.size}`
            localIdMap.set(entityId, localId)

            // Create member
            db.prepare('INSERT INTO stamp_members (id, stamp_id, local_id) VALUES (?, ?, ?)')
              .run(memberId, stampId, localId)

            // Copy attrs (members keep their names, unlike root)
            const memberAttrs = db.prepare(
              'SELECT key, type, string_value, number_value, json_value FROM attrs WHERE entity_id = ?'
            ).all(entityId) as Array<{
              key: string
              type: AttrType
              string_value: string | null
              number_value: number | null
              json_value: string | null
            }>

            const memberAttrStmt = db.prepare('INSERT INTO stamp_member_attrs (member_id, key, value, type) VALUES (?, ?, ?, ?)')
            for (const attr of memberAttrs) {
              // Convert typed value to string for stamp storage
              let stringValue: string | null = null
              if (attr.type === 'string') stringValue = attr.string_value
              else if (attr.type === 'number' && attr.number_value !== null) stringValue = String(attr.number_value)
              else if (attr.type === 'json') stringValue = attr.json_value

              if (!excludeKeysMember.has(attr.key) && stringValue !== null) {
                memberAttrStmt.run(memberId, attr.key, stringValue, attr.type)
              }
            }

            // Recursively copy children
            for (const child of getChildren(entityId)) {
              copyMember(child.to_entity, localId)
            }
          }

          // Copy children
          for (const child of getChildren(data.sourceEntityId)) {
            copyMember(child.to_entity, 'root')
          }

          // Copy relationships as stamp_relationships (including binding metadata)
          const allSourceIds = Array.from(localIdMap.keys())
          if (allSourceIds.length > 1) {
            const placeholders = allSourceIds.map(() => '?').join(',')
            const relationships = db.prepare(`
              SELECT from_entity, to_entity, kind, label, binding_name, from_port, to_port
              FROM relationships
              WHERE project_id = ? AND from_entity IN (${placeholders}) AND to_entity IN (${placeholders})
            `).all(sourceEntity.project_id, ...allSourceIds, ...allSourceIds) as {
              from_entity: string
              to_entity: string
              kind: string
              label: string | null
              binding_name: string | null
              from_port: string | null
              to_port: string | null
            }[]

            const relStmt = db.prepare(`
              INSERT INTO stamp_relationships (id, stamp_id, from_local_id, to_local_id, kind, label, binding_name, from_port, to_port)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `)

            for (const rel of relationships) {
              const fromLocalId = localIdMap.get(rel.from_entity)
              const toLocalId = localIdMap.get(rel.to_entity)
              if (fromLocalId && toLocalId) {
                // NULL for root, local_id for members
                const fromId = fromLocalId === 'root' ? null : fromLocalId
                const toId = toLocalId === 'root' ? null : toLocalId
                relStmt.run(randomUUID(), stampId, fromId, toId, rel.kind, rel.label, rel.binding_name, rel.from_port, rel.to_port)
              }
            }
          }
        }

        return stampId
      })

      return transaction()
    },

    /** Apply stamp to target entity - copies attrs and creates children */
    apply(stampId: string, targetEntityId: string) {
      const db = getDb()
      const now = Date.now()

      // Get target entity's project
      const targetEntity = db.prepare('SELECT project_id FROM entities WHERE id = ?')
        .get(targetEntityId) as { project_id: string } | undefined
      if (!targetEntity) throw new Error('Target entity not found')

      // Get stamp with all data
      const stamp = this.get(stampId)
      if (!stamp) throw new Error('Stamp not found')

      // Capture target's current attrs BEFORE applying stamp (for undo)
      const previousAttrs: Record<string, AttrValue> = {}
      const currentAttrRows = db.prepare(
        'SELECT key, type, string_value, number_value, json_value FROM attrs WHERE entity_id = ?'
      ).all(targetEntityId) as Array<Omit<AttrRow, 'entity_id' | 'blob_value'>>
      for (const row of currentAttrRows) {
        previousAttrs[row.key] = deserializeAttr({ entity_id: targetEntityId, blob_value: null, ...row })
      }

      const createdEntityIds: string[] = []
      const createdRelationshipIds: string[] = []
      const appliedAttrs: Record<string, AttrValue> = { ...stamp.attrs }

      // Map local_id to new entity ID
      const localToEntityId = new Map<string | null, string>()
      localToEntityId.set(null, targetEntityId) // root (null) maps to target

      const transaction = db.transaction(() => {
        // Apply stamp attrs to target (preserving types)
        const attrStmt = db.prepare(`
          INSERT OR REPLACE INTO attrs (entity_id, key, type, string_value, number_value, json_value, blob_value)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `)
        for (const [key, value] of Object.entries(stamp.attrs)) {
          // Preserve the type from the stamp attr
          const attrType = inferAttrType(value)
          const serialized = serializeAttr(value, attrType)
          attrStmt.run(targetEntityId, key, attrType, serialized.string_value, serialized.number_value, serialized.json_value, serialized.blob_value)
        }

        // Create entities for each member
        for (const member of stamp.members) {
          const newId = randomUUID()
          localToEntityId.set(member.local_id, newId)
          createdEntityIds.push(newId)

          // Create entity
          db.prepare('INSERT INTO entities (id, project_id, created_at, modified_at) VALUES (?, ?, ?, ?)')
            .run(newId, targetEntity.project_id, now, now)

          // Copy member attrs (preserving types)
          for (const [key, value] of Object.entries(member.attrs)) {
            const attrType = inferAttrType(value)
            const serialized = serializeAttr(value, attrType)
            attrStmt.run(newId, key, attrType, serialized.string_value, serialized.number_value, serialized.json_value, serialized.blob_value)
          }
        }

        // Create relationships (including binding metadata)
        const relStmt = db.prepare(`
          INSERT INTO relationships (id, project_id, from_entity, to_entity, kind, label, binding_name, from_port, to_port)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)

        for (const rel of stamp.relationships) {
          const fromId = localToEntityId.get(rel.from_local_id)
          const toId = localToEntityId.get(rel.to_local_id)
          if (fromId && toId) {
            const relId = randomUUID()
            relStmt.run(relId, targetEntity.project_id, fromId, toId, rel.kind, rel.label || null, rel.binding_name || null, rel.from_port || null, rel.to_port || null)
            createdRelationshipIds.push(relId)
          }
        }

        // Record stamp application
        db.prepare('INSERT OR REPLACE INTO entity_stamps (entity_id, stamp_id, applied_at) VALUES (?, ?, ?)')
          .run(targetEntityId, stampId, now)

        // Update target modified_at
        db.prepare('UPDATE entities SET modified_at = ? WHERE id = ?').run(now, targetEntityId)
      })

      transaction()

      return { createdEntityIds, createdRelationshipIds, appliedAttrs, previousAttrs }
    },

    /** Update stamp metadata */
    update(id: string, data: Partial<{ name: string; description: string; icon: string; category: string }>) {
      const db = getDb()
      const updates: string[] = []
      const values: unknown[] = []

      for (const [key, value] of Object.entries(data)) {
        if (value !== undefined) {
          updates.push(`${key} = ?`)
          values.push(value)
        }
      }

      if (updates.length > 0) {
        updates.push('modified_at = ?')
        values.push(Date.now())
        values.push(id)
        db.prepare(`UPDATE stamps SET ${updates.join(', ')} WHERE id = ?`).run(...values)
      }
    },

    /** Delete a stamp */
    delete(stampId: string) {
      const db = getDb()

      const transaction = db.transaction(() => {
        // CASCADE handles members, attrs, relationships in stamps table
        const result = db.prepare('DELETE FROM stamps WHERE id = ?').run(stampId)

        // Also delete from legacy _stamps project if it exists there
        // (migration copies from entities → stamps, so we need to delete source too)
        db.prepare('DELETE FROM attrs WHERE entity_id = ?').run(stampId)
        db.prepare('DELETE FROM entities WHERE id = ? AND project_id = ?').run(stampId, '_stamps')

        return { deleted: result.changes > 0 }
      })

      return transaction()
    },
  },

  // =========================================================================
  // Attrs
  // =========================================================================

  attrs: {
    get(entityId: string) {
      const db = getDb()
      const rows = db.prepare(
        'SELECT key, type, string_value, number_value, json_value, blob_value FROM attrs WHERE entity_id = ?'
      ).all(entityId) as Array<Omit<AttrRow, 'entity_id'>>

      const attrs: Record<string, AttrValue> = {}
      for (const row of rows) {
        attrs[row.key] = deserializeAttr({ entity_id: entityId, ...row })
      }
      return attrs
    },

    set(entityId: string, key: string, value: AttrValue, type?: AttrType) {
      const db = getDb()
      const attrType = type ?? inferAttrType(value)
      const serialized = serializeAttr(value, attrType)

      db.prepare(`
        INSERT OR REPLACE INTO attrs (entity_id, key, type, string_value, number_value, json_value, blob_value)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(entityId, key, attrType, serialized.string_value, serialized.number_value, serialized.json_value, serialized.blob_value)

      // Update entity modified_at
      db.prepare('UPDATE entities SET modified_at = ? WHERE id = ?').run(Date.now(), entityId)
    },

    delete(entityId: string, key: string) {
      const db = getDb()
      db.prepare('DELETE FROM attrs WHERE entity_id = ? AND key = ?').run(entityId, key)
      db.prepare('UPDATE entities SET modified_at = ? WHERE id = ?').run(Date.now(), entityId)
    },

    setBatch(entityId: string, attrs: Record<string, AttrValue>, types?: Record<string, AttrType>) {
      const db = getDb()
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO attrs (entity_id, key, type, string_value, number_value, json_value, blob_value)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)

      const transaction = db.transaction(() => {
        for (const [key, value] of Object.entries(attrs)) {
          const attrType = types?.[key] ?? inferAttrType(value)
          const serialized = serializeAttr(value, attrType)
          stmt.run(entityId, key, attrType, serialized.string_value, serialized.number_value, serialized.json_value, serialized.blob_value)
        }
        db.prepare('UPDATE entities SET modified_at = ? WHERE id = ?').run(Date.now(), entityId)
      })

      transaction()
    },
  },

  // =========================================================================
  // Relationships
  // =========================================================================

  relationships: {
    list(projectId: string) {
      const db = getDb()
      return db.prepare('SELECT * FROM relationships WHERE project_id = ?').all(projectId)
    },

    create(projectId: string, data: { from_entity: string; to_entity: string; kind: string; label?: string | null; binding_name?: string | null; from_port?: string | null; to_port?: string | null }) {
      const db = getDb()
      const id = randomUUID()
      const { from_entity, to_entity, kind, label = null, binding_name = null, from_port = null, to_port = null } = data

      db.prepare(`
        INSERT INTO relationships (id, project_id, from_entity, to_entity, kind, label, binding_name, from_port, to_port)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, projectId, from_entity, to_entity, kind, label, binding_name, from_port, to_port)

      this._touchProject(projectId)
      return { id, project_id: projectId, from_entity, to_entity, kind, label, binding_name, from_port, to_port }
    },

    /** Create relationship with a specific ID (used for undo/restore) */
    createWithId(projectId: string, id: string, data: { from_entity: string; to_entity: string; kind: string; label?: string | null; binding_name?: string | null; from_port?: string | null; to_port?: string | null }) {
      const db = getDb()
      const { from_entity, to_entity, kind, label = null, binding_name = null, from_port = null, to_port = null } = data

      db.prepare(`
        INSERT INTO relationships (id, project_id, from_entity, to_entity, kind, label, binding_name, from_port, to_port)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, projectId, from_entity, to_entity, kind, label, binding_name, from_port, to_port)

      this._touchProject(projectId)
      return { id, project_id: projectId, from_entity, to_entity, kind, label, binding_name, from_port, to_port }
    },

    /** Get a relationship by ID */
    get(id: string) {
      const db = getDb()
      return db.prepare('SELECT * FROM relationships WHERE id = ?').get(id) as {
        id: string
        project_id: string
        from_entity: string
        to_entity: string
        kind: string
        label: string | null
        binding_name: string | null
        from_port: string | null
        to_port: string | null
      } | null
    },

    delete(id: string) {
      const db = getDb()
      const rel = db.prepare('SELECT project_id FROM relationships WHERE id = ?').get(id) as { project_id: string } | undefined
      if (rel) {
        db.prepare('DELETE FROM relationships WHERE id = ?').run(id)
        this._touchProject(rel.project_id)
      }
    },

    _touchProject(projectId: string) {
      const db = getDb()
      db.prepare('UPDATE projects SET modified_at = ? WHERE id = ?').run(Date.now(), projectId)
    },
  },

  // =========================================================================
  // UI State
  // =========================================================================

  uiState: {
    get(projectId: string) {
      const db = getDb()
      return db.prepare('SELECT * FROM ui_state WHERE project_id = ?').get(projectId) || {
        project_id: projectId,
        viewport_x: 0,
        viewport_y: 0,
        viewport_zoom: 1,
        selected_entity: null,
      }
    },

    update(projectId: string, data: Partial<{ viewport_x: number; viewport_y: number; viewport_zoom: number; selected_entity: string | null }>) {
      const db = getDb()
      const updates: string[] = []
      const values: unknown[] = []

      for (const [key, value] of Object.entries(data)) {
        if (value !== undefined) {
          updates.push(`${key} = ?`)
          values.push(value)
        }
      }

      if (updates.length > 0) {
        values.push(projectId)
        db.prepare(`UPDATE ui_state SET ${updates.join(', ')} WHERE project_id = ?`).run(...values)
      }

      return this.get(projectId)
    },
  },

  // =========================================================================
  // Themes
  // =========================================================================

  themes: {
    list() {
      const db = getDb()
      return db.prepare('SELECT id, name, description, author, is_system FROM themes ORDER BY name').all()
    },

    get(id: string) {
      const db = getDb()
      const theme = db.prepare('SELECT id, name, description, author, is_system FROM themes WHERE id = ?').get(id) as {
        id: string
        name: string
        description: string
        author: string
        is_system: number
      } | undefined

      if (!theme) return null

      const valueRows = db.prepare('SELECT token_id, value FROM theme_colors WHERE theme_id = ?').all(id) as Array<{
        token_id: string
        value: string
      }>

      const colors: Record<string, string> = {}
      const typography: Record<string, string> = {}

      for (const row of valueRows) {
        if (row.token_id.startsWith('font-')) {
          typography[row.token_id] = row.value
        } else {
          colors[row.token_id] = row.value
        }
      }

      return {
        ...theme,
        isSystem: theme.is_system === 1,
        colors,
        typography,
      }
    },

    create(name: string, basedOn?: string) {
      const db = getDb()
      const id = randomUUID()

      db.prepare('INSERT INTO themes (id, name, description, author, is_system) VALUES (?, ?, ?, ?, 0)')
        .run(id, name, '', 'user')

      const sourceThemeId = basedOn || 'dark'
      db.prepare(`
        INSERT INTO theme_colors (theme_id, token_id, value)
        SELECT ?, token_id, value FROM theme_colors WHERE theme_id = ?
      `).run(id, sourceThemeId)

      return this.get(id)
    },

    updateColor(themeId: string, tokenId: string, value: string) {
      const db = getDb()
      db.prepare(`
        INSERT OR REPLACE INTO theme_colors (theme_id, token_id, value)
        VALUES (?, ?, ?)
      `).run(themeId, tokenId, value)

      db.prepare('UPDATE themes SET modified_at = ? WHERE id = ?').run(Date.now(), themeId)
    },

    delete(id: string) {
      const db = getDb()
      const theme = db.prepare('SELECT is_system FROM themes WHERE id = ?').get(id) as { is_system: number } | undefined
      if (theme && theme.is_system === 0) {
        db.prepare('DELETE FROM themes WHERE id = ?').run(id)
      }
    },

    getTokens() {
      const db = getDb()
      return db.prepare('SELECT id, category, label, description FROM token_definitions ORDER BY category, id').all()
    },
  },

  // =========================================================================
  // Settings
  // =========================================================================

  settings: {
    get(key: string) {
      const db = getDb()
      const result = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
      return result?.value || null
    },

    set(key: string, value: string) {
      const db = getDb()
      db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value)
    },
  },

  // =========================================================================
  // Semantic Docs
  // =========================================================================

  semanticDocs: {
    get(id: string) {
      const db = getDb()
      return db.prepare('SELECT * FROM semantic_docs WHERE id = ?').get(id) as {
        id: string
        name: string
        summary: string | null
        description: string | null
        usage: string | null
        examples: string | null
      } | null
    },

    list() {
      const db = getDb()
      return db.prepare('SELECT * FROM semantic_docs').all() as Array<{
        id: string
        name: string
        summary: string | null
        description: string | null
        usage: string | null
        examples: string | null
      }>
    },
  },
}
