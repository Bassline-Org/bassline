/**
 * Atom Primitives
 *
 * Standalone UI elements that dispatch events to plumber.
 */

import React, { useCallback } from 'react'

/**
 * Create a plumber event dispatcher
 * @param {object} bl - Bassline instance
 * @param {string} source - Source URI of the widget instance
 * @returns {function} Event dispatcher
 */
export function createEventDispatcher(bl, source) {
  return async (port, payload = {}) => {
    if (!port) return
    await bl.put(
      'bl:///plumb/send',
      { source, port },
      { headers: { type: 'bl:///types/ui-event' }, body: payload }
    )
  }
}

/**
 * Text - Text content display
 * @param {object} props
 * @param {string} props.content - Text content
 * @param {'body'|'caption'|'label'|'code'} [props.variant='body'] - Text style variant
 * @param {object} [props.style] - Additional CSS styles
 * @param {string} [props.className] - CSS class name
 */
export function Text({ content, variant = 'body', style, className }) {
  const variantStyles = {
    body: {},
    caption: { fontSize: '0.875rem', color: '#666' },
    label: { fontWeight: 500 },
    code: {
      fontFamily: 'monospace',
      backgroundColor: '#f5f5f5',
      padding: '2px 4px',
      borderRadius: '3px',
    },
  }

  return (
    <span style={{ ...variantStyles[variant], ...style }} className={className}>
      {content}
    </span>
  )
}

/**
 * Heading - h1-h6 heading
 * @param {object} props
 * @param {1|2|3|4|5|6} [props.level=2] - Heading level
 * @param {string} props.content - Heading content
 * @param {object} [props.style] - Additional CSS styles
 * @param {string} [props.className] - CSS class name
 */
export function Heading({ level = 2, content, style, className }) {
  const Tag = `h${level}`
  return (
    <Tag style={style} className={className}>
      {content}
    </Tag>
  )
}

/**
 * Button - Clickable button element
 * @param {object} props
 * @param {string} props.label - Button label
 * @param {'default'|'primary'|'danger'|'ghost'} [props.variant='default'] - Button style variant
 * @param {boolean} [props.disabled=false] - Whether button is disabled
 * @param {string} [props.onClick] - Plumber port for click events
 * @param {object} [props.style] - Additional CSS styles
 * @param {string} [props.className] - CSS class name
 * @param {function} [props.dispatch] - Event dispatcher (injected by renderer)
 * @param {React.ReactNode} props.children
 */
export function Button({
  label,
  variant = 'default',
  disabled = false,
  onClick,
  style,
  className,
  dispatch,
  children,
}) {
  const handleClick = useCallback(() => {
    if (onClick && dispatch) {
      dispatch(onClick, { clicked: true })
    }
  }, [onClick, dispatch])

  const variantStyles = {
    default: {
      backgroundColor: '#e5e5e5',
      color: '#333',
      border: '1px solid #ccc',
    },
    primary: {
      backgroundColor: '#0066cc',
      color: 'white',
      border: '1px solid #0055aa',
    },
    danger: {
      backgroundColor: '#dc3545',
      color: 'white',
      border: '1px solid #c82333',
    },
    ghost: {
      backgroundColor: 'transparent',
      color: '#333',
      border: '1px solid transparent',
    },
  }

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      style={{
        padding: '8px 16px',
        borderRadius: '4px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        ...variantStyles[variant],
        ...style,
      }}
      className={className}
    >
      {children || label}
    </button>
  )
}

/**
 * Input - Text input field
 * @param {object} props
 * @param {string} [props.value] - Input value
 * @param {'text'|'password'|'email'|'number'} [props.type='text'] - Input type
 * @param {string} [props.placeholder] - Placeholder text
 * @param {string} [props.name] - Input name
 * @param {boolean} [props.disabled=false] - Whether input is disabled
 * @param {string} [props.onChange] - Plumber port for change events
 * @param {string} [props.onBlur] - Plumber port for blur events
 * @param {object} [props.style] - Additional CSS styles
 * @param {string} [props.className] - CSS class name
 * @param {function} [props.dispatch] - Event dispatcher (injected by renderer)
 */
