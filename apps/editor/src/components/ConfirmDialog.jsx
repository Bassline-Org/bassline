import { IconAlertTriangle, IconX } from '@tabler/icons-react'

/**
 * ConfirmDialog - Reusable confirmation modal
 */
export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure?',
  resourceName,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger'
}) {
  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal confirm-dialog" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            <IconAlertTriangle size={18} style={{ color: 'var(--error)', marginRight: '8px', verticalAlign: 'middle' }} />
            {title}
          </h2>
          <button className="modal-close" onClick={onClose}>
            <IconX size={18} />
          </button>
        </div>

        <div className="modal-body">
          <p>{message}</p>
          {resourceName && (
            <p className="resource-name">{resourceName}</p>
          )}
        </div>

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>
            {cancelLabel}
          </button>
          <button
            className={`btn ${variant === 'danger' ? 'btn-danger' : 'btn-primary'}`}
            onClick={() => { onConfirm(); onClose(); }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
