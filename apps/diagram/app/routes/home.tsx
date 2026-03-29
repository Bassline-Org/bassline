import { Link, useFetcher, redirect } from 'react-router'
import type { Route } from './+types/home'
import { listDiagrams, createDiagram } from '~/db/queries'
import { Button } from '~/components/ui/button'

export function meta() {
  return [{ title: 'Bassline Diagrams' }]
}

export async function loader() {
  const diagrams = await listDiagrams()
  return { diagrams }
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData()
  const intent = form.get('intent')

  if (intent === 'create-diagram') {
    const name = (form.get('name') as string) || 'Untitled'
    const diagram = await createDiagram(name)
    return redirect(`/diagram/${diagram.id}`)
  }

  return null
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { diagrams } = loaderData
  const fetcher = useFetcher()

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="mb-6 text-2xl font-bold">Diagrams</h1>

      <fetcher.Form method="post" className="mb-8">
        <input type="hidden" name="intent" value="create-diagram" />
        <div className="flex gap-2">
          <input
            type="text"
            name="name"
            placeholder="New diagram name..."
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <Button type="submit">Create</Button>
        </div>
      </fetcher.Form>

      {diagrams.length === 0 ? (
        <p className="text-muted-foreground">No diagrams yet. Create one above.</p>
      ) : (
        <ul className="space-y-2">
          {diagrams.map(d => (
            <li key={d.id}>
              <Link
                to={`/diagram/${d.id}`}
                className="block rounded-lg border border-border p-4 transition-colors hover:bg-accent"
              >
                <span className="font-medium">{d.name}</span>
                <span className="ml-2 text-xs text-muted-foreground">{d.id.slice(0, 8)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
