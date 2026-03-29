import { useFetcher } from 'react-router'
import type { Route } from './+types/diagram.$id.spine.$sid'
import {
  getSpine,
  getHandlesForSpine,
  getSpineOntologies,
  getSpineMarks,
  getLinesForSpine,
  getDiagramsForSpine,
  getEditsForEntity,
  listOntologies,
  createHandle,
  deleteHandle,
  setSpineOntology,
  removeSpineOntology,
  updateSpineLabel,
} from '~/db/queries'
import { InspectPanel, InspectSection, ThingLink, InfoRow } from '~/components/inspect/InspectPanel'
import { Badge } from '~/components/ui/badge'
import { useState } from 'react'

export async function loader({ params }: Route.LoaderArgs) {
  const spine = await getSpine(params.sid!)
  if (!spine) throw new Response('Not Found', { status: 404 })

  const [handles, ontologies, marks, connections, diagrams, recentEdits, allOntologies] = await Promise.all([
    getHandlesForSpine(params.sid!),
    getSpineOntologies(params.sid!),
    getSpineMarks(params.sid!),
    getLinesForSpine(params.sid!),
    getDiagramsForSpine(params.sid!),
    getEditsForEntity(params.sid!, 5),
    listOntologies(),
  ])

  return { spine, handles, ontologies, marks, connections, diagrams, recentEdits, allOntologies }
}

export async function action({ request, params }: Route.ActionArgs) {
  const form = await request.formData()
  const intent = form.get('intent')
  const spineId = params.sid!

  switch (intent) {
    case 'rename': {
      const diagramId = params.id!
      await updateSpineLabel(diagramId, spineId, (form.get('label') as string) || null)
      break
    }
    case 'add-handle': {
      await createHandle(spineId, form.get('name') as string)
      break
    }
    case 'delete-handle': {
      await deleteHandle(form.get('handleId') as string)
      break
    }
    case 'assign-ontology': {
      await setSpineOntology(spineId, form.get('ontologyId') as string)
      break
    }
    case 'remove-ontology': {
      await removeSpineOntology(spineId, form.get('ontologyId') as string)
      break
    }
  }

  return null
}

