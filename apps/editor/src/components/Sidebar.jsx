import {
  IconLayoutGrid,
  IconCircle,
  IconArrowRight,
  IconDatabase,
  IconNetwork,
  IconSchema,
  IconPlus,
  IconRobot,
  IconChevronLeft,
  IconChevronRight
} from '@tabler/icons-react'
import { REMOTE_PREFIX } from '../config.js'

const NAV_ITEMS = [
  {
    label: 'Dashboard',
    uri: `${REMOTE_PREFIX}/dashboard`,
    icon: IconLayoutGrid,
    color: 'var(--type-view)'
  },
  {
    label: 'Cells',
    uri: 'bl:///explore/cells',
    matchPrefix: `${REMOTE_PREFIX}/cells`,
    icon: IconCircle,
    color: 'var(--type-cell)'
  },
  {
    label: 'Propagators',
    uri: 'bl:///explore/propagators',
    matchPrefix: `${REMOTE_PREFIX}/propagators`,
    icon: IconArrowRight,
    color: 'var(--type-propagator)'
  },
  {
    label: 'Data',
    uri: `${REMOTE_PREFIX}/data`,
    icon: IconDatabase,
    color: 'var(--type-data)'
  },
  {
    label: 'Network',
    uri: 'bl:///network',
    icon: IconNetwork,
    color: 'var(--type-propagator)'
  },
  {
    label: 'Types',
    uri: `${REMOTE_PREFIX}/types`,
    icon: IconSchema,
    color: 'var(--type-type)'
  }
]

function NavItem({ item, isActive, onNavigate }) {
  const Icon = item.icon

  return (
    <button
      className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
      onClick={() => onNavigate(item.uri)}
      title={item.label}
    >
      <span className="nav-icon">
        <Icon size={18} style={{ color: item.color }} />
      </span>
      <span className="nav-label">{item.label}</span>
    </button>
  )
}

/**
 * Sidebar - Always-visible navigation
 */
export default function Sidebar({
  currentUri,
  onNavigate,
  collapsed = false,
  onToggleCollapse,
  onCreateNew,
  onOpenClaude
}) {
  // Check if an item is active based on current URI
  const isActive = (item) => {
    if (currentUri === item.uri) return true
    if (item.matchPrefix && currentUri?.startsWith(item.matchPrefix)) return true
    return false
  }

  return (
    <nav className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <span className="sidebar-logo">BL</span>
        {!collapsed && <span className="sidebar-title">Bassline</span>}
        {onToggleCollapse && (
          <button
            className="sidebar-collapse-btn"
            onClick={onToggleCollapse}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <IconChevronRight size={16} /> : <IconChevronLeft size={16} />}
          </button>
        )}
      </div>

      <div className="sidebar-nav">
        {NAV_ITEMS.map(item => (
          <NavItem
            key={item.uri}
            item={item}
            isActive={isActive(item)}
            onNavigate={onNavigate}
          />
        ))}
      </div>

      <div className="sidebar-footer">
        {onOpenClaude && (
          <button
            className="sidebar-claude-btn"
            onClick={onOpenClaude}
            title="Open Claude assistant (Cmd+Shift+C)"
          >
            <IconRobot size={16} />
            {!collapsed && <span>Claude</span>}
          </button>
        )}
        {onCreateNew && (
          <button
            className="sidebar-create-btn"
            onClick={onCreateNew}
            title="Create new resource (Cmd+N)"
          >
            <IconPlus size={16} />
            {!collapsed && <span>New</span>}
          </button>
        )}
      </div>
    </nav>
  )
}
