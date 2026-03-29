import { createHandle, notifyChange } from '~/db/queries'

export async function action({ request }: { request: Request }) {
  const { spineId, name } = await request.json()
  if (!spineId || !name) return Response.json({ error: 'spineId and name required' }, { status: 400 })
  const handle = await createHandle(spineId, name)
  await notifyChange('handle', handle.id, 'create')
  return Response.json(handle)
}
