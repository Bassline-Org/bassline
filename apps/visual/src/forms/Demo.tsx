import { atom, useAtom } from 'jotai'
import { Form } from './Form'
import { projectSchema, type Project } from './schemas'

const projectAtom = atom<Project>({
  name: 'my-project',
  author: { name: 'Alice', email: 'alice@example.com' },
  tasks: [
    { title: 'Setup project', completed: true },
    { title: 'Write tests', completed: false },
  ],
})

export function FormsDemo() {
  const [project, setProject] = useAtom(projectAtom)

  return (
    <div className="max-w-md mx-auto p-4">
      <h2 className="text-lg font-semibold mb-4">Project Editor</h2>
      <Form schema={projectSchema} values={project} onSubmit={setProject} submitLabel="Save Project" />
      <div className="mt-4 p-2 bg-muted rounded text-sm">
        <strong>Current state:</strong>
        <pre className="mt-2 text-xs overflow-auto">{JSON.stringify(project, null, 2)}</pre>
      </div>
    </div>
  )
}
