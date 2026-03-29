import { redirect } from 'react-router'
import type { Route } from './+types/diagram.$id.ontology.$oid'
import { getOntology, getSpinesWithOntology, getLinesWithOntology } from '~/db/queries'
import { InspectPanel, InspectSection, ThingLink, InfoRow } from '~/components/inspect/InspectPanel'

export async function loader({ params }: Route.LoaderArgs) {
  const ontology = await getOntology(params.oid!)
  if (!ontology) return redirect(`/diagram/${params.id}`)

  const [spines, lines] = await Promise.all([getSpinesWithOntology(ontology.id), getLinesWithOntology(ontology.id)])

  return { ontology, spines, lines }
}

export default function OntologyInspect({ loaderData }: Route.ComponentProps) {
  const { ontology, spines, lines } = loaderData

  return (
    <InspectPanel title={ontology.name} subtitle="Ontology" color={ontology.color}>
      <InspectSection title="Info">
        <InfoRow label="ID">
          <code className="text-[10px] text-muted-foreground">{ontology.id.slice(0, 12)}...</code>
        </InfoRow>
        <InfoRow label="Color">
          <span className="flex items-center gap-1.5">
            <span
              className="w-3 h-3 rounded border border-border"
              style={{ backgroundColor: ontology.color ?? '#ccc' }}
            />
            <code className="text-[10px]">{ontology.color ?? 'none'}</code>
          </span>
        </InfoRow>
      </InspectSection>

      <InspectSection title="Spines" count={spines.length}>
        {spines.map(s => (
          <ThingLink
            key={s.id}
            to={`../spine/${s.id}`}
            label={s.label ?? s.id.slice(0, 8)}
            icon={<span className="text-xs">□</span>}
          />
        ))}
        {spines.length === 0 && <div className="px-3 py-1 text-xs text-muted-foreground italic">No spines</div>}
      </InspectSection>

      <InspectSection title="Lines" count={lines.length}>
        {lines.map(l => (
          <ThingLink
            key={l.id}
            to={`../line/${l.id}`}
            label={`${l.sourceSpineId.slice(0, 6)} ↔ ${l.targetSpineId.slice(0, 6)}`}
            icon={<span className="text-muted-foreground text-xs">—</span>}
          />
        ))}
        {lines.length === 0 && <div className="px-3 py-1 text-xs text-muted-foreground italic">No lines</div>}
      </InspectSection>
    </InspectPanel>
  )
}
