import Inspector from './Inspector.jsx'
import Directory from './Directory.jsx'
import CellView from './CellView.jsx'
import PersonView from './PersonView.jsx'
import NoteView from './NoteView.jsx'
import TaskView from './TaskView.jsx'
import TypeView from './TypeView.jsx'
import IndexView from './IndexView.jsx'
import Dashboard from './Dashboard.jsx'
import TypeExplorer from './TypeExplorer.jsx'
import NetworkGraph from './NetworkGraph.jsx'
import FuzzyCellView from './FuzzyCellView.jsx'

// Convert headers/body to CSS classes
export function resourceClasses(resource) {
  const classes = ['resource']

  // Type: bl:///types/cell or bl:///data/types/cell → type-cell
  const type = resource?.headers?.type
  if (type) {
    // Extract just the type name from various formats
    const typeName = type
      .replace('bl:///r/types/', '') // Remote prefix (via remote-browser)
      .replace('bl:///types/', '')
      .replace('bl:///local/types/', '')
      .replace('bl:///data/types/', '')
      .replace('bl:///local/data/types/', '')
    classes.push(`type-${typeName}`)
  }

  // Status if present (normalize spaces to dashes)
  if (resource?.body?.status) {
    const status = resource.body.status.replace(/\s+/g, '-')
    classes.push(`status-${status}`)
  }

  return classes.join(' ')
}

// Normalize type URI to a simple name
function normalizeType(type) {
  if (!type) return null
  return type
    .replace('bl:///r/types/', '') // Remote prefix (via remote-browser)
    .replace('bl:///types/', '')
    .replace('bl:///local/types/', '')
    .replace('bl:///data/types/', '')
    .replace('bl:///local/data/types/', '')
}

// Type → Component mapping
const viewsByType = {
  directory: Directory,
  cell: CellView,
  'fuzzy-cell': FuzzyCellView,
  note: NoteView,
  task: TaskView,
  person: PersonView,
  type: TypeView,
  index: IndexView,
  dashboard: Dashboard,
}

// Special URI-based views (virtual routes)
const viewsByUri = {
  'bl:///explore/cells': (props) => <TypeExplorer {...props} type="cell" />,
  'bl:///explore/propagators': (props) => <TypeExplorer {...props} type="propagator" />,
  'bl:///explore/data': (props) => <TypeExplorer {...props} type="data" />,
  'bl:///network': NetworkGraph,
}

// ViewResolver component
export function ViewResolver({ resource, uri, onNavigate, viewMode = 'pretty' }) {
  // Check for special URI-based views first
  const UriView = viewsByUri[uri]
  if (UriView) {
    return <UriView resource={resource} uri={uri} onNavigate={onNavigate} />
  }

  const rawType = resource?.headers?.type
  const normalizedType = normalizeType(rawType)
  const PrettyView = viewsByType[normalizedType]

  // Use Inspector for raw mode or when no pretty view exists
  const View = viewMode === 'raw' || !PrettyView ? Inspector : PrettyView

  return <View resource={resource} uri={uri} onNavigate={onNavigate} />
}

// Check if a resource has a pretty view available
export function hasPrettyView(resource) {
  const rawType = resource?.headers?.type
  const normalizedType = normalizeType(rawType)
  return !!viewsByType[normalizedType]
}

// Export individual views

// Export views mapping for external use
const views = viewsByType
export const virtualViews = viewsByUri
