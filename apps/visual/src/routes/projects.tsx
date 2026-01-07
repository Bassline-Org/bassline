import { useLoaderData, Form, useFetcher, Link } from 'react-router'
import { Settings, Trash2 } from 'lucide-react'
import type { ProjectsLoaderData, Project } from '../types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export function ProjectList() {
  const { projects } = useLoaderData() as ProjectsLoaderData

  return (
    <div className="h-screen flex flex-col">
      <header className="flex justify-between items-center px-6 py-4 bg-card border-b border-border">
        <h1 className="text-xl font-semibold">Bassline Visual</h1>
        <div className="flex items-center gap-2">
          <Form method="post">
            <input type="hidden" name="intent" value="create" />
            <Button type="submit">New Project</Button>
          </Form>
          <Button variant="ghost" size="icon" asChild>
            <Link to="/settings" title="Settings">
              <Settings className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </header>

      <main className="flex-1 p-6 overflow-y-auto">
        {projects.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>No projects yet. Create one to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

function ProjectCard({ project }: { project: Project }) {
  const fetcher = useFetcher()
  const isDeleting = fetcher.state !== 'idle'

  return (
    <Card className={cn(
      'overflow-hidden transition-all hover:border-primary',
      isDeleting && 'opacity-50'
    )}>
      <Link to={`/project/${project.id}`} className="block p-4 hover:bg-muted/30 transition-colors">
        <h3 className="font-medium mb-1">{project.name}</h3>
        <time className="text-sm text-muted-foreground">
          {new Date(project.modified_at).toLocaleDateString()}
        </time>
      </Link>
      <CardContent className="px-4 pb-4 pt-0">
        <fetcher.Form method="post">
          <input type="hidden" name="intent" value="delete" />
          <input type="hidden" name="id" value={project.id} />
          <Button
            type="submit"
            variant="destructive"
            size="sm"
            className="w-full"
            onClick={(e) => {
              if (!confirm('Delete this project?')) {
                e.preventDefault()
              }
            }}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Delete
          </Button>
        </fetcher.Form>
      </CardContent>
    </Card>
  )
}
