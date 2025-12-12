import { useState, useCallback } from 'react'
import { useBassline } from '@bassline/react'
import {
  IconBrain,
  IconRefresh,
  IconPlayerPlay,
  IconTrash,
  IconPlus,
  IconChevronDown,
  IconChevronRight,
} from '@tabler/icons-react'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import { REMOTE_PREFIX } from '../config.js'

/**
 * Extract fuzzy cell name from URI
 */
function getCellName(uri) {
  if (!uri) return null
  const match = uri.match(/\/fuzzy\/([^/]+)/)
  return match ? match[1] : null
}

/**
 * Format entry for display
 */
function formatEntry(entry, index) {
  if (typeof entry === 'string') return entry
  if (typeof entry === 'object' && entry !== null) {
    return JSON.stringify(entry, null, 2)
  }
  return String(entry)
}

/**
 * Single entry display with expand/collapse
 */
function EntryItem({ entry, index, expanded, onToggle }) {
  const formatted = formatEntry(entry, index)
  const isLong = formatted.length > 100 || formatted.includes('\n')
  const preview = isLong ? formatted.slice(0, 100) + '...' : formatted

  return (
    <div className={`fuzzy-entry ${expanded ? 'expanded' : ''}`}>
      <div className="fuzzy-entry-header" onClick={() => isLong && onToggle()}>
        <span className="fuzzy-entry-index">#{index + 1}</span>
        {isLong && (
          <span className="fuzzy-entry-expand">
            {expanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
          </span>
        )}
        <span className="fuzzy-entry-preview">{expanded ? formatted : preview}</span>
      </div>
    </div>
  )
}

/**
 * FuzzyCellView - View for fuzzy cells with intelligent compaction
 */
export default function FuzzyCellView({ resource, uri, onRefresh, onNavigate }) {
  const bl = useBassline()
  const { accumulated = [], pending = 0, stats = {} } = resource?.body || {}
  const [compacting, setCompacting] = useState(false)
  const [adding, setAdding] = useState(false)
  const [newEntry, setNewEntry] = useState('')
  const [expandedEntries, setExpandedEntries] = useState(new Set())
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const cellName = getCellName(uri)

  const handleCompact = useCallback(async () => {
    if (!cellName) return
    setCompacting(true)
    try {
      await bl.put(`${REMOTE_PREFIX}/fuzzy/${cellName}/compact`, {}, {})
      onRefresh?.()
    } catch (err) {
      console.error('Compact failed:', err)
    } finally {
      setCompacting(false)
    }
  }, [bl, cellName, onRefresh])

  const handleAddEntry = useCallback(
    async (e) => {
      e.preventDefault()
      if (!cellName || !newEntry.trim()) return

      setAdding(true)
      try {
        // Try to parse as JSON, otherwise send as string
        let value = newEntry.trim()
        try {
          value = JSON.parse(value)
        } catch {
          // Keep as string
        }
        await bl.put(`${REMOTE_PREFIX}/fuzzy/${cellName}/value`, {}, value)
        setNewEntry('')
        onRefresh?.()
      } catch (err) {
        console.error('Add entry failed:', err)
      } finally {
        setAdding(false)
      }
    },
    [bl, cellName, newEntry, onRefresh]
  )

  const handleDelete = useCallback(async () => {
    if (!cellName) return
    setDeleting(true)
    try {
      await bl.put(`${REMOTE_PREFIX}/fuzzy/${cellName}/kill`, {}, {})
      onNavigate?.('bl:///explore/cells')
    } catch (err) {
      console.error('Delete failed:', err)
    } finally {
      setDeleting(false)
    }
  }, [bl, cellName, onNavigate])

  const toggleEntry = (index) => {
    const newExpanded = new Set(expandedEntries)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedEntries(newExpanded)
  }

  return (
    <div className="view-card fuzzy-cell-view">
      <div className="fuzzy-cell-header">
        <div className="fuzzy-cell-icon">
          <IconBrain size={24} style={{ color: 'var(--type-code)' }} />
        </div>
        <div className="fuzzy-cell-meta">
          <div className="uri">{uri}</div>
          <div className="fuzzy-cell-name">{cellName}</div>
        </div>
        <button className="btn btn-small" onClick={onRefresh} title="Refresh">
          <IconRefresh size={14} />
        </button>
        <button
          className="btn btn-small btn-danger"
          onClick={() => setShowDeleteConfirm(true)}
          disabled={deleting}
          title="Delete fuzzy cell"
        >
          <IconTrash size={14} />
        </button>
      </div>

      <div className="fuzzy-cell-stats">
        <div className="stat">
          <span className="stat-value">{accumulated.length}</span>
          <span className="stat-label">Entries</span>
        </div>
        <div className="stat">
          <span className="stat-value">{pending}</span>
          <span className="stat-label">Pending</span>
        </div>
        <div className="stat">
          <span className="stat-value">{stats.writes || 0}</span>
          <span className="stat-label">Writes</span>
        </div>
        <div className="stat">
          <span className="stat-value">{stats.compactions || 0}</span>
          <span className="stat-label">Compactions</span>
        </div>
      </div>

      <div className="fuzzy-cell-actions">
        <button
          className="btn btn-primary"
          onClick={handleCompact}
          disabled={compacting || pending === 0}
          title="Trigger Claude to consolidate entries"
        >
          <IconPlayerPlay size={14} />
          {compacting ? 'Compacting...' : 'Compact Now'}
        </button>
      </div>

      <div className="fuzzy-cell-entries">
        <h3>Accumulated Entries ({accumulated.length})</h3>
        {accumulated.length === 0 ? (
          <div className="empty">No entries yet. Add one below.</div>
        ) : (
          <div className="entries-list">
            {accumulated.map((entry, i) => (
              <EntryItem
                key={i}
                entry={entry}
                index={i}
                expanded={expandedEntries.has(i)}
                onToggle={() => toggleEntry(i)}
              />
            ))}
          </div>
        )}
      </div>

      <form className="fuzzy-cell-add-form" onSubmit={handleAddEntry}>
        <textarea
          value={newEntry}
          onChange={(e) => setNewEntry(e.target.value)}
          placeholder="Add a new entry (text or JSON)..."
          rows={3}
          disabled={adding}
        />
        <button type="submit" className="btn btn-primary" disabled={adding || !newEntry.trim()}>
          <IconPlus size={14} />
          {adding ? 'Adding...' : 'Add Entry'}
        </button>
      </form>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Delete Fuzzy Cell"
        message="Are you sure you want to delete this fuzzy cell? All accumulated entries will be lost."
        resourceName={cellName}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  )
}
