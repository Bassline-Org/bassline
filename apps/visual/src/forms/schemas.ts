import { z } from 'zod'

// Author schema with metadata
export const authorSchema = z.object({
  name: z.string().min(1, 'Name required').meta({
    label: 'Name',
    placeholder: 'Enter author name',
  }),
  email: z.string().email('Invalid email').meta({
    label: 'Email',
    placeholder: 'author@example.com',
  }),
})

export type Author = z.infer<typeof authorSchema>

// Task schema
export const taskSchema = z.object({
  title: z.string().min(1).meta({ label: 'Title' }),
  completed: z.boolean().meta({ label: 'Completed' }),
})

export type Task = z.infer<typeof taskSchema>

// Project schema with relations
export const projectSchema = z.object({
  name: z.string().min(1).meta({ label: 'Project Name' }),
  author: authorSchema.nullable().meta({ label: 'Author' }),
  tasks: z.array(taskSchema).meta({ label: 'Tasks' }),
})

export type Project = z.infer<typeof projectSchema>
