import { listCapabilities, createCapability } from '~/db/queries'

export async function loader() {
  const caps = await listCapabilities()
  return Response.json(caps)
}

export async function action({ request }: { request: Request }) {
  const { name, url, description, triggerOn } = await request.json()
  if (!name || !url || !triggerOn) {
    return Response.json({ error: 'name, url, and triggerOn required' }, { status: 400 })
  }
  const cap = await createCapability(name, url, description ?? null, triggerOn)
  return Response.json(cap)
}
