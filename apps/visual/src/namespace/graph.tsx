import { useMemo } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { z } from 'zod'
import { storeAtom, patchHistoryAtom, trackedStoreAtom, type PatchEntry } from './index'
interface IViewable {
  phlowViews: unknown[]
}

const PRIORITY = { high: 10, med: 50, low: 100 } as const
import { isSchema } from './types'

/**
 * Hook that returns a viewable for the namespace graph.
 * Provides views for browsing, changes history, and creating new objects.
 */
export function useGraph(): IViewable {
  const store = useAtomValue(storeAtom)
  const patches = useAtomValue(patchHistoryAtom)
  const setStore = useSetAtom(trackedStoreAtom)

  return useMemo(() => {
    // Collect schema names for the "Add Entity" form
    const schemaNames = [...store.entries()].filter(([_, obj]) => isSchema(obj)).map(([name]) => name)

    // Schema for adding a new entity
    const addEntitySchema =
      schemaNames.length > 0
        ? z.object({
            path: z.string().min(1).meta({ label: 'Path', placeholder: 'myEntity' }),
            $schema: z.enum(schemaNames as [string, ...string[]]).meta({ label: 'Schema' }),
          })
        : z.object({
            path: z.string().min(1).meta({ label: 'Path', placeholder: 'myEntity' }),
            $schema: z.string().meta({ label: 'Schema', placeholder: 'schemaName' }),
          })

    // Schema for creating a new query
    const newQuerySchema = z.object({
      name: z.string().min(1).meta({ label: 'Name', placeholder: 'myQuery' }),
      description: z.string().optional().meta({ label: 'Description', placeholder: 'Query description' }),
      matchSchema: z.string().optional().meta({ label: 'Match Schema', placeholder: 'taskSchema' }),
      matchKind: z.string().optional().meta({ label: 'Match Kind', placeholder: 'entity' }),
    })

    // Schema for creating a new schema
    const newSchemaSchema = z.object({
      path: z.string().min(1).meta({ label: 'Path', placeholder: 'mySchema' }),
      name: z.string().min(1).meta({ label: 'Display Name', placeholder: 'My Schema' }),
    })

    // Schema for creating a new document
    const newDocumentSchema = z.object({
      path: z.string().min(1).meta({ label: 'Path', placeholder: 'readme' }),
      title: z.string().optional().meta({ label: 'Title', placeholder: 'Document Title' }),
      format: z.enum(['text', 'markdown', 'json']).meta({ label: 'Format' }),
    })

    return {
      phlowViews: [
        // 1. Browser - names sorted by path
        {
          title: 'Browser',
          priority: PRIORITY.high,
          items: () => [...store.entries()].sort((a: [string, object], b: [string, object]) => a[0].localeCompare(b[0])),
          columns: {
            name: { text: ([name]: [string, object]) => name },
            kind: { text: ([_, obj]: [string, object]) => (obj as any).$kind ?? '?' },
            schema: { text: ([_, obj]: [string, object]) => (obj as any).$schema ?? '' },
          },
        },

        // 2. Changes - patch history (most recent first)
        {
          title: 'Changes',
          priority: PRIORITY.med,
          items: () => [...patches].reverse(),
          columns: {
            time: { text: (p: PatchEntry) => new Date(p.timestamp).toLocaleTimeString() },
            ops: {
              text: (p: PatchEntry) =>
                p.patches
                  .map((x: { op: string; path: (string | number)[] }) => `${x.op} ${x.path.join('/')}`)
                  .join(', ')
                  .slice(0, 60),
            },
          },
        },

        // 3. Add Entity form
        {
          title: 'Add Entity',
          priority: PRIORITY.low,
          schema: () => addEntitySchema,
          model: () => ({ path: '', $schema: schemaNames[0] ?? '' }),
          onUpdate: (data: { path: string; $schema: string }) => {
            if (data.path && data.$schema) {
              setStore(draft => {
                draft.set(data.path, {
                  $kind: 'entity',
                  $schema: data.$schema,
                })
              })
            }
          },
        },

        // 4. New Schema form
        {
          title: 'New Schema',
          priority: PRIORITY.low,
          schema: () => newSchemaSchema,
          model: () => ({ path: '', name: '' }),
          onUpdate: (data: { path: string; name: string }) => {
            if (data.path && data.name) {
              setStore(draft => {
                draft.set(data.path, {
                  $kind: 'schema',
                  name: data.name,
                  fields: {},
                })
              })
            }
          },
        },

        // 5. New Query form
        {
          title: 'New Query',
          priority: PRIORITY.low,
          schema: () => newQuerySchema,
          model: () => ({ name: '', description: '', matchSchema: '', matchKind: '' }),
          onUpdate: (data: { name: string; description?: string; matchSchema?: string; matchKind?: string }) => {
            if (data.name) {
              setStore(draft => {
                draft.set(data.name, {
                  $kind: 'query',
                  name: data.name,
                  description: data.description,
                  params: {},
                  match: {
                    schema: data.matchSchema || undefined,
                    kind: data.matchKind || undefined,
                    where: [],
                  },
                })
              })
            }
          },
        },

        // 6. New Document form
        {
          title: 'New Document',
          priority: PRIORITY.low,
          schema: () => newDocumentSchema,
          model: () => ({ path: '', title: '', format: 'markdown' as const }),
          onUpdate: (data: { path: string; title?: string; format: 'text' | 'markdown' | 'json' }) => {
            if (data.path) {
              setStore(draft => {
                draft.set(data.path, {
                  $kind: 'document',
                  title: data.title,
                  content: '',
                  format: data.format,
                })
              })
            }
          },
        },
      ],
    }
  }, [store, patches, setStore])
}

