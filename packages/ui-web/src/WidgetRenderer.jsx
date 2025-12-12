/**
 * WidgetRenderer
 *
 * Renders widget definitions (hiccup) to React components.
 * Uses the widget registry to resolve primitives and custom widgets.
 */

import React, { useMemo, useCallback, createContext, useContext } from 'react'
import { useBassline } from '@bassline/react'
import { createEventDispatcher } from './primitives/atoms.jsx'

/**
 * Context for widget rendering
 */
const WidgetContext = createContext(null)

/**
 * Hook to access widget context (registry, compile, dispatch)
 */
export function useWidgetContext() {
  return useContext(WidgetContext)
}

/**
 * Render a node from the compiled render tree
 * @param {object} props
 * @param {object} props.node - Render tree node
 * @param {string} [props.instanceUri] - URI of the widget instance
 */
function RenderNode({ node, instanceUri }) {
  const { registry, dispatch } = useWidgetContext()

  if (!node) return null

  // Error node
  if (node.type === 'error') {
    return (
      <div style={{ color: 'red', padding: '8px', backgroundColor: '#fee', borderRadius: '4px' }}>
        Widget Error: {node.message}
      </div>
    )
  }

  // Text node
  if (node.type === 'text') {
    return <>{node.content}</>
  }

  // Primitive node
  if (node.type === 'primitive') {
    const widget = registry.getSync(node.widget)
    if (!widget || !widget.render) {
      return <div style={{ color: 'orange', padding: '4px' }}>Missing primitive: {node.widget}</div>
    }

    const Component = widget.render

    // Render children recursively
    const children = node.children?.map((child, i) => (
      <RenderNode key={i} node={child} instanceUri={instanceUri} />
    ))

    // Render slot children if present
    const slotChildren = node.slotChildren?.map((child, i) => (
      <RenderNode key={`slot-${i}`} node={child} instanceUri={instanceUri} />
    ))

    // Pass dispatch for event handling
    return (
      <Component {...node.props} dispatch={dispatch}>
        {children}
        {slotChildren}
      </Component>
    )
  }

  // Unknown node type
  return <div style={{ color: 'orange', padding: '4px' }}>Unknown node type: {node.type}</div>
}

/**
 * WidgetRenderer - Renders widget definitions to React
 *
 * @param {object} props
 * @param {any} props.definition - Widget definition (hiccup array or widget name)
 * @param {object} props.registry - Widget registry
 * @param {Function} props.compile - Compiler function
 * @param {string} [props.instanceUri] - URI of the widget instance (for event dispatch)
 *
 * @example
 * // Render a button
 * <WidgetRenderer
 *   definition={['button', { label: 'Click me', onClick: 'btn-clicked' }]}
 *   registry={widgets.registry}
 *   compile={widgets.compile}
 * />
 *
 * @example
 * // Render a complex layout
 * <WidgetRenderer
 *   definition={['stack', { direction: 'vertical', gap: 16 },
 *     ['heading', { level: 1, content: 'Hello' }],
 *     ['text', { content: 'Welcome to Bassline' }],
 *     ['button', { label: 'Get Started', variant: 'primary', onClick: 'start-clicked' }]
 *   ]}
 *   registry={widgets.registry}
 *   compile={widgets.compile}
 * />
 */
export function WidgetRenderer({ definition, registry, compile, instanceUri }) {
  const bl = useBassline()

  // Create event dispatcher bound to this instance
  const dispatch = useCallback(
    (port, payload) =>
      createEventDispatcher(bl, instanceUri || 'bl:///ui/anonymous')(port, payload),
    [bl, instanceUri]
  )

  // Compile the definition to a render tree
  const renderTree = useMemo(() => {
    try {
      return compile(definition)
    } catch (err) {
      return { type: 'error', message: err.message }
    }
  }, [compile, definition])

  // Provide context for nested components
  const contextValue = useMemo(
    () => ({ registry, compile, dispatch }),
    [registry, compile, dispatch]
  )

  return (
    <WidgetContext.Provider value={contextValue}>
      <RenderNode node={renderTree} instanceUri={instanceUri} />
    </WidgetContext.Provider>
  )
}

/**
 * WidgetProvider - Provides widget context for an entire subtree
 *
 * Use this to wrap your app and provide widget rendering capabilities.
 *
 * @param {object} props
 * @param {object} props.registry - Widget registry
 * @param {Function} props.compile - Compiler function
 * @param {React.ReactNode} props.children
 *
 * @example
 * function App() {
 *   const widgets = useWidgetsModule()
 *   return (
 *     <WidgetProvider registry={widgets.registry} compile={widgets.compile}>
 *       <MyComponents />
 *     </WidgetProvider>
 *   )
 * }
 */
export function WidgetProvider({ registry, compile, children }) {
  const bl = useBassline()

  const dispatch = useCallback(
    (port, payload) => createEventDispatcher(bl, 'bl:///ui/provider')(port, payload),
    [bl]
  )

  const contextValue = useMemo(
    () => ({ registry, compile, dispatch }),
    [registry, compile, dispatch]
  )

  return <WidgetContext.Provider value={contextValue}>{children}</WidgetContext.Provider>
}

/**
 * Widget - Shorthand component that uses context
 *
 * Must be used within a WidgetProvider.
 *
 * @param {object} props
 * @param {any} props.definition - Widget definition
 * @param {string} [props.instanceUri] - Instance URI
 *
 * @example
 * <WidgetProvider registry={registry} compile={compile}>
 *   <Widget definition={['button', { label: 'Click' }]} />
 * </WidgetProvider>
 */
export function Widget({ definition, instanceUri }) {
  const context = useWidgetContext()

  if (!context) {
    return (
      <div style={{ color: 'red', padding: '8px' }}>
        Widget must be used within a WidgetProvider
      </div>
    )
  }

  const { registry, compile } = context

  const renderTree = useMemo(() => {
    try {
      return compile(definition)
    } catch (err) {
      return { type: 'error', message: err.message }
    }
  }, [compile, definition])

  return <RenderNode node={renderTree} instanceUri={instanceUri} />
}
