import { redirect } from 'react-router'
import type { Route } from './+types/diagram.$id.annotation.$aid'
import { getAnnotation } from '~/db/queries'
import { InspectPanel, InspectSection, ThingLink, InfoRow } from '~/components/inspect/InspectPanel'

export async function loader({ params }: Route.LoaderArgs) {
  const annotation = await getAnnotation(params.aid!)
  if (!annotation) return redirect(`/diagram/${params.id}`)
  return { annotation }
}

export default function AnnotationInspect({ loaderData }: Route.ComponentProps) {
  const { annotation } = loaderData

  return (
    <InspectPanel title={annotation.kind} subtitle="Annotation">
      <InspectSection title="Info">
        <InfoRow label="ID">
          <code className="text-[10px] text-muted-foreground">{annotation.id.slice(0, 12)}...</code>
        </InfoRow>
        <InfoRow label="Kind">{annotation.kind}</InfoRow>
        <InfoRow label="Entity Type">{annotation.entityType}</InfoRow>
      </InspectSection>

      <InspectSection title="Subject">
        <ThingLink
          to={`../${annotation.entityType}/${annotation.entityId}`}
          label={annotation.entityId.slice(0, 12)}
          sublabel={annotation.entityType}
        />
      </InspectSection>

      {annotation.refId && (
        <InspectSection title="References">
          <ThingLink
            to={`../${annotation.refType}/${annotation.refId}`}
            label={annotation.refId.slice(0, 12)}
            sublabel={annotation.refType ?? ''}
          />
        </InspectSection>
      )}

      <InspectSection title="Values">
        {annotation.textValue && <InfoRow label="Text">{annotation.textValue}</InfoRow>}
        {annotation.urlValue && <InfoRow label="URL">{annotation.urlValue}</InfoRow>}
        {annotation.numberValue != null && <InfoRow label="Number">{String(annotation.numberValue)}</InfoRow>}
        {annotation.boolValue != null && <InfoRow label="Bool">{String(annotation.boolValue)}</InfoRow>}
        {annotation.jsonValue && (
          <div className="px-3 py-1">
            <div className="text-[10px] text-muted-foreground mb-1">JSON</div>
            <pre className="text-[10px] bg-muted p-2 rounded overflow-auto max-h-40">
              {JSON.stringify(annotation.jsonValue, null, 2)}
            </pre>
          </div>
        )}
      </InspectSection>
    </InspectPanel>
  )
}
