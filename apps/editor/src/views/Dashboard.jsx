import { useState, useEffect, useCallback, useRef } from 'react'
import { useBassline, useWebSocket } from '@bassline/react'
import {
  IconCircle,
  IconArrowRight,
  IconRefresh,
  IconActivity,
  IconWifi,
  IconWifiOff,
} from '@tabler/icons-react'
import { REMOTE_PREFIX } from '../config.js'

/**
 * Format a value for display
 */
function formatValue(value) {
  if (value === undefined || value === null) return '-'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

/**
 * Extract name from URI
 */
function nameFromUri(uri) {
  if (!uri) return 'unknown'
  const parts = uri.split('/')
  return parts[parts.length - 1] || parts[parts.length - 2] || uri
}

/**
 * Cell Summary - Inline card showing cell name and value
 */
function CellSummary({ cell, onClick, isNew }) {
  const name = cell.label || nameFromUri(cell.uri || cell.name)
  const value = formatValue(cell.value)

  return (
    <div className={`cell-summary ${isNew ? 'flash-cell' : ''}`} onClick={onClick}>
      <span className="cell-name">
        <IconCircle size={12} style={{ marginRight: 6, color: 'var(--type-cell)' }} />
        {name}
      </span>
      <span className="cell-value">{value}</span>
    </div>
  )
}

/**
 * Propagator Summary - Inline card showing propagator name and status
 */
function PropagatorSummary({ propagator, onClick, isNew }) {
  const name = propagator.label || nameFromUri(propagator.uri || propagator.name)
  const status = propagator.firing ? 'firing' : 'idle'

  return (
    <div className={`propagator-summary ${isNew ? 'flash-propagator' : ''}`} onClick={onClick}>
      <span className="propagator-name">
        <IconArrowRight size={12} style={{ marginRight: 6, color: 'var(--type-propagator)' }} />
        {name}
      </span>
      <span className={`propagator-status ${status}`}>{status}</span>
    </div>
  )
}

/**
 * Activity Item - Timeline entry showing a change
 */
function ActivityItem({ activity }) {
  const time = activity.time
    ? new Date(activity.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '--:--'
  const name = nameFromUri(activity.uri)

  return (
    <div className="activity-item">
      <span className="activity-time">{time}</span>
      <div className="activity-content">
        <span className="activity-resource">{name}</span>
        {activity.delta && <span className="activity-delta"> {activity.delta}</span>}
      </div>
    </div>
  )
}

/**
 * Dashboard View - High-density contextual view of system state
 *
 * Shows: Live Cells | Propagators | Recent Activity
 * No URIs displayed - semantic names only
 * Live updates via WebSocket subscription
 */
export default function Dashboard({ onNavigate }) {
  const bl = useBassline()
  const ws = useWebSocket()
  const [cells, setCells] = useState([])
  const [propagators, setPropagators] = useState([])
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(true)
  const [recentlyChanged, setRecentlyChanged] = useState(new Set())
  const [isLive, setIsLive] = useState(false)
  const changeTimeouts = useRef({})

  // Track when a cell/propagator changes for flash animation
  const markChanged = useCallback((uri) => {
    setRecentlyChanged((prev) => new Set([...prev, uri]))

    // Clear the flash after animation duration
    if (changeTimeouts.current[uri]) {
      clearTimeout(changeTimeouts.current[uri])
    }
    changeTimeouts.current[uri] = setTimeout(() => {
      setRecentlyChanged((prev) => {
        const next = new Set(prev)
        next.delete(uri)
        return next
      })
    }, 500)
  }, [])

  // Load data function
  const loadData = useCallback(async () => {
    try {
      const cellsRes = await bl.get(`${REMOTE_PREFIX}/cells`)
      if (cellsRes?.body?.entries) {
        setCells(cellsRes.body.entries)
      }

      const propsRes = await bl.get(`${REMOTE_PREFIX}/propagators`)
      if (propsRes?.body?.entries) {
        setPropagators(propsRes.body.entries)
      }

      try {
        const activityRes = await bl.get(`${REMOTE_PREFIX}/activity`)
        if (activityRes?.body?.entries) {
          setActivity(activityRes.body.entries.slice(0, 20))
        }
      } catch {
        // Activity buffer may not exist yet
      }
    } catch (err) {
      console.error('Dashboard load error:', err)
    }
  }, [bl])

  // Initial load
  useEffect(() => {
    setLoading(true)
    loadData().finally(() => setLoading(false))
  }, [loadData])

  // WebSocket subscription for live updates
  useEffect(() => {
    if (!ws) {
      setIsLive(false)
      return
    }

    const handleMessage = (event) => {
      try {
        const msg = JSON.parse(event.data)

        // Check if message is for cells or propagators
        const uri = msg.uri || ''

        if (uri.includes('/cells')) {
          // A cell changed - refetch cells and mark as changed
          loadData()

          // Extract cell name and mark as changed
          const cellMatch = uri.match(/\/cells\/([^/]+)/)
          if (cellMatch) {
            markChanged(`${REMOTE_PREFIX}/cells/${cellMatch[1]}`)
          }
        } else if (uri.includes('/propagators')) {
          // A propagator changed - refetch propagators and mark as changed
          loadData()

          const propMatch = uri.match(/\/propagators\/([^/]+)/)
          if (propMatch) {
            markChanged(`${REMOTE_PREFIX}/propagators/${propMatch[1]}`)
          }
        }
      } catch {
        // Ignore parse errors
      }
    }

    // Subscribe to cell and propagator changes
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'subscribe', uri: `${REMOTE_PREFIX}/cells` }))
      ws.send(JSON.stringify({ type: 'subscribe', uri: `${REMOTE_PREFIX}/propagators` }))
      setIsLive(true)
    }

    ws.addEventListener('message', handleMessage)

    return () => {
      ws.removeEventListener('message', handleMessage)
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'unsubscribe', uri: `${REMOTE_PREFIX}/cells` }))
        ws.send(JSON.stringify({ type: 'unsubscribe', uri: `${REMOTE_PREFIX}/propagators` }))
      }
      setIsLive(false)
    }
  }, [ws, loadData, markChanged])

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      Object.values(changeTimeouts.current).forEach(clearTimeout)
    }
  }, [])

  const handleCellClick = (cell) => {
    if (onNavigate && cell.uri) {
      onNavigate(cell.uri)
    }
  }

  const handlePropagatorClick = (prop) => {
    if (onNavigate && prop.uri) {
      onNavigate(prop.uri)
    }
  }

  const handleRefresh = async () => {
    setLoading(true)
    await loadData()
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="dashboard">
        <div className="dashboard-panel">
          <h2>Live Cells</h2>
          <div className="loading pulse">Loading cells...</div>
        </div>
        <div className="dashboard-panel">
          <h2>Propagators</h2>
          <div className="loading pulse">Loading propagators...</div>
        </div>
        <div className="dashboard-panel">
          <h2>Recent Activity</h2>
          <div className="loading pulse">Loading activity...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard">
      {/* Live Status Indicator */}
      <div className="dashboard-status">
        {isLive ? (
          <span className="live-indicator live">
            <IconWifi size={14} />
            Live
          </span>
        ) : (
          <span className="live-indicator offline">
            <IconWifiOff size={14} />
            Offline
          </span>
        )}
        <button className="btn btn-small" onClick={handleRefresh} title="Refresh data">
          <IconRefresh size={12} />
        </button>
      </div>

      {/* Live Cells Panel */}
      <div className="dashboard-panel">
        <h2>
          Live Cells
          <span style={{ float: 'right', color: 'var(--text-dim)', fontWeight: 400 }}>
            ({cells.length})
          </span>
        </h2>
        {cells.length === 0 ? (
          <div className="empty">No cells yet</div>
        ) : (
          cells.map((cell, i) => {
            const cellUri = cell.uri || `${REMOTE_PREFIX}/cells/${cell.name}`
            return (
              <CellSummary
                key={cellUri || i}
                cell={cell}
                onClick={() => handleCellClick(cell)}
                isNew={recentlyChanged.has(cellUri)}
              />
            )
          })
        )}
      </div>

      {/* Propagators Panel */}
      <div className="dashboard-panel">
        <h2>
          Propagators
          <span style={{ float: 'right', color: 'var(--text-dim)', fontWeight: 400 }}>
            ({propagators.length})
          </span>
        </h2>
        {propagators.length === 0 ? (
          <div className="empty">No propagators yet</div>
        ) : (
          propagators.map((prop, i) => {
            const propUri = prop.uri || `${REMOTE_PREFIX}/propagators/${prop.name}`
            return (
              <PropagatorSummary
                key={propUri || i}
                propagator={prop}
                onClick={() => handlePropagatorClick(prop)}
                isNew={recentlyChanged.has(propUri)}
              />
            )
          })
        )}
      </div>

      {/* Activity Panel */}
      <div className="dashboard-panel">
        <h2>
          <IconActivity size={14} style={{ marginRight: 6 }} />
          Recent Activity
        </h2>
        {activity.length === 0 ? (
          <div className="empty">No recent activity</div>
        ) : (
          activity.map((item, i) => <ActivityItem key={item.id || i} activity={item} />)
        )}
      </div>
    </div>
  )
}
