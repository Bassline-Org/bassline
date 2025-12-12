import {
  IconCircleFilled,
  IconArrowRightCircle,
  IconNote,
  IconChecklist,
  IconUser,
  IconSchema,
  IconFolder,
  IconFile,
  IconCode,
  IconLink,
  IconLayoutGrid,
  IconDatabase,
  IconPlug,
  IconServer,
  IconCloud,
  IconActivity,
  IconNetwork,
  IconSettings,
  IconShield,
  IconTable,
  IconQuestionMark,
} from '@tabler/icons-react'

// Type name to icon component mapping
const TYPE_ICONS = {
  // Core resource types
  cell: IconCircleFilled,
  propagator: IconArrowRightCircle,
  note: IconNote,
  task: IconChecklist,
  person: IconUser,
  type: IconSchema,

  // File system types
  directory: IconFolder,
  file: IconFile,
  data: IconDatabase,
  code: IconCode,

  // System types
  link: IconLink,
  view: IconLayoutGrid,
  module: IconPlug,
  remote: IconCloud,
  index: IconSettings,
  dashboard: IconLayoutGrid,

  // Subsystem icons (for IndexView)
  cells: IconCircleFilled,
  propagators: IconArrowRightCircle,
  install: IconPlug,
  links: IconLink,
  plumb: IconNetwork,
  server: IconServer,
  middleware: IconSettings,
  trust: IconShield,
  types: IconSchema,
  activity: IconActivity,
  explore: IconTable,
  network: IconNetwork,

  // Fallback
  unknown: IconQuestionMark,
}

// Type name to CSS color variable
const TYPE_COLORS = {
  cell: 'var(--type-cell)',
  propagator: 'var(--type-propagator)',
  note: 'var(--type-note)',
  task: 'var(--type-task)',
  person: 'var(--type-person)',
  type: 'var(--type-type)',
  directory: 'var(--type-directory)',
  data: 'var(--type-data)',
  code: 'var(--type-code)',
  link: 'var(--type-link)',
  view: 'var(--type-view)',
  module: 'var(--type-module)',
  remote: 'var(--type-remote)',
  index: 'var(--type-index)',
  dashboard: 'var(--type-view)',
  cells: 'var(--type-cell)',
  propagators: 'var(--type-propagator)',
  install: 'var(--type-module)',
  links: 'var(--type-link)',
  plumb: 'var(--type-propagator)',
  server: 'var(--accent)',
  middleware: 'var(--text-muted)',
  trust: 'var(--status-done)',
  types: 'var(--type-type)',
  activity: 'var(--accent)',
  explore: 'var(--accent)',
  network: 'var(--type-propagator)',
  unknown: 'var(--text-muted)',
}

/**
 * TypeIcon - Renders the appropriate icon for a resource type
 *
 * @param {string} type - The normalized type name (e.g., 'cell', 'propagator')
 * @param {number} size - Icon size in pixels (default: 16)
 * @param {string} className - Additional CSS class
 * @param {boolean} colored - Whether to apply type-specific color (default: true)
 */
export default function TypeIcon({ type, size = 16, className = '', colored = true }) {
  const normalizedType = type?.toLowerCase() || 'unknown'
  const Icon = TYPE_ICONS[normalizedType] || TYPE_ICONS.unknown
  const color = colored ? TYPE_COLORS[normalizedType] || TYPE_COLORS.unknown : 'currentColor'

  return <Icon size={size} className={className} style={{ color }} />
}

// Export mappings for direct access
export { TYPE_ICONS, TYPE_COLORS }