export default function SpineInspect({ loaderData }: Route.ComponentProps) {
  const { spine, handles, ontologies, marks, connections, diagrams, recentEdits, allOntologies } = loaderData
  const fetcher = useFetcher()
  const [newHandleName, setNewHandleName] = useState('')
  const [labelEditing, setLabelEditing] = useState(false)

  const currentLabel = diagrams[0]?.label ?? null
  const primaryColor = ontologies[0]?.color ?? null
  const unassignedOntologies = allOntologies.filter(o => !ontologies.some(so => so.id === o.id))

  return (
    <InspectPanel title={currentLabel ?? 'Spine'} subtitle={spine.id.slice(0, 8)} color={primaryColor}>
      {/* Identity */}
      <InspectSection title="Info">
        <InfoRow label="ID">
          <code className="text-[10px] text-muted-foreground">{spine.id.slice(0, 12)}...</code>
        </InfoRow>
        <InfoRow label="Label">
          {labelEditing ? (
            <fetcher.Form method="post" onSubmit={() => setLabelEditing(false)} className="flex gap-1">
              <input type="hidden" name="intent" value="rename" />
              <input
                type="text"
                name="label"
                defaultValue={currentLabel ?? ''}
                autoFocus
                onBlur={e => {
                  setLabelEditing(false)
                  e.currentTarget.form?.requestSubmit()
                }}
                className="w-24 px-1 py-0.5 text-xs border border-input rounded bg-background"
              />
            </fetcher.Form>
          ) : (
            <button onClick={() => setLabelEditing(true)} className="text-xs hover:text-primary transition-colors">
              {currentLabel ?? <span className="italic text-muted-foreground">none</span>}
            </button>
          )}
        </InfoRow>
      </InspectSection>

      {/* Handles */}
      <InspectSection title="Handles" count={handles.length}>
        {handles.map(h => (
          <div key={h.id} className="flex items-center group">
            <ThingLink
              to={`../handle/${h.id}`}
              label={h.name}
              icon={<span className="text-muted-foreground">◆</span>}
            />
            <fetcher.Form method="post" className="opacity-0 group-hover:opacity-100 mr-2">
              <input type="hidden" name="intent" value="delete-handle" />
              <input type="hidden" name="handleId" value={h.id} />
              <button type="submit" className="text-destructive text-xs hover:text-destructive/80">
                ×
              </button>
            </fetcher.Form>
          </div>
        ))}
        <fetcher.Form method="post" onSubmit={() => setNewHandleName('')} className="flex gap-1 px-3 py-1">
          <input type="hidden" name="intent" value="add-handle" />
          <input
            type="text"
            name="name"
            value={newHandleName}
            onChange={e => setNewHandleName(e.target.value)}
            placeholder="handle name..."
            className="flex-1 px-1.5 py-0.5 text-xs border border-input rounded bg-background"
          />
          <button
            type="submit"
            disabled={!newHandleName.trim()}
            className="text-xs text-primary hover:text-primary/80 disabled:text-muted-foreground"
          >
            + Add
          </button>
        </fetcher.Form>
      </InspectSection>

      {/* Ontologies */}
      <InspectSection title="Ontologies" count={ontologies.length}>
        {ontologies.map(o => (
          <div key={o.id} className="flex items-center group">
            <ThingLink to={`../ontology/${o.id}`} label={o.name} color={o.color} />
            <fetcher.Form method="post" className="opacity-0 group-hover:opacity-100 mr-2">
              <input type="hidden" name="intent" value="remove-ontology" />
              <input type="hidden" name="ontologyId" value={o.id} />
              <button type="submit" className="text-destructive text-xs hover:text-destructive/80">
                ×
              </button>
            </fetcher.Form>
          </div>
        ))}
        {unassignedOntologies.length > 0 && (
          <fetcher.Form method="post" className="px-3 py-1">
            <input type="hidden" name="intent" value="assign-ontology" />
            <select
              name="ontologyId"
              onChange={e => {
                if (e.target.value) e.target.form?.requestSubmit()
              }}
              className="w-full px-1.5 py-0.5 text-xs border border-input rounded bg-background"
              defaultValue=""
            >
              <option value="" disabled>
                + Assign ontology...
              </option>
              {unassignedOntologies.map(o => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </fetcher.Form>
        )}
      </InspectSection>

      {/* Marks */}
      {marks.length > 0 && (
        <InspectSection title="Marks" count={marks.length}>
          <div className="flex gap-1 px-3 py-1 flex-wrap">
            {marks.map(m => (
              <Badge key={m.mark} variant="secondary" className="text-[10px]">
                {m.mark}
              </Badge>
            ))}
          </div>
        </InspectSection>
      )}

      {/* Connections */}
      <InspectSection title="Connections" count={connections.length}>
        {connections.map(c => {
          const isSource = c.sourceSpineId === spine.id
          const otherSpine = isSource ? c.targetSpineId : c.sourceSpineId
          const otherHandle = isSource ? c.targetHandleName : c.sourceHandleName
          const myHandle = isSource ? c.sourceHandleName : c.targetHandleName
          return (
            <ThingLink
              key={c.lineId}
              to={`../line/${c.lineId}`}
              label={`${otherHandle} on ${otherSpine.slice(0, 8)}`}
              sublabel={`via ${myHandle}`}
              icon={<span className="text-muted-foreground text-xs">↔</span>}
            />
          )
        })}
      </InspectSection>

      {/* Diagrams */}
      <InspectSection title="In Diagrams" count={diagrams.length}>
        {diagrams.map(d => (
          <ThingLink key={d.id} to={`/diagram/${d.id}`} label={d.name} icon={<span className="text-xs">📄</span>} />
        ))}
      </InspectSection>

      {/* Recent changes */}
      {recentEdits.length > 0 && (
        <InspectSection title="Recent Changes">
          {recentEdits.map(e => (
            <div key={e.id} className="px-3 py-0.5 text-[10px] text-muted-foreground">
              {e.op} on {e.tableName} · {new Date(e.ts!).toLocaleString()}
            </div>
          ))}
        </InspectSection>
      )}
    </InspectPanel>
  )
}
