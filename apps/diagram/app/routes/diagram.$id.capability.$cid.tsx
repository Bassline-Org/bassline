import { redirect } from 'react-router'
import type { Route } from './+types/diagram.$id.capability.$cid'
import { getCapability, getAnnotationsForEntity } from '~/db/queries'
import { db } from '~/db/connection'
import { annotations } from '~/db/schema'
import { eq, and } from 'drizzle-orm'
import { InspectPanel, InspectSection, ThingLink, InfoRow } from '~/components/inspect/InspectPanel'

export async function loader({ params }: Route.LoaderArgs) {
  const capability = await getCapability(params.cid!)
  if (!capability) return redirect(`/diagram/${params.id}`)

  // Find all annotations that reference this capability (i.e., all handles it's attached to)
  const bindings = await db
    .select()
    .from(annotations)
    .where(and(eq(annotations.kind, 'capability'), eq(annotations.refId, capability.id)))

  return { capability, bindings }
}

export default function CapabilityInspect({ loaderData }: Route.ComponentProps) {
  const { capability, bindings } = loaderData

  return (
    <InspectPanel title={capability.name} subtitle="Capability">
      <InspectSection title="Info">
        <InfoRow label="ID">
          <code className="text-[10px] text-muted-foreground">{capability.id.slice(0, 12)}...</code>
        </InfoRow>
        <InfoRow label="URL">
          <code className="text-[10px]">{capability.url}</code>
        </InfoRow>
        <InfoRow label="Trigger">{capability.triggerOn}</InfoRow>
        {capability.description && <InfoRow label="Description">{capability.description}</InfoRow>}
      </InspectSection>

      <InspectSection title="Attached To" count={bindings.length}>
        {bindings.map(b => (
          <ThingLink
            key={b.id}
            to={`../${b.entityType}/${b.entityId}`}
            label={b.entityId.slice(0, 12)}
            sublabel={b.entityType}
            icon={<span className="text-xs text-muted-foreground">◆</span>}
          />
        ))}
        {bindings.length === 0 && (
          <div className="px-3 py-1 text-xs text-muted-foreground italic">Not attached to anything</div>
        )}
      </InspectSection>
    </InspectPanel>
  )
}
