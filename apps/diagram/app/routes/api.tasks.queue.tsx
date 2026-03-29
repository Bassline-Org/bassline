import { queueTask } from '~/db/queries'

export async function action({ request }: { request: Request }) {
  const { capabilityId, entityId, entityType, context } = await request.json()
  if (!capabilityId || !entityId || !entityType) {
    return Response.json({ error: 'capabilityId, entityId, and entityType required' }, { status: 400 })
  }
  const task = await queueTask(capabilityId, entityId, entityType, undefined, context)
  return Response.json(task)
}
