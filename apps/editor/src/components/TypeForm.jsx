import { useState, useEffect, useCallback } from 'react'
import { IconCheck, IconX, IconPlus, IconTrash } from '@tabler/icons-react'

/**
 * Get input type for schema field type
 */
function getInputType(fieldType) {
  switch (fieldType) {
    case 'number':
      return 'number'
    case 'boolean':
      return 'checkbox'
    case 'email':
      return 'email'
    case 'url':
      return 'url'
    case 'date':
      return 'date'
    case 'datetime':
      return 'datetime-local'
    default:
      return 'text'
  }
}

/**
 * Render a form field based on schema definition
 */
function FormField({ name, definition, value, onChange, error }) {
  const {
    type = 'string',
    description,
    required,
    enum: enumValues,
    pattern,
    min,
    max,
    minLength,
    maxLength,
    placeholder
  } = definition

  const handleChange = (e) => {
    let newValue = e.target.value

    // Type coercion
    if (type === 'number') {
      newValue = e.target.value === '' ? null : Number(e.target.value)
    } else if (type === 'boolean') {
      newValue = e.target.checked
    }

    onChange(name, newValue)
  }

  // Render enum as dropdown
  if (enumValues && Array.isArray(enumValues)) {
    return (
      <div className={`form-field ${error ? 'has-error' : ''}`}>
        <label htmlFor={name}>
          {name}
          {required && <span className="required">*</span>}
        </label>
        <select
          id={name}
          value={value ?? ''}
          onChange={handleChange}
          required={required}
        >
          <option value="">Select...</option>
          {enumValues.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
        {description && <span className="field-description">{description}</span>}
        {error && <span className="field-error">{error}</span>}
      </div>
    )
  }

  // Render array as tag input
  if (type === 'array') {
    const arrayValue = Array.isArray(value) ? value : []

    const handleAdd = () => {
      const input = document.getElementById(`${name}-input`)
      if (input && input.value.trim()) {
        onChange(name, [...arrayValue, input.value.trim()])
        input.value = ''
      }
    }

    const handleRemove = (index) => {
      onChange(name, arrayValue.filter((_, i) => i !== index))
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleAdd()
      }
    }

    return (
      <div className={`form-field form-field-array ${error ? 'has-error' : ''}`}>
        <label htmlFor={name}>
          {name}
          {required && <span className="required">*</span>}
        </label>
        <div className="array-field">
          <div className="array-items">
            {arrayValue.map((item, i) => (
              <span key={i} className="array-tag">
                {String(item)}
                <button type="button" onClick={() => handleRemove(i)}>
                  <IconX size={12} />
                </button>
              </span>
            ))}
          </div>
          <div className="array-input">
            <input
              id={`${name}-input`}
              type="text"
              placeholder="Add item..."
              onKeyDown={handleKeyDown}
            />
            <button type="button" onClick={handleAdd} className="btn btn-small">
              <IconPlus size={14} />
            </button>
          </div>
        </div>
        {description && <span className="field-description">{description}</span>}
        {error && <span className="field-error">{error}</span>}
      </div>
    )
  }

  // Render object as JSON textarea
  if (type === 'object') {
    const jsonValue = value != null ? JSON.stringify(value, null, 2) : ''

    const handleJsonChange = (e) => {
      try {
        const parsed = JSON.parse(e.target.value)
        onChange(name, parsed)
      } catch {
        // Keep the text but don't parse
        onChange(name, e.target.value)
      }
    }

    return (
      <div className={`form-field form-field-object ${error ? 'has-error' : ''}`}>
        <label htmlFor={name}>
          {name}
          {required && <span className="required">*</span>}
        </label>
        <textarea
          id={name}
          value={jsonValue}
          onChange={handleJsonChange}
          placeholder={placeholder || '{}'}
          rows={4}
        />
        {description && <span className="field-description">{description}</span>}
        {error && <span className="field-error">{error}</span>}
      </div>
    )
  }

  // Render boolean as checkbox
  if (type === 'boolean') {
    return (
      <div className={`form-field form-field-checkbox ${error ? 'has-error' : ''}`}>
        <label htmlFor={name}>
          <input
            type="checkbox"
            id={name}
            checked={!!value}
            onChange={handleChange}
          />
          {name}
          {required && <span className="required">*</span>}
        </label>
        {description && <span className="field-description">{description}</span>}
        {error && <span className="field-error">{error}</span>}
      </div>
    )
  }

  // Render long text as textarea
  if (type === 'text' || (type === 'string' && maxLength && maxLength > 200)) {
    return (
      <div className={`form-field ${error ? 'has-error' : ''}`}>
        <label htmlFor={name}>
          {name}
          {required && <span className="required">*</span>}
        </label>
        <textarea
          id={name}
          value={value ?? ''}
          onChange={handleChange}
          required={required}
          placeholder={placeholder || description}
          minLength={minLength}
          maxLength={maxLength}
          rows={4}
        />
        {description && <span className="field-description">{description}</span>}
        {error && <span className="field-error">{error}</span>}
      </div>
    )
  }

  // Default: render as text input
  return (
    <div className={`form-field ${error ? 'has-error' : ''}`}>
      <label htmlFor={name}>
        {name}
        {required && <span className="required">*</span>}
      </label>
      <input
        type={getInputType(type)}
        id={name}
        value={value ?? ''}
        onChange={handleChange}
        required={required}
        placeholder={placeholder || description}
        pattern={pattern}
        min={min}
        max={max}
        minLength={minLength}
        maxLength={maxLength}
      />
      {description && <span className="field-description">{description}</span>}
      {error && <span className="field-error">{error}</span>}
    </div>
  )
}