export function Input({
  value,
  type = 'text',
  placeholder,
  name,
  disabled = false,
  onChange,
  onBlur,
  style,
  className,
  dispatch,
}) {
  const handleChange = useCallback(
    (e) => {
      if (onChange && dispatch) {
        dispatch(onChange, { value: e.target.value, name })
      }
    },
    [onChange, dispatch, name]
  )

  const handleBlur = useCallback(
    (e) => {
      if (onBlur && dispatch) {
        dispatch(onBlur, { value: e.target.value, name })
      }
    },
    [onBlur, dispatch, name]
  )

  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      name={name}
      disabled={disabled}
      onChange={handleChange}
      onBlur={handleBlur}
      style={{
        padding: '8px 12px',
        borderRadius: '4px',
        border: '1px solid #ccc',
        fontSize: '14px',
        ...style,
      }}
      className={className}
    />
  )
}

/**
 * Checkbox - Boolean toggle
 * @param {object} props
 * @param {boolean} [props.checked=false] - Whether checkbox is checked
 * @param {string} [props.label] - Checkbox label
 * @param {string} [props.name] - Input name
 * @param {boolean} [props.disabled=false] - Whether checkbox is disabled
 * @param {string} [props.onChange] - Plumber port for change events
 * @param {object} [props.style] - Additional CSS styles
 * @param {string} [props.className] - CSS class name
 * @param {function} [props.dispatch] - Event dispatcher (injected by renderer)
 */
export function Checkbox({
  checked = false,
  label,
  name,
  disabled = false,
  onChange,
  style,
  className,
  dispatch,
}) {
  const handleChange = useCallback(
    (e) => {
      if (onChange && dispatch) {
        dispatch(onChange, { checked: e.target.checked, name })
      }
    },
    [onChange, dispatch, name]
  )

  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        ...style,
      }}
      className={className}
    >
      <input
        type="checkbox"
        checked={checked}
        name={name}
        disabled={disabled}
        onChange={handleChange}
      />
      {label && <span>{label}</span>}
    </label>
  )
}

/**
 * Select - Dropdown
 * @param {object} props
 * @param {string} [props.value] - Selected value
 * @param {Array<{value: string, label: string}>} [props.options=[]] - Options
 * @param {string} [props.placeholder] - Placeholder option text
 * @param {string} [props.name] - Input name
 * @param {boolean} [props.disabled=false] - Whether select is disabled
 * @param {string} [props.onChange] - Plumber port for change events
 * @param {object} [props.style] - Additional CSS styles
 * @param {string} [props.className] - CSS class name
 * @param {function} [props.dispatch] - Event dispatcher (injected by renderer)
 */
export function Select({
  value,
  options = [],
  placeholder,
  name,
  disabled = false,
  onChange,
  style,
  className,
  dispatch,
}) {
  const handleChange = useCallback(
    (e) => {
      if (onChange && dispatch) {
        dispatch(onChange, { value: e.target.value, name })
      }
    },
    [onChange, dispatch, name]
  )

  return (
    <select
      value={value}
      name={name}
      disabled={disabled}
      onChange={handleChange}
      style={{
        padding: '8px 12px',
        borderRadius: '4px',
        border: '1px solid #ccc',
        fontSize: '14px',
        ...style,
      }}
      className={className}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}

/**
 * Badge - Small indicator
 * @param {object} props
 * @param {string} props.content - Badge content
 * @param {'default'|'primary'|'success'|'warning'|'danger'} [props.variant='default'] - Badge style variant
 * @param {object} [props.style] - Additional CSS styles
 * @param {string} [props.className] - CSS class name
 */
export function Badge({ content, variant = 'default', style, className }) {
  const variantStyles = {
    default: { backgroundColor: '#e5e5e5', color: '#333' },
    primary: { backgroundColor: '#0066cc', color: 'white' },
    success: { backgroundColor: '#28a745', color: 'white' },
    warning: { backgroundColor: '#ffc107', color: '#333' },
    danger: { backgroundColor: '#dc3545', color: 'white' },
  }

  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: '12px',
        fontSize: '0.75rem',
        fontWeight: 500,
        ...variantStyles[variant],
        ...style,
      }}
      className={className}
    >
      {content}
    </span>
  )
}

/**
 * Spinner - Loading state
 * @param {object} props
 * @param {'small'|'medium'|'large'} [props.size='medium'] - Spinner size
 * @param {object} [props.style] - Additional CSS styles
 * @param {string} [props.className] - CSS class name
 */
