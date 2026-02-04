import { z } from 'zod'
import type { FieldDef, Schema } from './types'

/**
 * Convert a FieldDef to a Zod schema type
 */
export function fieldDefToZod(field: FieldDef): z.ZodTypeAny {
  let schema: z.ZodTypeAny

  switch (field.type) {
    case 'string': {
      let s = z.string()
      if (field.min !== undefined) s = s.min(field.min)
      if (field.max !== undefined) s = s.max(field.max)
      schema = s
      break
    }

    case 'number': {
      let n = z.number()
      if (field.min !== undefined) n = n.min(field.min)
      if (field.max !== undefined) n = n.max(field.max)
      schema = n
      break
    }

    case 'boolean': {
      schema = z.boolean()
      break
    }

    case 'ref': {
      // References are stored as strings (the path/name of the target)
      schema = z.string()
      break
    }

    case 'array': {
      if (field.items) {
        schema = z.array(fieldDefToZod(field.items))
      } else {
        schema = z.array(z.unknown())
      }
      if (field.min !== undefined) schema = (schema as z.ZodArray<any>).min(field.min)
      if (field.max !== undefined) schema = (schema as z.ZodArray<any>).max(field.max)
      break
    }

    case 'object': {
      if (field.fields) {
        const shape: Record<string, z.ZodTypeAny> = {}
        for (const [key, def] of Object.entries(field.fields)) {
          shape[key] = fieldDefToZod(def)
        }
        schema = z.object(shape)
      } else {
        schema = z.record(z.string(), z.unknown())
      }
      break
    }

    default:
      schema = z.unknown()
  }

  // Apply metadata
  if (field.label || field.placeholder) {
    schema = schema.meta({
      label: field.label,
      placeholder: field.placeholder,
    })
  }

  // Handle optional/required
  if (!field.required) {
    schema = schema.optional()
  }

  return schema
}

/**
 * Convert a Schema object to a Zod object schema
 */
export function schemaToZod(schema: Schema): z.ZodObject<z.ZodRawShape> {
  const shape: Record<string, z.ZodTypeAny> = {}

  for (const [key, field] of Object.entries(schema.fields)) {
    shape[key] = fieldDefToZod(field)
  }

  return z.object(shape)
}

/**
 * Create a Zod schema for adding an entity (path + schema selection + fields)
 */
export function createAddEntitySchema(schemaNames: string[]): z.ZodObject<z.ZodRawShape> {
  return z.object({
    path: z.string().min(1).meta({ label: 'Path', placeholder: 'myEntity' }),
    $schema: z.enum(schemaNames as [string, ...string[]]).meta({ label: 'Schema' }),
  })
}

/**
 * Create a Zod schema for creating a new query
 */
export function createNewQuerySchema(schemaNames: string[]): z.ZodObject<z.ZodRawShape> {
  const schemaEnum =
    schemaNames.length > 0 ? z.enum(schemaNames as [string, ...string[]]).optional() : z.string().optional()

  return z.object({
    name: z.string().min(1).meta({ label: 'Name', placeholder: 'myQuery' }),
    description: z.string().optional().meta({ label: 'Description', placeholder: 'Query description' }),
    matchSchema: schemaEnum.meta({ label: 'Match Schema' }),
    matchKind: z.string().optional().meta({ label: 'Match Kind', placeholder: 'entity' }),
  })
}