/**
 * Validate form values against schema
 */
function validateForm(schema, values) {
  const errors = {}

  for (const [field, def] of Object.entries(schema)) {
    const value = values[field]

    // Required check
    if (def.required && (value === undefined || value === null || value === '')) {
      errors[field] = 'This field is required'
      continue
    }

    // Skip validation if empty and not required
    if (value === undefined || value === null || value === '') {
      continue
    }

    // Type validation
    if (def.type === 'number' && typeof value !== 'number') {
      errors[field] = 'Must be a number'
    }

    // Pattern validation
    if (def.pattern && typeof value === 'string') {
      const regex = new RegExp(def.pattern)
      if (!regex.test(value)) {
        errors[field] = 'Invalid format'
      }
    }

    // Min/max for numbers
    if (def.type === 'number' && typeof value === 'number') {
      if (def.min !== undefined && value < def.min) {
        errors[field] = `Must be at least ${def.min}`
      }
      if (def.max !== undefined && value > def.max) {
        errors[field] = `Must be at most ${def.max}`
      }
    }

    // MinLength/maxLength for strings
    if (typeof value === 'string') {
      if (def.minLength !== undefined && value.length < def.minLength) {
        errors[field] = `Must be at least ${def.minLength} characters`
      }
      if (def.maxLength !== undefined && value.length > def.maxLength) {
        errors[field] = `Must be at most ${def.maxLength} characters`
      }
    }
  }

  return errors
}

/**
 * TypeForm - Auto-generated form from type schema
 *
 * @param {object} props
 * @param {object} props.schema - Field definitions { fieldName: { type, description, required, ... } }
 * @param {object} props.values - Current form values
 * @param {function} props.onSubmit - Called with validated values
 * @param {function} props.onChange - Called on any value change
 * @param {function} props.onCancel - Called when cancel is clicked
 * @param {boolean} props.loading - Show loading state
 * @param {string} props.submitLabel - Submit button label
 */
export default function TypeForm({
  schema = {},
  values: initialValues = {},
  onSubmit,
  onChange,
  onCancel,
  loading = false,
  submitLabel = 'Save'
}) {
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})

  // Reset form when initialValues change
  useEffect(() => {
    setValues(initialValues)
    setErrors({})
    setTouched({})
  }, [initialValues])

  const handleChange = useCallback((field, value) => {
    setValues(prev => {
      const next = { ...prev, [field]: value }
      onChange?.(next)
      return next
    })
    setTouched(prev => ({ ...prev, [field]: true }))
  }, [onChange])

  const handleSubmit = (e) => {
    e.preventDefault()

    // Mark all fields as touched
    const allTouched = {}
    for (const field of Object.keys(schema)) {
      allTouched[field] = true
    }
    setTouched(allTouched)

    // Validate
    const validationErrors = validateForm(schema, values)
    setErrors(validationErrors)

    if (Object.keys(validationErrors).length === 0) {
      onSubmit?.(values)
    }
  }

  const fields = Object.entries(schema)

  if (fields.length === 0) {
    return (
      <div className="type-form empty">
        <p>No schema defined for this type</p>
      </div>
    )
  }

  return (
    <form className="type-form" onSubmit={handleSubmit}>
      <div className="type-form-fields">
        {fields.map(([name, definition]) => (
          <FormField
            key={name}
            name={name}
            definition={definition}
            value={values[name]}
            onChange={handleChange}
            error={touched[name] ? errors[name] : null}
          />
        ))}
      </div>

      <div className="type-form-actions">
        {onCancel && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={loading}
          >
            <IconX size={14} />
            Cancel
          </button>
        )}
        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading}
        >
          {loading ? (
            <span className="loading-spinner" />
          ) : (
            <IconCheck size={14} />
          )}
          {submitLabel}
        </button>
      </div>
    </form>
  )
}
