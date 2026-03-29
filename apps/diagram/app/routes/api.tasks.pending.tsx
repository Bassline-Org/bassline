import { getPendingTasks } from '~/db/queries'

export async function loader() {
  const tasks = await getPendingTasks()
  return Response.json(tasks)
}
