import { createLine, notifyChange } from '~/db/queries'

export async function action({ request }: { request: Request }) {
  const { diagramId, sourceHandleId, targetHandleId } = await request.json()
  if (!diagramId || !sourceHandleId || !targetHandleId) {
    return Response.json({ error: 'diagramId, sourceHandleId, and targetHandleId required' }, { status: 400 })
  }
  const line = await createLine(diagramId, sourceHandleId, targetHandleId)
  await notifyChange('line', line.id, 'connect')
  return Response.json(line)
}