export function Spinner({ size = 'medium', style, className }) {
  const sizes = { small: 16, medium: 24, large: 32 }
  const px = sizes[size] || sizes.medium

  return (
    <div
      style={{
        width: px,
        height: px,
        border: `${px / 8}px solid #e5e5e5`,
        borderTopColor: '#0066cc',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        ...style,
      }}
      className={className}
    />
  )
}

/**
 * Divider - Visual separator
 * @param {object} props
 * @param {'horizontal'|'vertical'} [props.orientation='horizontal'] - Divider orientation
 * @param {object} [props.style] - Additional CSS styles
 * @param {string} [props.className] - CSS class name
 */
export function Divider({ orientation = 'horizontal', style, className }) {
  const orientationStyles = {
    horizontal: { width: '100%', height: '1px', backgroundColor: '#e5e5e5' },
    vertical: { width: '1px', height: '100%', backgroundColor: '#e5e5e5' },
  }

  return <div style={{ ...orientationStyles[orientation], ...style }} className={className} />
}

/**
 * Register atom primitives with a widget registry
 * @param {object} registry - Widget registry from @bassline/widgets
 */
export function registerAtomPrimitives(registry) {
  registry.registerPrimitive('text', {
    type: 'bl:///types/widgets/atom/text',
    props: {
      content: { type: 'string', required: true },
      variant: { type: 'string', default: 'body' },
      style: { type: 'object' },
      className: { type: 'string' },
    },
    render: Text,
  })

  registry.registerPrimitive('heading', {
    type: 'bl:///types/widgets/atom/heading',
    props: {
      level: { type: 'number', default: 2 },
      content: { type: 'string', required: true },
      style: { type: 'object' },
      className: { type: 'string' },
    },
    render: Heading,
  })

  registry.registerPrimitive('button', {
    type: 'bl:///types/widgets/atom/button',
    props: {
      label: { type: 'string' },
      variant: { type: 'string', default: 'default' },
      disabled: { type: 'boolean', default: false },
      onClick: { type: 'port' },
      style: { type: 'object' },
      className: { type: 'string' },
    },
    render: Button,
  })

  registry.registerPrimitive('input', {
    type: 'bl:///types/widgets/atom/input',
    props: {
      value: { type: 'string' },
      type: { type: 'string', default: 'text' },
      placeholder: { type: 'string' },
      name: { type: 'string' },
      disabled: { type: 'boolean', default: false },
      onChange: { type: 'port' },
      onBlur: { type: 'port' },
      style: { type: 'object' },
      className: { type: 'string' },
    },
    render: Input,
  })

  registry.registerPrimitive('checkbox', {
    type: 'bl:///types/widgets/atom/checkbox',
    props: {
      checked: { type: 'boolean', default: false },
      label: { type: 'string' },
      name: { type: 'string' },
      disabled: { type: 'boolean', default: false },
      onChange: { type: 'port' },
      style: { type: 'object' },
      className: { type: 'string' },
    },
    render: Checkbox,
  })

  registry.registerPrimitive('select', {
    type: 'bl:///types/widgets/atom/select',
    props: {
      value: { type: 'string' },
      options: { type: 'array' },
      placeholder: { type: 'string' },
      name: { type: 'string' },
      disabled: { type: 'boolean', default: false },
      onChange: { type: 'port' },
      style: { type: 'object' },
      className: { type: 'string' },
    },
    render: Select,
  })

  registry.registerPrimitive('badge', {
    type: 'bl:///types/widgets/atom/badge',
    props: {
      content: { type: 'string', required: true },
      variant: { type: 'string', default: 'default' },
      style: { type: 'object' },
      className: { type: 'string' },
    },
    render: Badge,
  })

  registry.registerPrimitive('spinner', {
    type: 'bl:///types/widgets/atom/spinner',
    props: {
      size: { type: 'string', default: 'medium' },
      style: { type: 'object' },
      className: { type: 'string' },
    },
    render: Spinner,
  })

  registry.registerPrimitive('divider', {
    type: 'bl:///types/widgets/atom/divider',
    props: {
      orientation: { type: 'string', default: 'horizontal' },
      style: { type: 'object' },
      className: { type: 'string' },
    },
    render: Divider,
  })
}
