import { Link, Outlet, useOutlet } from 'react-router'
import type { Route } from './+types/diagram.$id'
import {
  materialize,
  getDiagram,
  createSpine,
  createHandle,
  deleteSpine,
  createLine,
  deleteLine,
  updateSpinePosition,
  updateSpineLabel,
  notifyChange,
  getPendingTasks,
} from '~/db/queries'
import DiagramEditor from '~/components/diagram/DiagramEditor'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function shouldRevalidate({
  formMethod,
  defaultShouldRevalidate,
}: {
  formMethod?: string
  defaultShouldRevalidate: boolean
}) {
  // Only re-run the parent loader after mutations (POST).
  // Navigation to child inspection routes (GET) should NOT re-run the loader,
  // because that would create new node/edge references and blow away React Flow state.
  return !!formMethod
}

export function meta({ data }: Route.MetaArgs) {
  return [{ title: data?.diagram?.name ?? 'Diagram' }]
}

export async function loader({ params }: Route.LoaderArgs) {
  const diagram = await getDiagram(params.id!)
  if (!diagram) throw new Response('Not Found', { status: 404 })

  const { nodes, edges } = await materialize(params.id!)
  const taskCount = (await getPendingTasks()).length
  return { diagram, nodes, edges, taskCount }
}

export async function action({ request, params }: Route.ActionArgs) {
  const form = await request.formData()
  const intent = form.get('intent')
  const diagramId = params.id!

  switch (intent) {
    case 'add-spine': {
      const spine = await createSpine(diagramId, Number(form.get('x')), Number(form.get('y')))
      await notifyChange('spine', spine.id, 'create')
      break
    }
    case 'delete-spine': {
      const spineId = form.get('spineId') as string
      await notifyChange('spine', spineId, 'delete')
      await deleteSpine(spineId)
      break
    }
    case 'delete-spines': {
      const ids = JSON.parse(form.get('spineIds') as string) as string[]
      for (const id of ids) await notifyChange('spine', id, 'delete')
      await Promise.all(ids.map(id => deleteSpine(id)))
      break
    }
    case 'connect': {
      const line = await createLine(
        diagramId,
        form.get('sourceHandleId') as string,
        form.get('targetHandleId') as string
      )
      await notifyChange('line', line.id, 'connect')
      break
    }
    case 'delete-line': {
      const lineId = form.get('lineId') as string
      await notifyChange('line', lineId, 'delete')
      await deleteLine(lineId)
      break
    }
    case 'delete-lines': {
      const ids = JSON.parse(form.get('lineIds') as string) as string[]
      for (const id of ids) await notifyChange('line', id, 'delete')
      await Promise.all(ids.map(id => deleteLine(id)))
      break
    }
    case 'update-position': {
      await updateSpinePosition(diagramId, form.get('spineId') as string, Number(form.get('x')), Number(form.get('y')))
      break
    }
    case 'update-label': {
      await updateSpineLabel(diagramId, form.get('spineId') as string, (form.get('label') as string) || null)
      break
    }
    case 'create-handle': {
      await createHandle(form.get('spineId') as string, form.get('name') as string)
      break
    }
  }

  return null
}

export default function DiagramLayout({ loaderData }: Route.ComponentProps) {
  const { diagram, nodes, edges, taskCount } = loaderData
  const outlet = useOutlet()

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-3 border-b border-border px-4 py-2 shrink-0">
        <a href="/" className="text-sm text-muted-foreground hover:text-foreground">
          &larr; Diagrams
        </a>
        <h1 className="text-sm font-semibold flex-1">{diagram.name}</h1>
        {taskCount > 0 && (
          <Link
            to="tasks"
            className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          >
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            {taskCount} task{taskCount !== 1 ? 's' : ''}
          </Link>
        )}
      </header>
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 min-w-0">
          <DiagramEditor nodes={nodes} edges={edges} diagramId={diagram.id} />
        </div>
        {outlet && <Outlet />}
      </div>
    </div>
  )
}
