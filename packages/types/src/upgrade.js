import { resource } from '@bassline/core'

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
      subsystems: { type: 'array', description: 'Available subsystems' },
    },
  },
  directory: {
    name: 'Directory',
    description: 'A collection of resources',
    schema: {
      entries: { type: 'array', description: 'Directory entries' },
    },
  },
  cell: {
    name: 'Cell',
    description: 'A lattice-based reactive value with monotonic merge semantics',
    schema: {
      value: { type: 'any', description: 'Current cell value' },
      lattice: {
        type: 'string',
        description: 'Lattice type (maxNumber, minNumber, setUnion, lww)',
      },
      label: { type: 'string', description: 'Human-readable label' },
    },
  },
  note: {
    name: 'Note',
    description: 'A text note or document',
    schema: {
      title: { type: 'string', description: 'Note title' },
      content: { type: 'string', description: 'Note content' },
      tags: { type: 'array', description: 'Tags for categorization' },
    },
  },
  task: {
    name: 'Task',
    description: 'A task or todo item',
    schema: {
      title: { type: 'string', description: 'Task title' },
      status: { type: 'string', description: 'Task status (todo, in progress, done)' },
      assignee: { type: 'string', description: 'Assigned person URI' },
      due: { type: 'string', description: 'Due date' },
    },
  },
  person: {
    name: 'Person',
    description: 'A person or contact',
    schema: {
      name: { type: 'string', description: 'Full name' },
      email: { type: 'string', description: 'Email address' },
      role: { type: 'string', description: 'Role or title' },
      avatar: { type: 'string', description: 'Avatar emoji or URL' },
    },
  },
  type: {
    name: 'Type',
    description: 'A type definition describing the shape of resources',
    schema: {
      name: { type: 'string', description: 'Type name' },
      description: { type: 'string', description: 'Type description' },
      schema: { type: 'object', description: 'Schema defining fields' },
    },
  },
  module: {
    name: 'Module',
    description: 'An installed module or upgrade',
    schema: {
      path: { type: 'string', description: 'Module path' },
      installedAt: { type: 'string', description: 'Installation timestamp' },
    },
  },
  remote: {
    name: 'Remote',
    description: 'A remote WebSocket connection to another Bassline instance',
    schema: {
      uri: { type: 'string', description: 'WebSocket URI' },
      mount: { type: 'string', description: 'Mount point path' },
      status: { type: 'string', description: 'Connection status' },
    },
  },
  propagator: {
    name: 'Propagator',
    description: 'A reactive propagator connecting cells',
    schema: {
      inputs: { type: 'array', description: 'Input cell URIs' },
      output: { type: 'string', description: 'Output cell URI' },
      handler: { type: 'string', description: 'Handler function name' },
    },
  },
  recipe: {
    name: 'Recipe',
    description: 'A template for creating multiple coordinated resources',
    schema: {
      description: { type: 'string', description: 'Recipe description' },
      params: { type: 'object', description: 'Parameter definitions with type and default' },
      resources: { type: 'array', description: 'Resource templates to create on instantiation' },
    },
  },
  instance: {
    name: 'Instance',
    description: 'An instantiated recipe with tracked resources',
    schema: {
      recipe: { type: 'string', description: 'Recipe URI' },
      params: { type: 'object', description: 'Parameter values used' },
      createdResources: { type: 'array', description: 'Resources created by this instance' },
      state: { type: 'string', description: 'Instance state (active, deleted)' },
      createdAt: { type: 'string', description: 'Creation timestamp' },
    },
  },
  handler: {
    name: 'Handler',
    description: 'A named function for transforming values in propagators',
    schema: {
      name: { type: 'string', description: 'Handler name' },
      builtin: { type: 'boolean', description: 'Whether this is a built-in handler' },
      description: { type: 'string', description: 'Handler description' },
      createdAt: { type: 'string', description: 'Creation timestamp (null for built-in)' },
      entries: { type: 'array', description: 'Sub-resources (definition, docs)' },
    },
  },
  'handler-definition': {
    name: 'Handler Definition',
    description: 'How a handler is implemented',
    schema: {
      type: { type: 'string', description: 'builtin or composed' },
      definition: {
        type: 'array',
        description: 'Hiccup-style definition [handler, config?, ...args]',
      },
    },
  },
  val: {
    name: 'Val',
    description: 'A shareable, forkable resource composition definition',
    schema: {
      name: { type: 'string', description: 'Val name' },
      owner: { type: 'string', description: 'Val owner' },
      description: { type: 'string', description: 'Val description' },
      valType: {
        type: 'string',
        description: 'Type: propagator, recipe, handler, cell, plumber-rule',
      },
      definition: { type: 'object', description: 'The val definition (varies by valType)' },
      visibility: { type: 'string', description: 'Visibility: public, unlisted, private' },
      tags: { type: 'array', description: 'Tags for categorization' },
      parentVal: { type: 'string', description: 'Parent val URI if forked' },
      parentVersion: { type: 'number', description: 'Parent version if forked' },
      version: { type: 'number', description: 'Current version number' },
      createdAt: { type: 'string', description: 'Creation timestamp' },
      updatedAt: { type: 'string', description: 'Last update timestamp' },
    },
  },
  'val-version': {
    name: 'Val Version',
    description: 'An immutable snapshot of a val at a specific version',
    schema: {
      version: { type: 'number', description: 'Version number' },
      definition: { type: 'object', description: 'Val definition at this version' },
      createdAt: { type: 'string', description: 'Creation timestamp' },
    },
  },
  'val-saved': {
    name: 'Val Saved Event',
    description: 'Event dispatched when a val is created or updated',
    schema: {
      val: { type: 'string', description: 'Val key (owner/name)' },
      version: { type: 'number', description: 'New version number' },
    },
  },
  service: {
    name: 'Service',
    description: 'An external service integration',
    schema: {
      name: { type: 'string', description: 'Service name' },
      description: { type: 'string', description: 'Service description' },
      version: { type: 'string', description: 'Service version' },
      operations: { type: 'array', description: 'Available operations' },
    },
  },
  'database-connection': {
    name: 'Database Connection',
    description: 'A database connection configuration',
    schema: {
      name: { type: 'string', description: 'Connection name' },
      driver: { type: 'string', description: 'Database driver (sqlite, postgres, mysql)' },
      path: { type: 'string', description: 'Database file path (SQLite)' },
      readonly: { type: 'boolean', description: 'Readonly mode' },
      connected: { type: 'boolean', description: 'Connection status' },
    },
  },
  'database-result': {
    name: 'Database Query Result',
    description: 'Result from executing a database query',
    schema: {
      rows: { type: 'array', description: 'Result rows' },
      columns: { type: 'array', description: 'Column metadata' },
      rowCount: { type: 'number', description: 'Number of rows returned' },
    },
  },
  'database-execute-result': {
    name: 'Database Execute Result',
    description: 'Result from executing a database statement',
    schema: {
      changes: { type: 'number', description: 'Number of rows affected' },
      lastInsertRowid: { type: 'number', description: 'Last inserted row ID' },
    },
  },
  'database-schema': {
    name: 'Database Schema',
    description: 'Database schema information',
    schema: {
      connection: { type: 'string', description: 'Connection name' },
      tables: { type: 'array', description: 'Tables in the database' },
    },
  },
  'database-table': {
    name: 'Database Table',
    description: 'Table schema information',
    schema: {
      name: { type: 'string', description: 'Table name' },
      type: { type: 'string', description: 'table or view' },
      columns: { type: 'array', description: 'Column definitions' },
      indexes: { type: 'array', description: 'Index definitions' },
    },
  },
  'database-change': {
    name: 'Database Change Event',
    description: 'Event dispatched when database is modified',
    schema: {
      connection: { type: 'string', description: 'Connection name' },
      sql: { type: 'string', description: 'SQL statement executed' },
      changes: { type: 'number', description: 'Number of rows affected' },
    },
  },
  'database-pragma-result': {
    name: 'Database PRAGMA Result',
    description: 'Result from SQLite PRAGMA command',
    schema: {
      result: { type: 'any', description: 'PRAGMA result value' },
    },
  },

  // Widget types
  widget: {
    name: 'Widget',
    description: 'Base widget type for all UI widgets',
    schema: {
      name: { type: 'string', description: 'Widget name' },
      primitive: { type: 'boolean', description: 'Whether this is a primitive widget' },
      props: { type: 'object', description: 'Props schema' },
      description: { type: 'string', description: 'Widget description' },
    },
  },
  'widget-definition': {
    name: 'Widget Definition',
    description: 'How a widget is implemented',
    schema: {
      type: { type: 'string', description: 'primitive or composed' },
      name: { type: 'string', description: 'Widget name (for primitives)' },
      definition: {
        type: 'array',
        description: 'Hiccup-style definition [widget, props?, ...children]',
      },
    },
  },
  'props-schema': {
    name: 'Props Schema',
    description: 'Schema defining widget props',
    schema: {},
  },

  // Widget category types (layout combinators)
  'widgets/layout/box': {
    name: 'Box Widget',
    description: 'Basic container widget',
    schema: {
      style: { type: 'object', description: 'CSS styles' },
      className: { type: 'string', description: 'CSS class name' },
    },
  },
  'widgets/layout/stack': {
    name: 'Stack Widget',
    description: 'Flex-based vertical or horizontal stack',
    schema: {
      direction: { type: 'string', description: 'vertical or horizontal' },
      gap: { type: 'number', description: 'Gap between children' },
      align: { type: 'string', description: 'Cross-axis alignment' },
      justify: { type: 'string', description: 'Main-axis justification' },
    },
  },
  'widgets/layout/grid': {
    name: 'Grid Widget',
    description: 'CSS grid layout',
    schema: {
      columns: { type: 'string', description: 'Grid columns template' },
      rows: { type: 'string', description: 'Grid rows template' },
      gap: { type: 'number', description: 'Gap between cells' },
    },
  },

  // Widget category types (atoms)
  'widgets/atom/text': {
    name: 'Text Widget',
    description: 'Text content display',
    schema: {
      content: { type: 'string', description: 'Text content' },
      variant: { type: 'string', description: 'Text style variant' },
    },
  },
  'widgets/atom/button': {
    name: 'Button Widget',
    description: 'Clickable button element',
    schema: {
      label: { type: 'string', description: 'Button label' },
      variant: { type: 'string', description: 'Button style variant' },
      disabled: { type: 'boolean', description: 'Whether button is disabled' },
      onClick: { type: 'string', description: 'Plumber port for click events' },
    },
  },
  'widgets/atom/input': {
    name: 'Input Widget',
    description: 'Text input field',
    schema: {
      value: { type: 'string', description: 'Input value' },
      type: { type: 'string', description: 'Input type (text, password, etc.)' },
      placeholder: { type: 'string', description: 'Placeholder text' },
      onChange: { type: 'string', description: 'Plumber port for change events' },
    },
  },

  // Widget category types (compound)
  'widgets/compound/dialog': {
    name: 'Dialog Widget',
    description: 'Modal dialog with trigger and content',
    schema: {
      open: { type: 'boolean', description: 'Whether dialog is open' },
      onOpenChange: { type: 'string', description: 'Plumber port for open state changes' },
    },
  },
  'widgets/compound/tabs': {
    name: 'Tabs Widget',
    description: 'Tabbed content navigation',
    schema: {
      value: { type: 'string', description: 'Active tab value' },
      onValueChange: { type: 'string', description: 'Plumber port for tab changes' },
    },
  },

  // Custom widget type
  'widgets/custom': {
    name: 'Custom Widget',
    description: 'User-defined widget composition',
    schema: {
      name: { type: 'string', description: 'Widget name' },
      props: { type: 'object', description: 'Props schema' },
      definition: { type: 'array', description: 'Hiccup definition' },
      description: { type: 'string', description: 'Widget description' },
    },
  },

  // UI instance types
  'ui-root': {
    name: 'UI Root',
    description: 'Root render surface',
    schema: {
      content: { type: 'any', description: 'Widget URI or inline definition' },
    },
  },
  'widget-instance': {
    name: 'Widget Instance',
    description: 'A rendered widget instance',
    schema: {
      widget: { type: 'string', description: 'Widget definition URI' },
      widgetConfig: { type: 'object', description: 'Instance configuration' },
      state: { type: 'object', description: 'Runtime state' },
    },
  },
}

/**
 * Types resource
 */
const typesResource = resource((r) => {
  // List all types
  r.get('/', () => ({
    headers: { type: 'bl:///types/directory' },
    body: {
      entries: Object.entries(TYPES).map(([name, def]) => ({
        name,
        type: 'type',
        uri: `bl:///types/${name}`,
        description: def.description,
      })),
    },
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
        schema: def.schema,
      },
    }
  })
})

/**
 * Install types routes
 * @param {import('@bassline/core').Bassline} bl - Bassline instance
 * @param {object} [options] - Options
 * @param {string} [options.prefix] - Mount prefix
 */
export default function installTypes(bl, { prefix = '/types' } = {}) {
  bl.mount(prefix, typesResource)
}