/**
 * Seed initial sample data into the namespace
 */
export function useSeedNamespace() {
  const setStore = useSetAtom(trackedStoreAtom)

  return () => {
    setStore(draft => {
      // User schema
      draft.set('userSchema', {
        $kind: 'schema',
        name: 'User',
        fields: {
          name: { type: 'string', label: 'Name', required: true },
          email: { type: 'string', label: 'Email', placeholder: 'user@example.com' },
          role: { type: 'string', label: 'Role' },
        },
      })

      // Task schema
      draft.set('taskSchema', {
        $kind: 'schema',
        name: 'Task',
        fields: {
          title: { type: 'string', label: 'Title', required: true },
          completed: { type: 'boolean', label: 'Done' },
          assignee: { type: 'ref', ref: 'userSchema', label: 'Assigned To' },
          priority: { type: 'number', label: 'Priority', min: 1, max: 5 },
        },
      })

      // Sample users
      draft.set('alice', {
        $kind: 'entity',
        $schema: 'userSchema',
        name: 'Alice',
        email: 'alice@example.com',
        role: 'Developer',
      })

      draft.set('bob', {
        $kind: 'entity',
        $schema: 'userSchema',
        name: 'Bob',
        email: 'bob@example.com',
        role: 'Designer',
      })

      // Sample tasks
      draft.set('task1', {
        $kind: 'entity',
        $schema: 'taskSchema',
        title: 'Write tests',
        completed: false,
        assignee: 'alice',
        priority: 2,
      })

      draft.set('task2', {
        $kind: 'entity',
        $schema: 'taskSchema',
        title: 'Design mockups',
        completed: true,
        assignee: 'bob',
        priority: 1,
      })

      draft.set('task3', {
        $kind: 'entity',
        $schema: 'taskSchema',
        title: 'Review PR',
        completed: false,
        assignee: 'alice',
        priority: 3,
      })

      // Sample query
      draft.set('incompleteTasks', {
        $kind: 'query',
        name: 'Incomplete Tasks',
        description: 'Find all tasks that are not yet completed',
        params: {
          assignee: { type: 'ref', label: 'Filter by assignee' },
        },
        match: {
          schema: 'taskSchema',
          where: [{ field: 'completed', op: 'eq', value: false }],
        },
      })

      // Sample document
      draft.set('readme', {
        $kind: 'document',
        title: 'README',
        content:
          '# Welcome\n\nThis is the namespace graph demo.\n\n## Features\n\n- Schemas define data structure\n- Entities are instances of schemas\n- Queries filter entities\n- Documents hold text content',
        format: 'markdown',
      })

      // Sample view
      draft.set('taskListView', {
        $kind: 'view',
        name: 'Task List',
        viewType: 'columnedList',
        title: 'Tasks',
        source: 'incompleteTasks',
        columns: {
          title: { field: 'title', label: 'Task' },
          done: { field: 'completed', label: 'Done' },
          priority: { field: 'priority', label: 'Priority' },
        },
      })
    })
  }
}
