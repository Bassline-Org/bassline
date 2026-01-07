import { createHashRouter, redirect } from 'react-router'
import { ProjectList } from './routes/projects'
import { Editor } from './routes/editor'
import { Settings } from './routes/settings'

export const router = createHashRouter([
  {
    path: '/',
    element: <ProjectList />,
    loader: async () => {
      const projects = await window.db.projects.list()
      return { projects }
    },
    action: async ({ request }) => {
      const formData = await request.formData()
      const intent = formData.get('intent')

      if (intent === 'create') {
        const name = formData.get('name') as string
        const project = await window.db.projects.create(name || 'Untitled Project')
        return redirect(`/project/${project.id}`)
      }

      if (intent === 'delete') {
        const id = formData.get('id') as string
        await window.db.projects.delete(id)
        return { ok: true }
      }

      return null
    },
  },
  {
    path: '/project/:id',
    element: <Editor />,
    // All mutations now go through commands which trigger explicit revalidation
    loader: async ({ params }) => {
      const projectId = params.id!
      const [project, entities, relationships, stamps, uiState] = await Promise.all([
        window.db.projects.get(projectId),
        window.db.entities.list(projectId),
        window.db.relationships.list(projectId),
        window.db.stamps.list(),
        window.db.uiState.get(projectId),
      ])

      if (!project) {
        throw new Response('Project not found', { status: 404 })
      }

      return { project, entities, relationships, stamps, uiState }
    },
  },
  {
    path: '/settings',
    element: <Settings />,
  },
])
