import { routes } from '@bassline/core'

/**
 * Built-in type definitions
 */
export const TYPES = {
  index: {
    name: 'Index',
    description: 'Root system index listing all available subsystems',
    schema: {
      name: { type: 'string', description: 'System name' },
      description: { type: 'string', description: 'System description' },
      subsystems: { type: 'array', description: 'Available subsystems' }
    }
  },
  directory: {
    name: 'Directory',
    description: 'A collection of resources',
    schema: {
      entries: { type: 'array', description: 'Directory entries' }
    }
  },
  cell: {
    name: 'Cell',
    description: 'A lattice-based reactive value with monotonic merge semantics',
    schema: {
      value: { type: 'any', description: 'Current cell value' },
      lattice: { type: 'string', description: 'Lattice type (maxNumber, minNumber, setUnion, lww)' },
      label: { type: 'string', description: 'Human-readable label' }
    }
  },
  note: {
    name: 'Note',
    description: 'A text note or document',
    schema: {
      title: { type: 'string', description: 'Note title' },
      content: { type: 'string', description: 'Note content' },
      tags: { type: 'array', description: 'Tags for categorization' }
    }
  },
  task: {
    name: 'Task',
    description: 'A task or todo item',
    schema: {
      title: { type: 'string', description: 'Task title' },
      status: { type: 'string', description: 'Task status (todo, in progress, done)' },
      assignee: { type: 'string', description: 'Assigned person URI' },
      due: { type: 'string', description: 'Due date' }
    }
  },
  person: {
    name: 'Person',
    description: 'A person or contact',
    schema: {
      name: { type: 'string', description: 'Full name' },
      email: { type: 'string', description: 'Email address' },
      role: { type: 'string', description: 'Role or title' },
      avatar: { type: 'string', description: 'Avatar emoji or URL' }
    }
  },
  type: {
    name: 'Type',
    description: 'A type definition describing the shape of resources',
    schema: {
      name: { type: 'string', description: 'Type name' },
      description: { type: 'string', description: 'Type description' },
      schema: { type: 'object', description: 'Schema defining fields' }
    }
  },
  module: {
    name: 'Module',
    description: 'An installed module or upgrade',
    schema: {
      path: { type: 'string', description: 'Module path' },
      installedAt: { type: 'string', description: 'Installation timestamp' }
    }
  },
  remote: {
    name: 'Remote',
    description: 'A remote WebSocket connection to another Bassline instance',
    schema: {
      uri: { type: 'string', description: 'WebSocket URI' },
      mount: { type: 'string', description: 'Mount point path' },
      status: { type: 'string', description: 'Connection status' }
    }
  },
  propagator: {
    name: 'Propagator',
    description: 'A reactive propagator connecting cells',
    schema: {
      inputs: { type: 'array', description: 'Input cell URIs' },
      output: { type: 'string', description: 'Output cell URI' },
      handler: { type: 'string', description: 'Handler function name' }
    }
  },
  recipe: {
    name: 'Recipe',
    description: 'A template for creating multiple coordinated resources',
    schema: {
      description: { type: 'string', description: 'Recipe description' },
      params: { type: 'object', description: 'Parameter definitions with type and default' },
      resources: { type: 'array', description: 'Resource templates to create on instantiation' }
    }
  },
  instance: {
    name: 'Instance',
    description: 'An instantiated recipe with tracked resources',
    schema: {
      recipe: { type: 'string', description: 'Recipe URI' },
      params: { type: 'object', description: 'Parameter values used' },
      createdResources: { type: 'array', description: 'Resources created by this instance' },
      state: { type: 'string', description: 'Instance state (active, deleted)' },
      createdAt: { type: 'string', description: 'Creation timestamp' }
    }
  },
  handler: {
    name: 'Handler',
    description: 'A named function for transforming values in propagators',
    schema: {
      name: { type: 'string', description: 'Handler name' },
      builtin: { type: 'boolean', description: 'Whether this is a built-in handler' },
      description: { type: 'string', description: 'Handler description' },
      createdAt: { type: 'string', description: 'Creation timestamp (null for built-in)' },
      entries: { type: 'array', description: 'Sub-resources (definition, docs)' }
    }
  },
  'handler-definition': {
    name: 'Handler Definition',
    description: 'How a handler is implemented',
    schema: {
      type: { type: 'string', description: 'builtin or composed' },
      definition: { type: 'array', description: 'Hiccup-style definition [handler, config?, ...args]' }
    }
  },
  val: {
    name: 'Val',
    description: 'A shareable, forkable resource composition definition',
    schema: {
      name: { type: 'string', description: 'Val name' },
      owner: { type: 'string', description: 'Val owner' },
      description: { type: 'string', description: 'Val description' },
      valType: { type: 'string', description: 'Type: propagator, recipe, handler, cell, plumber-rule' },
      definition: { type: 'object', description: 'The val definition (varies by valType)' },
      visibility: { type: 'string', description: 'Visibility: public, unlisted, private' },
      tags: { type: 'array', description: 'Tags for categorization' },
      parentVal: { type: 'string', description: 'Parent val URI if forked' },
      parentVersion: { type: 'number', description: 'Parent version if forked' },
      version: { type: 'number', description: 'Current version number' },
      createdAt: { type: 'string', description: 'Creation timestamp' },
      updatedAt: { type: 'string', description: 'Last update timestamp' }
    }
  },
  'val-version': {
    name: 'Val Version',
    description: 'An immutable snapshot of a val at a specific version',
    schema: {
      version: { type: 'number', description: 'Version number' },
      definition: { type: 'object', description: 'Val definition at this version' },
      createdAt: { type: 'string', description: 'Creation timestamp' }
    }
  },
  'val-saved': {
    name: 'Val Saved Event',
    description: 'Event dispatched when a val is created or updated',
    schema: {
      val: { type: 'string', description: 'Val key (owner/name)' },
      version: { type: 'number', description: 'New version number' }
    }
  }
}

/**
 * Install types routes
 * @param {import('@bassline/core').Bassline} bl - Bassline instance
 */
export default function installTypes(bl) {
  const typeRoutes = routes('/types', r => {
    // List all types
    r.get('/', () => ({
      headers: { type: 'bl:///types/directory' },
      body: {
        entries: Object.entries(TYPES).map(([name, def]) => ({
          name,
          type: 'type',
          uri: `bl:///types/${name}`,
          description: def.description
        }))
      }
    }))

    // Get specific type
    r.get('/:name', ({ params }) => {
      const def = TYPES[params.name]
      if (!def) return null

      return {
        headers: { type: 'bl:///types/type' },
        body: {
          name: def.name,
          description: def.description,
          schema: def.schema
        }
      }
    })
  })

  bl.install(typeRoutes)
}
