import { useFetcher, redirect } from 'react-router'
import type { Route } from './+types/diagram.$id.line.$lid'
import {
  getLine,
  getEntityOntologies,
  getEditsForEntity,
  listOntologies,
  getDiagramsForSpine,
  setEntityOntology,
  removeEntityOntology,
} from '~/db/queries'
import { InspectPanel, InspectSection, ThingLink, InfoRow } from '~/components/inspect/InspectPanel'

export async function loader({ params }: Route.LoaderArgs) {
  const line = await getLine(params.lid!)
  if (!line) return redirect(`/diagram/${params.id}`)

  const [ontologies, recentEdits, allOntologies] = await Promise.all([
    getEntityOntologies(line.id, 'line'),
    getEditsForEntity(line.id, 5),
    listOntologies(),
  ])

  const [sourceDiagrams, targetDiagrams] = await Promise.all([
    getDiagramsForSpine(line.sourceSpineId),
    getDiagramsForSpine(line.targetSpineId),
  ])
  const sourceLabel = sourceDiagrams.find(d => d.id === params.id)?.label ?? line.sourceSpineId.slice(0, 8)
  const targetLabel = targetDiagrams.find(d => d.id === params.id)?.label ?? line.targetSpineId.slice(0, 8)

  return { line, sourceLabel, targetLabel, ontologies, recentEdits, allOntologies }
}

export async function action({ request, params }: Route.ActionArgs) {
  const form = await request.formData()
  const intent = form.get('intent')
  const lineId = params.lid!

  switch (intent) {
    case 'assign-ontology':
      await setEntityOntology(lineId, 'line', form.get('ontologyId') as string)
      break
    case 'remove-ontology':
      await removeEntityOntology(lineId, 'line', form.get('ontologyId') as string)
      break
  }

  return null
}

export default function LineInspect({ loaderData }: Route.ComponentProps) {
  const { line, sourceLabel, targetLabel, ontologies, recentEdits, allOntologies } = loaderData
  const fetcher = useFetcher()
  const primaryColor = ontologies[0]?.color ?? null
  const unassignedOntologies = allOntologies.filter(o => !ontologies.some(lo => lo.id === o.id))

  return (
    <InspectPanel title="Line" subtitle={line.id.slice(0, 8)} color={primaryColor}>
      <InspectSection title="Endpoints">
        <div className="px-3 py-1 text-[10px] text-muted-foreground uppercase">From</div>
        <ThingLink
          to={`../spine/${line.sourceSpineId}`}
          label={sourceLabel}
          icon={<span className="text-xs">□</span>}
        />
        <ThingLink
          to={`../handle/${line.sourceHandleId}`}
          label={line.sourceHandleName}
          sublabel="handle"
          icon={<span className="text-xs text-muted-foreground">◆</span>}
        />
        <div className="px-3 py-1 text-[10px] text-muted-foreground uppercase mt-1">To</div>
        <ThingLink
          to={`../spine/${line.targetSpineId}`}
          label={targetLabel}
          icon={<span className="text-xs">□</span>}
        />
        <ThingLink
          to={`../handle/${line.targetHandleId}`}
          label={line.targetHandleName}
          sublabel="handle"
          icon={<span className="text-xs text-muted-foreground">◆</span>}
        />
      </InspectSection>

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
