import { useState, useEffect, useCallback, useMemo } from 'react'
import { useBassline } from '@bassline/react'
import {
  IconCircle,
  IconArrowRight,
  IconDatabase,
  IconCode,
  IconRefresh,
  IconSortAscending,
  IconSortDescending,
  IconFilter,
  IconTrash,
  IconChevronDown,
  IconChevronRight,
} from '@tabler/icons-react'
import { REMOTE_PREFIX } from '../config.js'

/**
 * Type-specific icons and colors
 */
const TYPE_CONFIG = {
  cell: { icon: IconCircle, color: 'var(--type-cell)', label: 'Cells' },
  propagator: { icon: IconArrowRight, color: 'var(--type-propagator)', label: 'Propagators' },
  data: { icon: IconDatabase, color: 'var(--type-data)', label: 'Data' },
  code: { icon: IconCode, color: 'var(--type-code)', label: 'Code' },
}

/**
 * Format value for display
 */
function formatValue(value) {
  if (value === undefined || value === null) return '-'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

/**
 * Format timestamp
 */
function formatTime(ts) {
  if (!ts) return '-'
  const date = new Date(ts)
  const now = new Date()
  const diff = now - date

  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} hr ago`
  return date.toLocaleDateString()
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
 * Statistics Panel - Shows aggregated stats for the type
 */
function StatsPanel({ items, type }) {
  const stats = useMemo(() => {
    const result = {
      count: items.length,
      withValue: 0,
      minValue: null,
      maxValue: null,
    }

    items.forEach((item) => {
      if (item.value !== undefined && item.value !== null) {
        result.withValue++
        const numValue = typeof item.value === 'number' ? item.value : null
        if (numValue !== null) {
          if (result.minValue === null || numValue < result.minValue) result.minValue = numValue
          if (result.maxValue === null || numValue > result.maxValue) result.maxValue = numValue
        }
      }
    })

    return result
  }, [items])

  return (
    <div className="type-explorer-stats">
      <div className="stat">
        <span className="stat-value">{stats.count}</span>
        <span className="stat-label">Total</span>
      </div>
      {type === 'cell' && (
        <>
          <div className="stat">
            <span className="stat-value">{stats.withValue}</span>
            <span className="stat-label">With Value</span>
          </div>
          {stats.minValue !== null && (
            <div className="stat">
              <span className="stat-value">{stats.minValue}</span>
              <span className="stat-label">Min</span>
            </div>
          )}
          {stats.maxValue !== null && (
            <div className="stat">
              <span className="stat-value">{stats.maxValue}</span>
              <span className="stat-label">Max</span>
            </div>
          )}
        </>
      )}
    </div>
  )
}

/**
 * Table header with sorting
 */
function SortableHeader({ column, label, sortBy, sortDir, onSort }) {
  const isActive = sortBy === column

  return (
    <th className={`sortable ${isActive ? 'active' : ''}`} onClick={() => onSort(column)}>
      {label}
      {isActive &&
        (sortDir === 'asc' ? (
          <IconSortAscending size={12} style={{ marginLeft: 4 }} />
        ) : (
          <IconSortDescending size={12} style={{ marginLeft: 4 }} />
        ))}
    </th>
  )
}

/**
 * Type Explorer View - Table view of all instances of a type
 */
export default function TypeExplorer({ type = 'cell', onNavigate }) {
  const bl = useBassline()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState('name')
  const [sortDir, setSortDir] = useState('asc')
  const [filter, setFilter] = useState('')
  const [selectedItems, setSelectedItems] = useState(new Set())
  const [expanded, setExpanded] = useState(new Set())

  const config = TYPE_CONFIG[type] || TYPE_CONFIG.data
  const Icon = config.icon

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      let endpoint = `${REMOTE_PREFIX}/${type}s`
      if (type === 'data') endpoint = `${REMOTE_PREFIX}/data`

      const res = await bl.get(endpoint)
      if (res?.body?.entries) {
        // Enrich with additional data if available
        const enriched = await Promise.all(
          res.body.entries.map(async (item) => {
            // For cells, try to get the value
            if (type === 'cell' && item.name && !item.value) {
              try {
                const valueRes = await bl.get(`${REMOTE_PREFIX}/cells/${item.name}/value`)
                if (valueRes?.body !== undefined) {
                  return { ...item, value: valueRes.body }
                }
              } catch {}
            }
            return item
          })
        )
        setItems(enriched)
      }
    } catch (err) {
      console.error('Type explorer load error:', err)
    } finally {
      setLoading(false)
    }
  }, [bl, type])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Sort and filter items
  const displayItems = useMemo(() => {
    let filtered = items

    // Apply filter
    if (filter) {
      const lowerFilter = filter.toLowerCase()
      filtered = items.filter((item) => {
        const name = (item.label || item.name || '').toLowerCase()
        const value = formatValue(item.value).toLowerCase()
        return name.includes(lowerFilter) || value.includes(lowerFilter)
      })
    }

    // Apply sort
    return [...filtered].sort((a, b) => {
      let aVal = a[sortBy]
      let bVal = b[sortBy]

      // Handle name specially
      if (sortBy === 'name') {
        aVal = a.label || a.name || ''
        bVal = b.label || b.name || ''
      }

      // Null handling
      if (aVal === null || aVal === undefined) return sortDir === 'asc' ? 1 : -1
      if (bVal === null || bVal === undefined) return sortDir === 'asc' ? -1 : 1

      // Compare
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal
      }

      const aStr = String(aVal).toLowerCase()
      const bStr = String(bVal).toLowerCase()
      const cmp = aStr.localeCompare(bStr)
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [items, filter, sortBy, sortDir])

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(column)
      setSortDir('asc')
    }
  }

  const handleSelectAll = () => {
    if (selectedItems.size === displayItems.length) {
      setSelectedItems(new Set())
    } else {
      setSelectedItems(new Set(displayItems.map((i) => i.uri || i.name)))
    }
  }

  const handleSelect = (item) => {
    const key = item.uri || item.name
    const newSelected = new Set(selectedItems)
    if (newSelected.has(key)) {
      newSelected.delete(key)
    } else {
      newSelected.add(key)
    }
    setSelectedItems(newSelected)
  }

  const handleRowClick = (item) => {
    if (onNavigate && item.uri) {
      onNavigate(item.uri)
    }
  }

  const handleExpand = (item, e) => {
    e.stopPropagation()
    const key = item.uri || item.name
    const newExpanded = new Set(expanded)
    if (newExpanded.has(key)) {
      newExpanded.delete(key)
    } else {
      newExpanded.add(key)
    }
    setExpanded(newExpanded)
  }

  const handleBulkDelete = async () => {
    if (selectedItems.size === 0) return
    if (!confirm(`Delete ${selectedItems.size} items?`)) return

    // Delete each selected item
    const errors = []
    for (const itemKey of selectedItems) {
      try {
        // itemKey could be a URI or just a name
        let deleteUri = itemKey
        if (!itemKey.startsWith('bl://')) {
          // Build URI from name
          deleteUri = `${REMOTE_PREFIX}/${type}s/${itemKey}`
        }
        await bl.put(deleteUri, { 'x-delete': 'true' }, null)
      } catch (err) {
        errors.push({ item: itemKey, error: err.message })
      }
    }

    // Clear selection and reload
    setSelectedItems(new Set())
    await loadData()

    if (errors.length > 0) {
      console.error('Some deletions failed:', errors)
    }
  }

  if (loading) {
    return (
      <div className="type-explorer">
        <div className="type-explorer-header">
          <h2>
            <Icon size={20} style={{ color: config.color, marginRight: 8 }} />
            {config.label}
          </h2>
        </div>
        <div className="loading pulse">Loading {config.label.toLowerCase()}...</div>
      </div>
    )
  }

  return (
    <div className="type-explorer">
      {/* Header */}
      <div className="type-explorer-header">
        <h2>
          <Icon size={20} style={{ color: config.color, marginRight: 8 }} />
          {config.label}
          <span className="count">({items.length})</span>
        </h2>
        <div className="type-explorer-actions">
          <button className="btn btn-small" onClick={loadData}>
            <IconRefresh size={14} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <StatsPanel items={items} type={type} />

      {/* Filter and bulk actions */}
      <div className="type-explorer-toolbar">
        <div className="filter-input">
          <IconFilter size={14} />
          <input
            type="text"
            placeholder="Filter..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
        {selectedItems.size > 0 && (
          <div className="bulk-actions">
            <span>{selectedItems.size} selected</span>
            <button className="btn btn-small btn-danger" onClick={handleBulkDelete}>
              <IconTrash size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      {displayItems.length === 0 ? (
        <div className="empty">
          {filter
            ? `No ${config.label.toLowerCase()} match "${filter}"`
            : `No ${config.label.toLowerCase()} yet`}
        </div>
      ) : (
        <table className="type-explorer-table">
          <thead>
            <tr>
              <th className="checkbox-col">
                <input
                  type="checkbox"
                  checked={selectedItems.size === displayItems.length}
                  onChange={handleSelectAll}
                />
              </th>
              <th className="expand-col"></th>
              <SortableHeader
                column="name"
                label="Name"
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={handleSort}
              />
              {type === 'cell' && (
                <SortableHeader
                  column="value"
                  label="Value"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={handleSort}
                />
              )}
              {type === 'cell' && (
                <SortableHeader
                  column="lattice"
                  label="Lattice"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={handleSort}
                />
              )}
              {type === 'propagator' && <th>Status</th>}
              <th>Last Change</th>
            </tr>
          </thead>
          <tbody>
            {displayItems.map((item, i) => {
              const key = item.uri || item.name || i
              const isSelected = selectedItems.has(key)
              const isExpanded = expanded.has(key)
              const name = item.label || nameFromUri(item.uri || item.name)

              return (
                <>
                  <tr
                    key={key}
                    className={`${isSelected ? 'selected' : ''} ${isExpanded ? 'expanded' : ''}`}
                    onClick={() => handleRowClick(item)}
                  >
                    <td className="checkbox-col" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleSelect(item)}
                      />
                    </td>
                    <td className="expand-col" onClick={(e) => handleExpand(item, e)}>
                      {isExpanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
                    </td>
                    <td className="name-col">
                      <Icon size={12} style={{ color: config.color, marginRight: 6 }} />
                      {name}
                    </td>
                    {type === 'cell' && (
                      <td className="value-col">
                        <span className="cell-value">{formatValue(item.value)}</span>
                      </td>
                    )}
                    {type === 'cell' && (
                      <td className="lattice-col">
                        <span className="badge">{item.lattice || 'lww'}</span>
                      </td>
                    )}
                    {type === 'propagator' && (
                      <td className="status-col">
                        <span className={`status ${item.firing ? 'firing' : 'idle'}`}>
                          {item.firing ? 'firing' : 'idle'}
                        </span>
                      </td>
                    )}
                    <td className="time-col">{formatTime(item.lastChange)}</td>
                  </tr>
                  {isExpanded && (
                    <tr className="details-row">
                      <td colSpan="6">
                        <div className="item-details">
                          <div className="detail-row">
                            <span className="detail-label">URI:</span>
                            <code>{item.uri || `bl:///${type}s/${item.name}`}</code>
                          </div>
                          {item.inputs && (
                            <div className="detail-row">
                              <span className="detail-label">Inputs:</span>
                              <span>{item.inputs.join(', ')}</span>
                            </div>
                          )}
                          {item.output && (
                            <div className="detail-row">
                              <span className="detail-label">Output:</span>
                              <span>{item.output}</span>
                            </div>
                          )}
                          {item.handler && (
                            <div className="detail-row">
                              <span className="detail-label">Handler:</span>
                              <span>{item.handler}</span>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
