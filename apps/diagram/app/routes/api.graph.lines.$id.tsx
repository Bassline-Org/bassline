import { getLine, deleteLine, notifyChange } from '~/db/queries'

export async function loader({ params }: { params: { id: string } }) {
  const line = await getLine(params.id)
  if (!line) return Response.json({ error: 'not found' }, { status: 404 })
  return Response.json(line)
}

export async function action({ params, request }: { params: { id: string }; request: Request }) {
  if (request.method === 'DELETE') {
    await notifyChange('line', params.id, 'delete')
    await deleteLine(params.id)
    return Response.json({ ok: true })
  }
  return Response.json({ error: 'method not allowed' }, { status: 405 })
}
