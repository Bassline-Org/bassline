import type { Route } from './+types/diagram.$id.handle.$hid'
import { getHandle, getSpine, getLinesForHandle, getEditsForEntity, getDiagramsForSpine } from '~/db/queries'
import { InspectPanel, InspectSection, ThingLink, InfoRow } from '~/components/inspect/InspectPanel'

export async function loader({ params }: Route.LoaderArgs) {
  const handle = await getHandle(params.hid!)
  if (!handle) throw new Response('Not Found', { status: 404 })

  const [spine, connections, recentEdits] = await Promise.all([
    getSpine(handle.spineId),
    getLinesForHandle(handle.id),
    getEditsForEntity(handle.id, 5),
  ])

  // Get the spine's label from the current diagram
  const spineInDiagrams = spine ? await getDiagramsForSpine(spine.id) : []
  const spineLabel = spineInDiagrams.find(d => d.id === params.id)?.label ?? spine?.id.slice(0, 8) ?? 'unknown'

  return { handle, spine, spineLabel, connections, recentEdits }
}

export default function HandleInspect({ loaderData }: Route.ComponentProps) {
  const { handle, spine, spineLabel, connections, recentEdits } = loaderData

  return (
    <InspectPanel title={handle.name} subtitle="Handle">
      <InspectSection title="Info">
        <InfoRow label="ID">
          <code className="text-[10px] text-muted-foreground">{handle.id.slice(0, 12)}...</code>
        </InfoRow>
        <InfoRow label="Name">{handle.name}</InfoRow>
      </InspectSection>

      <InspectSection title="On Spine">
        {spine && (
          <ThingLink to={`../spine/${spine.id}`} label={spineLabel} icon={<span className="text-xs">□</span>} />
        )}
      </InspectSection>

      <InspectSection title="Connections" count={connections.length}>
        {connections.map(c => {
          const isSource = c.sourceHandleId === handle.id
          const otherSpine = isSource ? c.targetSpineId : c.sourceSpineId
          const otherHandle = isSource ? c.targetHandleName : c.sourceHandleName
          return (
            <ThingLink
              key={c.lineId}
              to={`../line/${c.lineId}`}
              label={`${otherHandle} on ${otherSpine.slice(0, 8)}`}
              sublabel="via this handle"
              icon={<span className="text-muted-foreground text-xs">↔</span>}
            />
          )
        })}
        {connections.length === 0 && (
          <div className="px-3 py-1 text-xs text-muted-foreground italic">No connections</div>
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
