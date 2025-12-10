import { useState, useCallback } from 'react'
import { useBassline } from '@bassline/react'
import { IconCircle, IconRefresh, IconTrash } from '@tabler/icons-react'
import InlineEdit from '../components/InlineEdit.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import { resourceClasses } from './index.jsx'
import { REMOTE_PREFIX } from '../config.js'

/**
 * Determine the edit type based on the value
 */
function getValueType(value) {
  if (typeof value === 'boolean') return 'boolean'
  if (typeof value === 'number') return 'number'
  if (typeof value === 'object' && value !== null) return 'json'
  return 'string'
}

/**
 * Extract cell name from URI
 */
function getCellName(uri) {
  if (!uri) return null
  const match = uri.match(/\/cells\/([^/]+)/)
  return match ? match[1] : null
}

/**
 * CellView - View for cell resources with inline editing
 */
export default function CellView({ resource, uri, onRefresh, onNavigate }) {
  const bl = useBassline()
  const { label, value, lattice } = resource.body || {}
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const cellName = getCellName(uri)
  const valueUri = cellName ? `${REMOTE_PREFIX}/cells/${cellName}/value` : null

  const getValueClass = () => {
    if (typeof value === 'boolean') return `value-boolean ${value ? 'true' : 'false'}`
    if (typeof value === 'string') return 'value-string'
    if (typeof value === 'object' && value !== null) return 'value-object'
    return ''
  }

  const handleSave = useCallback(async (newValue) => {
    if (!valueUri) throw new Error('Cannot determine cell URI')

    setSaving(true)
    try {
      await bl.put(valueUri, {}, newValue)
      setLastSaved(new Date())
      onRefresh?.()
    } finally {
      setSaving(false)
    }
  }, [bl, valueUri, onRefresh])

  const handleRefresh = () => {
    onRefresh?.()
  }

  const handleDelete = useCallback(async () => {
    if (!cellName) return

    setDeleting(true)
    try {
      // Delete the cell via PUT with tombstone or DELETE
      const cellUri = `${REMOTE_PREFIX}/cells/${cellName}`
      await bl.put(cellUri, { 'x-delete': 'true' }, null)
      // Navigate back to cells list
      onNavigate?.('bl:///explore/cells')
    } catch (err) {
      console.error('Failed to delete cell:', err)
    } finally {
      setDeleting(false)
    }
  }, [bl, cellName, onNavigate])

  return (
    <div className={`view-card cell-view ${resourceClasses(resource)}`}>
      <div className="cell-view-header">
        <div className="cell-view-icon">
          <IconCircle size={24} style={{ color: 'var(--type-cell)' }} />
        </div>
        <div className="cell-view-meta">
          <div className="uri">{uri}</div>
          {label && <div className="cell-label">{label}</div>}
          {lattice && (
            <div className="cell-lattice">
              <span className="badge">{lattice}</span>
            </div>
          )}
        </div>
        <button
          className="btn btn-small"
          onClick={handleRefresh}
          title="Refresh"
        >
          <IconRefresh size={14} />
        </button>
        <button
          className="btn btn-small btn-danger"
          onClick={() => setShowDeleteConfirm(true)}
          disabled={deleting}
          title="Delete cell"
        >
          <IconTrash size={14} />
        </button>
      </div>

      <div className={`cell-value-container ${getValueClass()}`}>
        <InlineEdit
          value={value}
          onSave={handleSave}
          type={getValueType(value)}
          className="cell-value-editor"
          placeholder="(no value)"
          disabled={saving}
        />
      </div>

      {lastSaved && (
        <div className="cell-saved-indicator">
          Saved at {lastSaved.toLocaleTimeString()}
        </div>
      )}

      <div className="cell-view-hint">
        Double-click the value to edit
      </div>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Delete Cell"
        message="Are you sure you want to delete this cell? This action cannot be undone."
        resourceName={cellName}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  )
}
