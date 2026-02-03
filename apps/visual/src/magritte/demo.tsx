/**
 * Demo: Magritte Relation Descriptions
 *
 * This demonstrates composed forms with toOne and toMany relations.
 */

import { describe, prop, type AnyDescription } from './description'
import { DescribedForm } from './fields'
import { useDescribedState } from './hooks'

// === Models ===

type Author = {
  name: string
  email: string
}

type Task = {
  title: string
  completed: boolean
}

type Project = {
  name: string
  author: Author | null
  tasks: Task[]
}

// === Descriptions ===

const authorDescription = describe.container<Author>({
  children: [
    describe.string<Author>({ accessor: prop('name'), label: 'Name', required: true }),
    describe.string<Author>({ accessor: prop('email'), label: 'Email', placeholder: 'user@example.com' }),
  ],
})

const taskDescription = describe.container<Task>({
  children: [
    describe.string<Task>({ accessor: prop('title'), label: 'Title', required: true }),
    describe.boolean<Task>({ accessor: prop('completed'), label: 'Done', style: 'checkbox' }),
  ],
})

// Sample authors for the dropdown
const availableAuthors: Author[] = [
  { name: 'Alice Smith', email: 'alice@example.com' },
  { name: 'Bob Johnson', email: 'bob@example.com' },
  { name: 'Carol White', email: 'carol@example.com' },
]

const projectDescription = describe.container<Project>({
  children: [
    describe.string<Project>({
      accessor: prop('name'),
      label: 'Project Name',
      required: true,
      priority: 1,
    }),

    describe.toOne<Project, Author>({
      accessor: prop('author'),
      label: 'Author',
      reference: () => authorDescription,
      options: () => availableAuthors,
      optionLabel: a => a.name,
      nullable: true,
      priority: 2,
    }),

    describe.toMany<Project, Task>({
      accessor: prop('tasks'),
      label: 'Tasks',
      reference: () => taskDescription,
      createItem: () => ({ title: '', completed: false }),
      minItems: 0,
      maxItems: 10,
      priority: 3,
    }),
  ],
})

// === Demo Component ===

export function RelationsDemo() {
  const { draft, update, validation, hasErrors } = useDescribedState(projectDescription, {
    name: 'My Project',
    author: availableAuthors[0],
    tasks: [
      { title: 'Setup project', completed: true },
      { title: 'Write tests', completed: false },
    ],
  })

  const handleChange = (desc: AnyDescription<Project>, value: unknown) => {
    // Cast description to the expected type for update
    update(
      desc as AnyDescription<Project> & {
        accessor: { read: (m: Project) => unknown; write: (m: Project, v: unknown) => Project }
      },
      value
    )
  }

  return (
    <div className="p-6 max-w-xl">
      <h2 className="text-lg font-semibold mb-4">Project Form</h2>
      <DescribedForm
        description={projectDescription}
        model={draft}
        onChange={handleChange}
        validation={validation}
        hasErrors={hasErrors}
      />
      <div className="mt-6 p-4 bg-muted rounded-md">
        <h3 className="text-sm font-medium mb-2">Current State:</h3>
        <pre className="text-xs overflow-auto">{JSON.stringify(draft, null, 2)}</pre>
      </div>
    </div>
  )
}
