import { createHashRouter, redirect } from 'react-router'
import { ProjectList } from './routes/projects'
import { Editor } from './routes/editor'
import { Settings } from './routes/settings'

export const router = createHashRouter([
  {
    path: '/',
    element: <ProjectList />,
    loader: async () => {
      const projects = await window.db.projects.list()
      return { projects }
    },
    action: async ({ request }) => {
      const formData = await request.formData()
      const intent = formData.get('intent')

      if (intent === 'create') {
        const name = formData.get('name') as string
        const project = await window.db.projects.create(name || 'Untitled Project')
        return redirect(`/project/${project.id}`)
      }

      if (intent === 'delete') {
        const id = formData.get('id') as string
        await window.db.projects.delete(id)
        return { ok: true }
      }

      return null
    },
  },
  {
    path: '/project/:id',
    element: <Editor />,
    shouldRevalidate: ({ formData }) => {
      // Only revalidate for structural changes (create/delete entity, relationships)
      if (!formData) return false
      const intent = formData.get('intent')
      const structuralIntents = ['createEntity', 'deleteEntity', 'createRelationship', 'deleteRelationship', 'contain', 'uncontain', 'createStamp', 'applyStamp', 'deleteStamp']
      return structuralIntents.includes(intent as string)
    },
    loader: async ({ params }) => {
      const projectId = params.id!
      const [project, entities, relationships, stamps, uiState] = await Promise.all([
        window.db.projects.get(projectId),
        window.db.entities.list(projectId),
        window.db.relationships.list(projectId),
        window.db.stamps.list(),
        window.db.uiState.get(projectId),
      ])

      if (!project) {
        throw new Response('Project not found', { status: 404 })
      }

      return { project, entities, relationships, stamps, uiState }
    },
    action: async ({ request, params }) => {
      const formData = await request.formData()
      const intent = formData.get('intent')
      const projectId = params.id!

      // Entity operations
      if (intent === 'createEntity') {
        const entity = await window.db.entities.create(projectId)
        // Set initial attrs
        const name = formData.get('name') as string
        const x = formData.get('x') as string
        const y = formData.get('y') as string
        if (name) await window.db.attrs.set(entity.id, 'name', name)
        if (x) await window.db.attrs.set(entity.id, 'x', x, 'number')
        if (y) await window.db.attrs.set(entity.id, 'y', y, 'number')
        return { ok: true, entityId: entity.id }
      }

      if (intent === 'updateAttr') {
        const entityId = formData.get('entityId') as string
        const key = formData.get('key') as string
        const value = formData.get('value') as string
        const type = (formData.get('type') as string) || 'string'
        await window.db.attrs.set(entityId, key, value, type)
        return { ok: true }
      }

      if (intent === 'updatePosition') {
        const entityId = formData.get('entityId') as string
        const x = formData.get('x') as string
        const y = formData.get('y') as string
        await window.db.attrs.setBatch(entityId, { x, y })
        return { ok: true }
      }

      if (intent === 'deleteAttr') {
        const entityId = formData.get('entityId') as string
        const key = formData.get('key') as string
        await window.db.attrs.delete(entityId, key)
        return { ok: true }
      }

      if (intent === 'deleteEntity') {
        const id = formData.get('entityId') as string
        await window.db.entities.delete(id)
        return { ok: true }
      }

      // Relationship operations
      if (intent === 'createRelationship') {
        const from_entity = formData.get('from') as string
        const to_entity = formData.get('to') as string
        const kind = (formData.get('kind') as string || 'connects') as 'contains' | 'connects' | 'binds'
        const label = formData.get('label') as string | null
        const binding_name = formData.get('binding_name') as string | null
        await window.db.relationships.create(projectId, { from_entity, to_entity, kind, label, binding_name })
        return { ok: true }
      }

      if (intent === 'deleteRelationship') {
        const id = formData.get('relationshipId') as string
        await window.db.relationships.delete(id)
        return { ok: true }
      }

      // UI state operations
      if (intent === 'updateViewport') {
        const viewport_x = parseFloat(formData.get('x') as string)
        const viewport_y = parseFloat(formData.get('y') as string)
        const viewport_zoom = parseFloat(formData.get('zoom') as string)
        await window.db.uiState.update(projectId, { viewport_x, viewport_y, viewport_zoom })
        return { ok: true }
      }

      if (intent === 'selectEntity') {
        const selected_entity = formData.get('entityId') as string | null
        await window.db.uiState.update(projectId, { selected_entity })
        return { ok: true }
      }

      // Stamp operations
      if (intent === 'createStamp') {
        const sourceEntityId = formData.get('sourceEntityId') as string
        const stampName = formData.get('stampName') as string
        const stampId = await window.db.stamps.create({
          name: stampName,
          sourceEntityId,
          kind: 'template',
        })
        return { ok: true, stampId }
      }

      if (intent === 'applyStamp') {
        const stampId = formData.get('stampId') as string
        const targetEntityId = formData.get('targetEntityId') as string
        await window.db.stamps.apply(stampId, targetEntityId)
        return { ok: true }
      }

      if (intent === 'deleteStamp') {
        const stampId = formData.get('stampId') as string
        await window.db.stamps.delete(stampId)
        return { ok: true }
      }

      // Containment operations
      if (intent === 'contain') {
        const parentId = formData.get('parentId') as string
        const childId = formData.get('childId') as string
        await window.db.relationships.create(projectId, {
          from_entity: parentId,
          to_entity: childId,
          kind: 'contains',
          label: null,
          binding_name: null,
        })
        return { ok: true }
      }

      if (intent === 'uncontain') {
        const childId = formData.get('childId') as string
        // Find and delete the contains relationship
        const relationships = await window.db.relationships.list(projectId)
        const containsRel = relationships.find(
          (r) => r.kind === 'contains' && r.to_entity === childId
        )
        if (containsRel) {
          await window.db.relationships.delete(containsRel.id)
        }
        return { ok: true }
      }

      return null
    },
  },
  {
    path: '/settings',
    element: <Settings />,
  },
])
