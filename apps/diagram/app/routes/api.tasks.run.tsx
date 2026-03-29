import { getPendingTasks, clearTask, recordFailure } from '~/db/queries'

export async function action({ request }: { request: Request }) {
  const pending = await getPendingTasks()
  let completed = 0
  let failed = 0

  for (const task of pending) {
    try {
      const baseUrl = new URL(request.url).origin
      const res = await fetch(`${baseUrl}${task.capabilityUrl}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityId: task.entityId,
          entityType: task.entityType,
          context: task.context,
        }),
      })
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`)
      await clearTask(task.id)
      completed++
    } catch (err: any) {
      await recordFailure(
        {
          capabilityId: task.capabilityId,
          entityId: task.entityId,
          entityType: task.entityType,
          triggerEditId: task.triggerEditId,
          context: task.context,
        },
        err.message ?? String(err)
      )
      await clearTask(task.id)
      failed++
    }
  }

  const newTasks = await getPendingTasks()
  return Response.json({ completed, failed, newTasksQueued: newTasks.length })
}
