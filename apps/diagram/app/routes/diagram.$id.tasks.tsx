import { useFetcher } from 'react-router'
import type { Route } from './+types/diagram.$id.tasks'
import { getPendingTasks, getTaskFailures, retryFailure, dismissFailure } from '~/db/queries'
import { InspectPanel, InspectSection } from '~/components/inspect/InspectPanel'

export async function loader() {
  const [pending, failures] = await Promise.all([getPendingTasks(), getTaskFailures(20)])
  return { pending, failures }
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData()
  const intent = form.get('intent')

  switch (intent) {
    case 'run-round': {
      const baseUrl = new URL(request.url).origin
      const res = await fetch(`${baseUrl}/api/tasks/run`, { method: 'POST' })
      return await res.json()
    }
    case 'retry': {
      await retryFailure(form.get('failureId') as string)
      break
    }
    case 'dismiss': {
      await dismissFailure(form.get('failureId') as string)
      break
    }
  }

  return null
}

export default function TaskQueue({ loaderData, actionData }: Route.ComponentProps) {
  const { pending, failures } = loaderData
  const fetcher = useFetcher()
  const roundResult = actionData as { completed?: number; failed?: number; newTasksQueued?: number } | null

  return (
    <InspectPanel title="Tasks" subtitle={`${pending.length} pending`}>
      {roundResult && (
        <div className="mx-3 my-2 p-2 rounded bg-muted text-xs">
          Round complete: {roundResult.completed} done, {roundResult.failed} failed, {roundResult.newTasksQueued} new
        </div>
      )}

      <InspectSection title="Pending" count={pending.length}>
        {pending.length > 0 ? (
          <>
            {pending.map(t => (
              <div key={t.id} className="px-3 py-1.5 text-xs">
                <span className="font-medium">{t.capabilityName}</span>
                <span className="text-muted-foreground ml-1">
                  on {t.entityType} {t.entityId.slice(0, 8)}
                </span>
              </div>
            ))}
            <fetcher.Form method="post" className="px-3 py-2">
              <input type="hidden" name="intent" value="run-round" />
              <button
                type="submit"
                disabled={fetcher.state !== 'idle'}
                className="w-full px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {fetcher.state !== 'idle' ? 'Running...' : 'Run Round'}
              </button>
            </fetcher.Form>
          </>
        ) : (
          <div className="px-3 py-2 text-xs text-muted-foreground italic">No pending tasks</div>
        )}
      </InspectSection>

      {failures.length > 0 && (
        <InspectSection title="Failures" count={failures.length}>
          {failures.map(f => (
            <div key={f.id} className="px-3 py-1.5 text-xs border-b border-border/50 last:border-0">
              <div className="font-medium">{f.capabilityName}</div>
              <div className="text-destructive mt-0.5">{f.error}</div>
              <div className="text-muted-foreground mt-0.5">{new Date(f.failedAt!).toLocaleString()}</div>
              <div className="flex gap-2 mt-1">
                <fetcher.Form method="post">
                  <input type="hidden" name="intent" value="retry" />
                  <input type="hidden" name="failureId" value={f.id} />
                  <button type="submit" className="text-primary hover:text-primary/80 text-[10px]">
                    Retry
                  </button>
                </fetcher.Form>
                <fetcher.Form method="post">
                  <input type="hidden" name="intent" value="dismiss" />
                  <input type="hidden" name="failureId" value={f.id} />
                  <button type="submit" className="text-muted-foreground hover:text-foreground text-[10px]">
                    Dismiss
                  </button>
                </fetcher.Form>
              </div>
            </div>
          ))}
        </InspectSection>
      )}
    </InspectPanel>
  )
}
