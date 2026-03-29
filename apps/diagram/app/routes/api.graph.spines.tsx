import { createSpine, notifyChange } from '~/db/queries'

export async function action({ request }: { request: Request }) {
  const { diagramId, x, y, label, layerId } = await request.json()
  if (!diagramId) return Response.json({ error: 'diagramId required' }, { status: 400 })
  const spine = await createSpine(diagramId, x ?? 0, y ?? 0, label, layerId)
  await notifyChange('spine', spine.id, 'create')
  return Response.json(spine)
}
