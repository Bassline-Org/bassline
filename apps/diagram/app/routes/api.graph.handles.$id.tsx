import { getHandle, deleteHandle, notifyChange } from '~/db/queries'

export async function loader({ params }: { params: { id: string } }) {
  const handle = await getHandle(params.id)
  if (!handle) return Response.json({ error: 'not found' }, { status: 404 })
  return Response.json(handle)
}

export async function action({ params, request }: { params: { id: string }; request: Request }) {
  if (request.method === 'DELETE') {
    await notifyChange('handle', params.id, 'delete')
    await deleteHandle(params.id)
    return Response.json({ ok: true })
  }
  return Response.json({ error: 'method not allowed' }, { status: 405 })
}
