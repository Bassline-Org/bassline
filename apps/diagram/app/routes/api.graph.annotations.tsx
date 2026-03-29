import { createAnnotation, notifyChange } from '~/db/queries'

export async function action({ request }: { request: Request }) {
  const { entityId, entityType, kind, textValue, jsonValue, urlValue, refId, refType, numberValue, boolValue } =
    await request.json()
  if (!entityId || !entityType || !kind) {
    return Response.json({ error: 'entityId, entityType, and kind required' }, { status: 400 })
  }
  const annotation = await createAnnotation(entityId, entityType, kind, {
    textValue,
    jsonValue,
    urlValue,
    refId,
    refType,
    numberValue,
    boolValue,
  })
  await notifyChange(entityType, entityId, 'annotate')
  return Response.json(annotation)
}
