/**
 * Widget Compiler
 *
 * Resolves Hiccup-style widget definitions into render trees.
 *
 * Format: [widget, props?, ...children]
 * - widget: string (widget name) or URI ('bl:///widgets/button')
 * - If second element is plain object (not array/string), it's props
 * - Remaining elements are children (strings, arrays, or nested widgets)
 *
 * Examples:
 *   'button'                                → primitive button
 *   ['button', { label: 'Save' }]           → button with props
 *   ['stack', { gap: 8 }, ['button'], ['text']] → stack with children
 *   ['bl:///widgets/login-form', {}]        → custom widget by URI
 *
 * Prop interpolation:
 *   '$propName' in a prop value is replaced with the corresponding prop from parent
 */

const MAX_DEPTH = 50

/**
 * Create a compiler function bound to a registry.
 * @param {object} registry - Widget registry
 * @returns {Function} Compiler function
 */
export function createCompiler(registry) {
  /**
   * Normalize a widget reference to a URI.
   * @param {string} ref - Widget name or URI
   * @returns {string} Full URI
   */
  function toUri(ref) {
    if (ref.startsWith('bl:///')) return ref
    return `bl:///widgets/${ref}`
  }

  /**
   * Interpolate prop references ($propName) in a value.
   * @param {any} value - Value to interpolate
   * @param {object} props - Props to interpolate from
   * @returns {any} Interpolated value
   */
  function interpolate(value, props) {
    if (typeof value === 'string' && value.startsWith('$')) {
      const propName = value.slice(1)
      return props[propName]
    }
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const result = {}
      for (const [k, v] of Object.entries(value)) {
        result[k] = interpolate(v, props)
      }
      return result
    }
    return value
  }

  /**
   * Resolve a Hiccup-style definition into a render tree.
   * @param {any} def - Definition (string or array)
   * @param {object} [parentProps] - Props from parent for interpolation
   * @param {number} [depth] - Current recursion depth (for protection)
   * @returns {object} Resolved render tree node
   */
  function resolve(def, parentProps = {}, depth = 0) {
    // Prevent infinite recursion from self-referencing or circular widgets
    if (depth > MAX_DEPTH) {
      throw new Error(`Widget definition too deeply nested (max depth: ${MAX_DEPTH})`)
    }

    // Null/undefined → null node
    if (def === null) {
      return null
    }

    // String without brackets = text content
    if (typeof def === 'string') {
      // Check if it's a widget reference
      if (def.startsWith('bl:///widgets/')) {
        const widget = registry.getSync(def)
        if (!widget) {
          return { type: 'error', message: `Unknown widget: ${def}` }
        }
        if (widget.primitive) {
          return { type: 'primitive', widget: def, props: {}, children: [] }
        }
        // Resolve custom widget's definition
        return resolve(widget.definition, {}, depth + 1)
      }
      // Plain string = text content
      return { type: 'text', content: def }
    }

    // Non-array = invalid
    if (!Array.isArray(def)) {
      throw new Error(`Invalid definition: expected string or array, got ${typeof def}`)
    }

    // Empty array = null
    if (def.length === 0) {
      return null
    }

    const [widgetRef, ...rest] = def
    let props = {}
    let children = rest

    // If second element is plain object (not array/string), it's props
    if (rest[0] && typeof rest[0] === 'object' && !Array.isArray(rest[0])) {
      props = rest[0]
      children = rest.slice(1)
    }

    // Interpolate props from parent
    const resolvedProps = {}
    for (const [key, value] of Object.entries(props)) {
      resolvedProps[key] = interpolate(value, parentProps)
    }

    // Get widget from registry
    const uri = toUri(widgetRef)
    const widget = registry.getSync(uri)

    if (!widget) {
      return { type: 'error', message: `Unknown widget: ${uri}` }
    }

    // Recursively resolve children
    const resolvedChildren = children.map((child) => resolve(child, resolvedProps, depth + 1))

    if (widget.primitive) {
      // Primitive: return render node for platform renderer
      return {
        type: 'primitive',
        widget: uri,
        name: widget.name,
        props: resolvedProps,
        children: resolvedChildren,
      }
    }

    // Custom widget: resolve its definition with merged props
    const mergedProps = { ...widget.props, ...resolvedProps }
    const resolved = resolve(widget.definition, mergedProps, depth + 1)

    // If the resolved node has children slots, fill them
    if (resolvedChildren.length > 0 && resolved) {
      resolved.slotChildren = resolvedChildren
    }

    return resolved
  }

  /**
   * Compile a widget definition (alias for resolve with empty props).
   * @param {any} def - Definition
   * @returns {object} Render tree
   */
  function compile(def) {
    return resolve(def, {}, 0)
  }

  return compile
}

/**
 * Walk a render tree, calling a visitor function for each node.
 * @param {object} tree - Render tree
 * @param {Function} visitor - (node, depth) => void
 * @param {number} [depth] - Current depth
 */
export function walkTree(tree, visitor, depth = 0) {
  if (!tree) return
  visitor(tree, depth)
  if (tree.children) {
    for (const child of tree.children) {
      walkTree(child, visitor, depth + 1)
    }
  }
  if (tree.slotChildren) {
    for (const child of tree.slotChildren) {
      walkTree(child, visitor, depth + 1)
    }
  }
}

/**
 * Collect all widget URIs referenced in a render tree.
 * @param {object} tree - Render tree
 * @returns {string[]} Array of widget URIs
 */
export function collectWidgetRefs(tree) {
  const refs = new Set()
  walkTree(tree, (node) => {
    if (node.widget) refs.add(node.widget)
  })
  return [...refs]
}
