import type { Route } from './+types/diagram.$id'
import {
  materialize,
  getDiagram,
  listOntologies,
  createSpine,
  deleteSpine,
  createLine,
  deleteLine,
  updateSpinePosition,
  updateSpineLabel,
  setSpineOntology,
  removeSpineOntology,
  setLineOntology,
  removeLineOntology,
} from '~/db/queries'
import DiagramEditor from '~/components/diagram/DiagramEditor'

export function meta({ data }: Route.MetaArgs) {
  return [{ title: data?.diagram?.name ?? 'Diagram' }]
}

export async function loader({ params }: Route.LoaderArgs) {
  const diagram = await getDiagram(params.id!)
  if (!diagram) throw new Response('Not Found', { status: 404 })

  const { nodes, edges } = await materialize(params.id!)
  const ontologies = await listOntologies()

  return { diagram, nodes, edges, ontologies }
}

export async function action({ request, params }: Route.ActionArgs) {
  const form = await request.formData()
  const intent = form.get('intent')
  const diagramId = params.id!

  switch (intent) {
    case 'add-spine': {
      await createSpine(diagramId, Number(form.get('x')), Number(form.get('y')))
      break
    }
    case 'delete-spine': {
      await deleteSpine(form.get('spineId') as string)
      break
    }
    case 'delete-spines': {
      const ids = JSON.parse(form.get('spineIds') as string) as string[]
      await Promise.all(ids.map(id => deleteSpine(id)))
      break
    }
    case 'connect': {
      await createLine(
        diagramId,
        form.get('sourceSpine') as string,
        form.get('sourceHandle') as string,
        form.get('targetSpine') as string,
        form.get('targetHandle') as string
      )
      break
    }
    case 'delete-line': {
      await deleteLine(form.get('lineId') as string)
      break
    }
    case 'delete-lines': {
      const ids = JSON.parse(form.get('lineIds') as string) as string[]
      await Promise.all(ids.map(id => deleteLine(id)))
      break
    }
    case 'update-position': {
      await updateSpinePosition(diagramId, form.get('spineId') as string, Number(form.get('x')), Number(form.get('y')))
      break
    }
    case 'update-label': {
      await updateSpineLabel(diagramId, form.get('spineId') as string, form.get('label') as string)
      break
    }
    case 'set-ontology': {
      const entityType = form.get('entityType') as string
      if (entityType === 'spine') {
        await setSpineOntology(form.get('entityId') as string, form.get('ontologyId') as string)
      } else {
        await setLineOntology(form.get('entityId') as string, form.get('ontologyId') as string)
      }
      break
    }
    case 'remove-ontology': {
      const entityType = form.get('entityType') as string
      if (entityType === 'spine') {
        await removeSpineOntology(form.get('entityId') as string, form.get('ontologyId') as string)
      } else {
        await removeLineOntology(form.get('entityId') as string, form.get('ontologyId') as string)
      }
      break
    }
  }

  return null
}

export default function DiagramRoute({ loaderData }: Route.ComponentProps) {
  const { diagram, nodes, edges } = loaderData

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-3 border-b border-border px-4 py-2">
        <a href="/" className="text-sm text-muted-foreground hover:text-foreground">
          &larr; Diagrams
        </a>
        <h1 className="text-sm font-semibold">{diagram.name}</h1>
      </header>
      <div className="flex-1">
        <DiagramEditor initialNodes={nodes} initialEdges={edges} diagramId={diagram.id} />
      </div>
    </div>
  )
}
