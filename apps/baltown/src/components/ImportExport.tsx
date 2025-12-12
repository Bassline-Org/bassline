import { createSignal, Show } from 'solid-js'
import { useNavigate } from '@solidjs/router'
import { useBassline } from '@bassline/solid'

interface ExportButtonProps {
  val: any
  owner: string
  name: string
}

/**
 * Export a val definition as a JSON file
 */
export function ExportButton(props: ExportButtonProps) {
  const handleExport = () => {
    const exportData = {
      $schema: 'https://bassline.dev/schemas/val-export-v1.json',
      exportedAt: new Date().toISOString(),
      val: {
        name: props.val.name,
        owner: props.val.owner,
        description: props.val.description,
        valType: props.val.valType,
        definition: props.val.definition,
        tags: props.val.tags || [],
      },
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${props.owner}-${props.name}.val.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <button class="btn btn-secondary" onClick={handleExport} title="Export as JSON">
      Export
    </button>
  )
}

interface ImportModalProps {
  isOpen: boolean
  onClose: () => void
}

/**
 * Modal for importing a val from JSON file
 */
export function ImportModal(props: ImportModalProps) {
  const bl = useBassline()
  const navigate = useNavigate()

  const [importing, setImporting] = createSignal(false)
  const [error, setError] = createSignal('')
  const [preview, setPreview] = createSignal<any>(null)
  const [overrideOwner, setOverrideOwner] = createSignal('')
  const [overrideName, setOverrideName] = createSignal('')

  const handleFileSelect = async (e: Event) => {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return

    setError('')
    setPreview(null)

    try {
      const text = await file.text()
      const data = JSON.parse(text)

      // Validate structure
      if (!data.val || !data.val.valType || !data.val.definition) {
        throw new Error('Invalid val export file: missing required fields')
      }

      setPreview(data.val)
      setOverrideOwner(data.val.owner || 'anonymous')
      setOverrideName(data.val.name || 'imported-val')
    } catch (err: any) {
      setError(err.message || 'Failed to parse file')
    }
  }

  const handleImport = async () => {
    const val = preview()
    if (!val) return

    setImporting(true)
    setError('')

    try {
      const owner = overrideOwner() || 'anonymous'
      const name = overrideName() || val.name

      await bl.put(
        `bl:///r/vals/${owner}/${name}`,
        {},
        {
          description: val.description,
          valType: val.valType,
          definition: val.definition,
          tags: val.tags || [],
        }
      )

      props.onClose()
      navigate(`/v/${owner}/${name}`)
    } catch (err: any) {
      setError(err.message || 'Failed to import val')
    } finally {
      setImporting(false)
    }
  }

  const handleClose = () => {
    setPreview(null)
    setError('')
    props.onClose()
  }

  return (
    <Show when={props.isOpen}>
      <div class="modal-overlay" onClick={handleClose}>
        <div class="modal-content" onClick={(e) => e.stopPropagation()}>
          <div class="modal-header">
            <h2>Import Val</h2>
            <button class="modal-close" onClick={handleClose}>
              &times;
            </button>
          </div>

          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Select File</label>
              <input
                type="file"
                accept=".json,.val.json"
                onChange={handleFileSelect}
                class="file-input"
              />
            </div>

            <Show when={preview()}>
              <div class="import-preview">
                <h3>Preview</h3>

                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label">Owner</label>
                    <input
                      type="text"
                      class="form-input"
                      value={overrideOwner()}
                      onInput={(e) => setOverrideOwner(e.currentTarget.value)}
                    />
                  </div>
                  <div class="form-group">
                    <label class="form-label">Name</label>
                    <input
                      type="text"
                      class="form-input"
                      value={overrideName()}
                      onInput={(e) => setOverrideName(e.currentTarget.value)}
                    />
                  </div>
                </div>

                <div class="preview-info">
                  <div class="preview-row">
                    <span class="preview-label">Type:</span>
                    <span class={`tag ${preview().valType}`}>{preview().valType}</span>
                  </div>
                  <Show when={preview().description}>
                    <div class="preview-row">
                      <span class="preview-label">Description:</span>
                      <span>{preview().description}</span>
                    </div>
                  </Show>
                  <Show when={preview().tags?.length > 0}>
                    <div class="preview-row">
                      <span class="preview-label">Tags:</span>
                      <span>{preview().tags.join(', ')}</span>
                    </div>
                  </Show>
                </div>

                <details class="definition-details">
                  <summary>View Definition</summary>
                  <pre class="json-preview">{JSON.stringify(preview().definition, null, 2)}</pre>
                </details>
              </div>
            </Show>

            <Show when={error()}>
              <div class="error-message">{error()}</div>
            </Show>
          </div>

          <div class="modal-footer">
            <button class="btn btn-secondary" onClick={handleClose}>
              Cancel
            </button>
            <button
              class="btn btn-primary"
              onClick={handleImport}
              disabled={!preview() || importing()}
            >
              {importing() ? 'Importing...' : 'Import Val'}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal-content {
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 12px;
          width: 90%;
          max-width: 600px;
          max-height: 90vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid #30363d;
        }

        .modal-header h2 {
          font-size: 18px;
          font-weight: 600;
          color: #f0f6fc;
          margin: 0;
        }

        .modal-close {
          background: none;
          border: none;
          color: #8b949e;
          font-size: 24px;
          cursor: pointer;
          padding: 0;
          line-height: 1;
        }

        .modal-close:hover {
          color: #f0f6fc;
        }

        .modal-body {
          padding: 20px;
          overflow-y: auto;
          flex: 1;
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding: 16px 20px;
          border-top: 1px solid #30363d;
        }

        .file-input {
          width: 100%;
          padding: 12px;
          background: #0d1117;
          border: 2px dashed #30363d;
          border-radius: 8px;
          color: #c9d1d9;
          cursor: pointer;
        }

        .file-input:hover {
          border-color: #58a6ff;
        }

        .import-preview {
          margin-top: 20px;
          padding: 16px;
          background: #0d1117;
          border: 1px solid #30363d;
          border-radius: 8px;
        }

        .import-preview h3 {
          font-size: 14px;
          font-weight: 600;
          color: #f0f6fc;
          margin-bottom: 16px;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 16px;
        }

        .preview-info {
          margin-bottom: 12px;
        }

        .preview-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
          font-size: 13px;
        }

        .preview-label {
          color: #8b949e;
        }

        .definition-details {
          margin-top: 12px;
        }

        .definition-details summary {
          cursor: pointer;
          color: #58a6ff;
          font-size: 13px;
          margin-bottom: 8px;
        }

        .definition-details .json-preview {
          max-height: 200px;
          overflow: auto;
          font-size: 11px;
        }

        .error-message {
          background: #f8514933;
          border: 1px solid #f85149;
          border-radius: 6px;
          padding: 12px;
          color: #f85149;
          margin-top: 16px;
          font-size: 13px;
        }
      `}</style>
    </Show>
  )
}

/**
 * Import button that opens the import modal
 */
export function ImportButton() {
  const [modalOpen, setModalOpen] = createSignal(false)

  return (
    <>
      <button class="btn btn-secondary" onClick={() => setModalOpen(true)}>
        Import
      </button>
      <ImportModal isOpen={modalOpen()} onClose={() => setModalOpen(false)} />
    </>
  )
}
