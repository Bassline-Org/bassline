import { useState, useEffect, useRef } from 'react'
import { useBassline, useResource } from '@bassline/react'
import {
  IconX,
  IconCircle,
  IconArrowRight,
  IconPlus,
  IconSparkles,
  IconLoader2,
} from '@tabler/icons-react'
import { REMOTE_PREFIX } from '../config.js'

// Schemas for creating resources
const CELL_SCHEMA = {
  name: {
    type: 'string',
    required: true,
    pattern: '^[a-zA-Z][a-zA-Z0-9_-]*$',
    description: 'Identifier (letters, numbers, - _)',
  },
  label: { type: 'string', description: 'Display name (optional)' },
  lattice: {
    type: 'string',
    enum: ['maxNumber', 'minNumber', 'setUnion', 'lww'],
    required: true,
    description: 'Merge strategy',
  },
}

const PROPAGATOR_HANDLERS = ['sum', 'product', 'passthrough', 'constant']

/**
 * CreateResourceDialog - Modal for creating cells and propagators
 */
export default function CreateResourceDialog({
  isOpen,
  onClose,
  resourceType = 'cell',
  onCreated,
}) {
  const bl = useBassline()
  const [type, setType] = useState(resourceType)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

  // Cell form state
  const [cellName, setCellName] = useState('')
  const [cellLabel, setCellLabel] = useState('')
  const [cellLattice, setCellLattice] = useState('maxNumber')

  // Propagator form state
  const [propName, setPropName] = useState('')
  const [propInputs, setPropInputs] = useState([])
  const [propOutput, setPropOutput] = useState('')
  const [propHandler, setPropHandler] = useState('sum')

  // AI assist state
  const [aiDescription, setAiDescription] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState(null)

  // Fetch existing cells for propagator form
  const { data: cellsData } = useResource(`${REMOTE_PREFIX}/cells`)
  const existingCells = cellsData?.body?.entries || []

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      setType(resourceType)
      setCellName('')
      setCellLabel('')
      setCellLattice('maxNumber')
      setPropName('')
      setPropInputs([])
      setPropOutput('')
      setPropHandler('sum')
      setError(null)
      setAiDescription('')
      setAiError(null)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen, resourceType])

  // AI-assisted resource generation
  const handleAiGenerate = async () => {
    if (!aiDescription.trim() || aiLoading) return

    setAiLoading(true)
    setAiError(null)

    const systemPrompt = `You are an assistant helping create Bassline resources. Based on the user's description, generate a JSON object for the resource.

For cells, return: { "type": "cell", "name": "identifier", "label": "Display Name", "lattice": "maxNumber|minNumber|setUnion|lww" }
- name: lowercase identifier (letters, numbers, hyphens, underscores)
- label: human-readable display name
- lattice: maxNumber (keeps highest), minNumber (keeps lowest), setUnion (collects all values), lww (last-writer-wins)

For propagators, return: { "type": "propagator", "name": "identifier", "handler": "sum|product|passthrough|constant" }
- handler: sum (add inputs), product (multiply), passthrough (copy first input), constant (fixed value)

Respond ONLY with a valid JSON object, nothing else.`

    try {
      const response = await bl.put(
        `${REMOTE_PREFIX}/services/claude/messages`,
        {},
        {
          messages: [
            {
              role: 'user',
              content: `Create a ${type} based on this description: ${aiDescription}`,
            },
          ],
          system: systemPrompt,
          max_tokens: 256,
        }
      )

      // Extract the text response
      const content = response?.body?.content
      const text = Array.isArray(content)
        ? content.find((c) => c.type === 'text')?.text
        : typeof content === 'string'
          ? content
          : null

      if (!text) {
        throw new Error('No response from Claude')
      }

      // Parse the JSON response
      const result = JSON.parse(text.trim())

      // Pre-fill the form based on response
      if (result.type === 'cell' || type === 'cell') {
        if (result.name) setCellName(result.name)
        if (result.label) setCellLabel(result.label)
        if (
          result.lattice &&
          ['maxNumber', 'minNumber', 'setUnion', 'lww'].includes(result.lattice)
        ) {
          setCellLattice(result.lattice)
        }
      } else if (result.type === 'propagator' || type === 'propagator') {
        if (result.name) setPropName(result.name)
        if (
          result.handler &&
          ['sum', 'product', 'passthrough', 'constant'].includes(result.handler)
        ) {
          setPropHandler(result.handler)
        }
      }

      setAiDescription('')
    } catch (err) {
      console.error('AI generation failed:', err)
      setAiError(err.message || 'Failed to generate. Try being more specific.')
    } finally {
      setAiLoading(false)
    }
  }

  const handleCreateCell = async (e) => {
    e.preventDefault()
    setError(null)

    // Validate name
    if (!cellName.match(/^[a-zA-Z][a-zA-Z0-9_-]*$/)) {
      setError('Name must start with a letter and contain only letters, numbers, - or _')
      return
    }

    setLoading(true)
    try {
      const uri = `${REMOTE_PREFIX}/cells/${cellName}`
      await bl.put(
        uri,
        {},
        {
          lattice: cellLattice,
          label: cellLabel || undefined,
        }
      )
      onCreated?.(uri)
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to create cell')
    } finally {
      setLoading(false)
    }
  }

  const handleCreatePropagator = async (e) => {
    e.preventDefault()
    setError(null)

    // Validate
    if (!propName.match(/^[a-zA-Z][a-zA-Z0-9_-]*$/)) {
      setError('Name must start with a letter and contain only letters, numbers, - or _')
      return
    }
    if (propInputs.length === 0) {
      setError('Select at least one input cell')
      return
    }
    if (!propOutput) {
      setError('Select an output cell')
      return
    }

    setLoading(true)
    try {
      const uri = `${REMOTE_PREFIX}/propagators/${propName}`
      await bl.put(
        uri,
        {},
        {
          inputs: propInputs.map((name) => `bl:///cells/${name}`),
          output: `bl:///cells/${propOutput}`,
          handler: propHandler,
        }
      )
      onCreated?.(uri)
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to create propagator')
    } finally {
      setLoading(false)
    }
  }

  const toggleInput = (name) => {
    setPropInputs((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    )
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal create-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create New Resource</h2>
          <button className="modal-close" onClick={onClose}>
            <IconX size={18} />
          </button>
        </div>

        {/* Type selector */}
        <div className="create-type-tabs">
          <button
            className={`type-tab ${type === 'cell' ? 'active' : ''}`}
            onClick={() => setType('cell')}
          >
            <IconCircle size={16} style={{ color: 'var(--type-cell)' }} />
            Cell
          </button>
          <button
            className={`type-tab ${type === 'propagator' ? 'active' : ''}`}
            onClick={() => setType('propagator')}
          >
            <IconArrowRight size={16} style={{ color: 'var(--type-propagator)' }} />
            Propagator
          </button>
        </div>

        {/* AI Assist Section */}
        <div className="ai-assist-section">
          <div className="ai-assist-header">
            <IconSparkles size={14} style={{ color: 'var(--accent)' }} />
            <span>Describe what you want</span>
          </div>
          <div className="ai-assist-input">
            <input
              type="text"
              value={aiDescription}
              onChange={(e) => setAiDescription(e.target.value)}
              placeholder={
                type === 'cell'
                  ? 'e.g., A cell to track the highest temperature reading'
                  : 'e.g., A propagator that sums two values'
              }
              disabled={aiLoading}
              onKeyDown={(e) => e.key === 'Enter' && handleAiGenerate()}
            />
            <button
              type="button"
              className="btn btn-small"
              onClick={handleAiGenerate}
              disabled={aiLoading || !aiDescription.trim()}
            >
              {aiLoading ? (
                <IconLoader2 size={14} className="spinner" />
              ) : (
                <IconSparkles size={14} />
              )}
              {aiLoading ? 'Generating...' : 'Generate'}
            </button>
          </div>
          {aiError && <div className="ai-error">{aiError}</div>}
        </div>

        {error && <div className="create-error">{error}</div>}

        {/* Cell Form */}
        {type === 'cell' && (
          <form className="create-form" onSubmit={handleCreateCell}>
            <div className="form-field">
              <label htmlFor="cell-name">
                Name <span className="required">*</span>
              </label>
              <input
                ref={inputRef}
                id="cell-name"
                type="text"
                value={cellName}
                onChange={(e) => setCellName(e.target.value)}
                placeholder="counter"
                required
              />
              <span className="field-description">Identifier (letters, numbers, - _)</span>
            </div>

            <div className="form-field">
              <label htmlFor="cell-label">Label</label>
              <input
                id="cell-label"
                type="text"
                value={cellLabel}
                onChange={(e) => setCellLabel(e.target.value)}
                placeholder="My Counter (optional)"
              />
              <span className="field-description">Display name</span>
            </div>

            <div className="form-field">
              <label htmlFor="cell-lattice">
                Lattice <span className="required">*</span>
              </label>
              <select
                id="cell-lattice"
                value={cellLattice}
                onChange={(e) => setCellLattice(e.target.value)}
                required
              >
                <option value="maxNumber">maxNumber (keeps highest)</option>
                <option value="minNumber">minNumber (keeps lowest)</option>
                <option value="setUnion">setUnion (collects all)</option>
                <option value="lww">lww (last-writer-wins)</option>
              </select>
              <span className="field-description">How values merge</span>
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Creating...' : 'Create Cell'}
              </button>
            </div>
          </form>
        )}

        {/* Propagator Form */}
        {type === 'propagator' && (
          <form className="create-form" onSubmit={handleCreatePropagator}>
            <div className="form-field">
              <label htmlFor="prop-name">
                Name <span className="required">*</span>
              </label>
              <input
                ref={inputRef}
                id="prop-name"
                type="text"
                value={propName}
                onChange={(e) => setPropName(e.target.value)}
                placeholder="sum-ab"
                required
              />
              <span className="field-description">Identifier for the propagator</span>
            </div>

            <div className="form-field">
              <label>
                Input Cells <span className="required">*</span>
              </label>
              <div className="cell-picker">
                {existingCells.length === 0 ? (
                  <span className="field-description">No cells found. Create some first.</span>
                ) : (
                  existingCells.map((cell) => (
                    <label key={cell.name} className="cell-option">
                      <input
                        type="checkbox"
                        checked={propInputs.includes(cell.name)}
                        onChange={() => toggleInput(cell.name)}
                      />
                      <span className="cell-name">{cell.label || cell.name}</span>
                      {cell.value !== undefined && (
                        <span className="cell-value">{String(cell.value)}</span>
                      )}
                    </label>
                  ))
                )}
              </div>
              <span className="field-description">Select cells to read from</span>
            </div>

            <div className="form-field">
              <label htmlFor="prop-output">
                Output Cell <span className="required">*</span>
              </label>
              <select
                id="prop-output"
                value={propOutput}
                onChange={(e) => setPropOutput(e.target.value)}
                required
              >
                <option value="">Select output cell...</option>
                {existingCells.map((cell) => (
                  <option key={cell.name} value={cell.name}>
                    {cell.label || cell.name}
                  </option>
                ))}
              </select>
              <span className="field-description">Cell to write results to</span>
            </div>

            <div className="form-field">
              <label htmlFor="prop-handler">
                Handler <span className="required">*</span>
              </label>
              <select
                id="prop-handler"
                value={propHandler}
                onChange={(e) => setPropHandler(e.target.value)}
                required
              >
                <option value="sum">sum (add inputs)</option>
                <option value="product">product (multiply inputs)</option>
                <option value="passthrough">passthrough (copy first input)</option>
                <option value="constant">constant (fixed value)</option>
              </select>
              <span className="field-description">How to compute output</span>
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Creating...' : 'Create Propagator'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
