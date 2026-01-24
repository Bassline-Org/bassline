import { createHashRouter, redirect } from 'react-router'
import { ProjectList } from './routes/projects'
import { Editor } from './routes/editor'
import { Settings } from './routes/settings'
import { Cards } from './routes/cards'
import { Repl } from './routes/repl'
import { bl } from './lib/bl'

export const router = createHashRouter([
  {
    path: '/',
    element: <ProjectList />,
    loader: async () => {
      const projects = await bl.projects.list()
      return { projects }
    },
    action: async ({ request }) => {
      const formData = await request.formData()
      const intent = formData.get('intent')

      if (intent === 'create') {
        const name = formData.get('name') as string
        const project = await bl.projects.create(name || 'Untitled Project')
        return redirect(`/project/${project.id}`)
      }

      if (intent === 'delete') {
        const id = formData.get('id') as string
        await bl.projects.delete(id)
        return { ok: true }
      }

      return null
    },
  },
  {
    path: '/project/:id',
    element: <Editor />,
    // All mutations go through bl client, useBl() triggers revalidation
    loader: async ({ params }) => {
      const projectId = params.id!
      const [project, entities, relationships, stamps, uiState] = await Promise.all([
        bl.projects.get(projectId),
        bl.entities.list(projectId),
        bl.relationships.list(projectId),
        bl.stamps.list(),
        bl.uiState.get(projectId),
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
  {
    path: '/cards',
    element: <Cards />,
    loader: async () => {
      const sets = await bl.cards.listSets()
      return { sets }
    },
  },
  {
    path: '/cards/set/:setId',
    element: <Cards />,
    loader: async ({ params }) => {
      const [sets, currentSetCards] = await Promise.all([
        bl.cards.listSets(),
        bl.cards.getSetCards(params.setId!),
      ])
      return { sets, currentSetId: params.setId, currentSetCards }
    },
  },
  {
    path: '/repl',
    element: <Repl />,
  },
])
