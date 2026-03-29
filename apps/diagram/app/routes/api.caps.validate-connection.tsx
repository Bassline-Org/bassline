import {
  getHandle,
  getLinesForHandle,
  getEntityOntologies,
  getAnnotationsForEntity,
  createAnnotation,
  deleteAnnotation,
} from '~/db/queries'

export async function action({ request }: { request: Request }) {
  const { entityId, entityType } = await request.json()

  // This capability validates that connected handles share at least one ontology.
  // It operates on handles — checks all lines connected to the handle.
  if (entityType !== 'handle' && entityType !== 'line') {
    return Response.json({ status: 'skipped', reason: `unsupported entity type: ${entityType}` })
  }

  // If triggered by a line change, validate both handles
  let handleIds: string[] = []
  if (entityType === 'line') {
    const { getLine } = await import('~/db/queries')
    const line = await getLine(entityId)
    if (line) handleIds = [line.sourceHandleId, line.targetHandleId]
  } else {
    handleIds = [entityId]
  }

  let warnings = 0

  for (const handleId of handleIds) {
    const handle = await getHandle(handleId)
    if (!handle) continue

    const connections = await getLinesForHandle(handleId)
    const mySpineOnts = await getEntityOntologies(handle.spineId, 'spine')

    for (const conn of connections) {
      const otherSpineId = conn.sourceSpineId === handle.spineId ? conn.targetSpineId : conn.sourceSpineId
      const otherOnts = await getEntityOntologies(otherSpineId, 'spine')

      const compatible =
        mySpineOnts.length === 0 ||
        otherOnts.length === 0 ||
        mySpineOnts.some(mo => otherOnts.some(oo => mo.id === oo.id))

      // Check for existing warning on this line
      const existingAnnotations = await getAnnotationsForEntity(conn.lineId, 'warning')

      if (!compatible && existingAnnotations.length === 0) {
        await createAnnotation(conn.lineId, 'line', 'warning', {
          textValue: 'Connected spines have no shared ontology',
        })
        warnings++
      } else if (compatible && existingAnnotations.length > 0) {
        // Clear warnings if now compatible
        for (const ann of existingAnnotations) {
          await deleteAnnotation(ann.id)
        }
      }
    }
  }

  return Response.json({ status: 'ok', warnings })
}
