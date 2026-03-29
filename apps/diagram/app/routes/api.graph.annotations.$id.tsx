import { getAnnotation, deleteAnnotation } from '~/db/queries'

export async function loader({ params }: { params: { id: string } }) {
  const annotation = await getAnnotation(params.id)
  if (!annotation) return Response.json({ error: 'not found' }, { status: 404 })
  return Response.json(annotation)
}

export async function action({ params, request }: { params: { id: string }; request: Request }) {
  if (request.method === 'DELETE') {
    await deleteAnnotation(params.id)
    return Response.json({ ok: true })
  }
  return Response.json({ error: 'method not allowed' }, { status: 405 })
}
