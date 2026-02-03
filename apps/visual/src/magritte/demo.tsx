/**
 * Demo: Magritte Bound Descriptions
 *
 * This demonstrates the new bound description pattern with:
 * - toOne and toMany relations
 * - Custom validators using conditions
 * - Consequential validation (warnings vs errors)
 */

import {
  schema,
  type ContainerSchema,
  conditionToValidator,
  combineValidators,
  minLength,
  maxLength,
  pattern,
  isEmail,
} from './index'
import { BoundForm } from './fields'
import { useBoundState } from './hooks'

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

// === Schemas with Validation ===

const authorSchema: ContainerSchema = schema.container({
  children: {
    name: schema.string({
      label: 'Name',
      required: true,
      minLength: 2,
      maxLength: 50,
      validate: combineValidators(
        conditionToValidator(minLength(2), 'Name must be at least 2 characters'),
        conditionToValidator(maxLength(50), 'Name too long', 'warning')
      ),
    }),
    email: schema.string({
      label: 'Email',
      placeholder: 'user@example.com',
      validate: (value: string) => {
        if (!value) return { valid: true, errors: [] } // Optional
        if (!isEmail(value)) {
          return { valid: false, errors: [{ message: 'Invalid email format', severity: 'warning' }] }
        }
        return { valid: true, errors: [] }
      },
    }),
  },
})

const taskSchema: ContainerSchema = schema.container({
  children: {
    title: schema.string({
      label: 'Title',
      required: true,
      minLength: 1,
      maxLength: 100,
      validate: conditionToValidator(minLength(1), 'Task title is required'),
    }),
    completed: schema.boolean({ label: 'Done', style: 'checkbox' }),
  },
})

// Sample authors for the dropdown
const availableAuthors: Author[] = [
  { name: 'Alice Smith', email: 'alice@example.com' },
  { name: 'Bob Johnson', email: 'bob@example.com' },
  { name: 'Carol White', email: 'carol@example.com' },
]

const projectSchema: ContainerSchema = schema.container({
  children: {
    name: schema.string({
      label: 'Project Name',
      required: true,
      priority: 1,
      minLength: 3,
      maxLength: 50,
      placeholder: 'my-project',
      validate: combineValidators(
        conditionToValidator(minLength(3), 'Name must be at least 3 characters'),
        conditionToValidator(pattern(/^[a-z][a-z0-9-]*$/), 'Must be lowercase with hyphens only', 'warning')
      ),
    }),
    author: schema.toOne({
      label: 'Author',
      reference: () => authorSchema,
      options: () => availableAuthors,
      optionLabel: a => (a as Author).name,
      nullable: true,
      priority: 2,
    }),
    tasks: schema.toMany({
      label: 'Tasks',
      reference: () => taskSchema,
      createItem: () => ({ title: '', completed: false }),
      minItems: 0,
      maxItems: 10,
      priority: 3,
    }),
  },
})

// === Demo Component ===

export function RelationsDemo() {
  const { bound, model, validation, hasErrors, hasWarnings } = useBoundState<Project>(projectSchema, {
    name: 'My Project',
    author: availableAuthors[0],
    tasks: [
      { title: 'Setup project', completed: true },
      { title: 'Write tests', completed: false },
    ],
  })

  return (
    <div className="p-6 max-w-xl">
      <h2 className="text-lg font-semibold mb-4">Project Form</h2>
      <BoundForm bound={bound} validation={validation} hasErrors={hasErrors} />
      <div className="mt-6 p-4 bg-muted rounded-md">
        <h3 className="text-sm font-medium mb-2">Current State:</h3>
        <pre className="text-xs overflow-auto">{JSON.stringify(model, null, 2)}</pre>
        {hasErrors && <p className="text-red-500 text-sm mt-2">Has errors</p>}
        {hasWarnings && <p className="text-amber-500 text-sm mt-2">Has warnings</p>}
      </div>
    </div>
  )
}
