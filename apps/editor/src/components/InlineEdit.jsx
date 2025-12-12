import { useState, useEffect, useRef, useCallback } from 'react'
import { IconCheck, IconX, IconPencil } from '@tabler/icons-react'

/**
 * InlineEdit - Click-to-edit inline value editor
 *
 * @param {object} props
 * @param {any} props.value - Current value
 * @param {function} props.onSave - Called with new value when saved
 * @param {string} props.type - Value type: 'string' | 'number' | 'boolean' | 'json'
 * @param {function} props.formatDisplay - Custom display formatter
 * @param {string} props.className - Additional CSS class
 * @param {boolean} props.disabled - Disable editing
 * @param {string} props.placeholder - Placeholder when empty
 */
export default function InlineEdit({
  value,
  onSave,
  type = 'string',
  formatDisplay,
  className = '',
  disabled = false,
  placeholder = 'Click to edit',
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

  // Initialize edit value when entering edit mode
  useEffect(() => {
    if (isEditing) {
      if (type === 'json' || type === 'object') {
        setEditValue(value != null ? JSON.stringify(value, null, 2) : '')
      } else if (type === 'boolean') {
        setEditValue(value ? 'true' : 'false')
      } else {
        setEditValue(value != null ? String(value) : '')
      }
      // Focus and select input
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus()
          inputRef.current.select()
        }
      }, 0)
    }
  }, [isEditing, value, type])

  // Format value for display
  const displayValue = useCallback(() => {
    if (formatDisplay) return formatDisplay(value)
    if (value === null || value === undefined) return placeholder
    if (type === 'boolean') return value ? 'true' : 'false'
    if (type === 'json' || type === 'object') return JSON.stringify(value)
    return String(value)
  }, [value, type, formatDisplay, placeholder])

  // Parse edit value to correct type
  const parseValue = useCallback(
    (str) => {
      if (type === 'number') {
        const num = Number(str)
        if (isNaN(num)) throw new Error('Invalid number')
        return num
      }
      if (type === 'boolean') {
        const lower = str.toLowerCase().trim()
        if (lower === 'true' || lower === '1' || lower === 'yes') return true
        if (lower === 'false' || lower === '0' || lower === 'no') return false
        throw new Error('Invalid boolean (use true/false)')
      }
      if (type === 'json' || type === 'object') {
        return JSON.parse(str)
      }
      return str
    },
    [type]
  )

  const handleSave = async () => {
    setError(null)
    try {
      const parsed = parseValue(editValue)
      setSaving(true)
      await onSave(parsed)
      setIsEditing(false)
    } catch (err) {
      setError(err.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setIsEditing(false)
    setError(null)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && type !== 'json') {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleCancel()
    }
  }

  const handleDoubleClick = () => {
    if (!disabled) {
      setIsEditing(true)
    }
  }

  // Render editing state
  if (isEditing) {
    return (
      <div className={`inline-edit editing ${className}`}>
        {type === 'json' || type === 'object' ? (
          <textarea
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') handleCancel()
            }}
            disabled={saving}
            rows={4}
            className="inline-edit-textarea"
          />
        ) : type === 'boolean' ? (
          <select
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={saving}
            className="inline-edit-select"
          >
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
        ) : (
          <input
            ref={inputRef}
            type={type === 'number' ? 'number' : 'text'}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={saving}
            className="inline-edit-input"
          />
        )}
        <div className="inline-edit-actions">
          <button
            type="button"
            className="btn btn-small btn-success"
            onClick={handleSave}
            disabled={saving}
            title="Save (Enter)"
          >
            {saving ? <span className="loading-spinner-small" /> : <IconCheck size={14} />}
          </button>
          <button
            type="button"
            className="btn btn-small btn-secondary"
            onClick={handleCancel}
            disabled={saving}
            title="Cancel (Esc)"
          >
            <IconX size={14} />
          </button>
        </div>
        {error && <div className="inline-edit-error">{error}</div>}
      </div>
    )
  }

  // Render display state
  const isEmpty = value === null || value === undefined || value === ''

  return (
    <div
      className={`inline-edit display ${className} ${disabled ? 'disabled' : ''} ${isEmpty ? 'empty' : ''}`}
      onDoubleClick={handleDoubleClick}
      title={disabled ? '' : 'Double-click to edit'}
    >
      <span className="inline-edit-value">{displayValue()}</span>
      {!disabled && (
        <button
          type="button"
          className="inline-edit-trigger"
          onClick={() => setIsEditing(true)}
          title="Edit"
        >
          <IconPencil size={14} />
        </button>
      )}
    </div>
  )
}
