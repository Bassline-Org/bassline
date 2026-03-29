import { getSpine, deleteSpine, notifyChange } from '~/db/queries'

export async function loader({ params }: { params: { id: string } }) {
  const spine = await getSpine(params.id)
  if (!spine) return Response.json({ error: 'not found' }, { status: 404 })
  return Response.json(spine)
}

export async function action({ params, request }: { params: { id: string }; request: Request }) {
  if (request.method === 'DELETE') {
    await notifyChange('spine', params.id, 'delete')
    await deleteSpine(params.id)
    return Response.json({ ok: true })
  }
  return Response.json({ error: 'method not allowed' }, { status: 405 })
}
