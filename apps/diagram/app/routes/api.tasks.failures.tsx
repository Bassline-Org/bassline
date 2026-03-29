import { getTaskFailures } from '~/db/queries'

export async function loader() {
  const failures = await getTaskFailures()
  return Response.json(failures)
}
