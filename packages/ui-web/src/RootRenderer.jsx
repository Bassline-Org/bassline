/**
 * RootRenderer
 *
 * The root render surface that subscribes to bl:///ui/root
 * and renders whatever content is specified there.
 *
 * This is the entry point for resource-driven UI.
 */

import React, { useMemo, useState, useEffect } from 'react'
import { useBassline, useLiveResource } from '@bassline/react'
import { WidgetRenderer, WidgetProvider } from './WidgetRenderer.jsx'

/**
 * InstanceRenderer - Renders a widget instance by URI
 *
 * Fetches the instance definition and renders it.
 *
 * @param {object} props
 * @param {string} props.uri - Instance URI (e.g., 'bl:///ui/dashboard')
 * @param {object} props.registry - Widget registry
 * @param {Function} props.compile - Compiler function
 */
export function InstanceRenderer({ uri, registry, compile }) {
  const { data, loading, error } = useLiveResource(uri)

  if (loading) {
    return (
      <div
        style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '32px' }}
      >
        <div
          style={{
            width: 24,
            height: 24,
            border: '3px solid #e5e5e5',
            borderTopColor: '#0066cc',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        />
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ color: 'red', padding: '16px', backgroundColor: '#fee', borderRadius: '4px' }}>
        Error loading instance {uri}: {error.message}
      </div>
    )
  }

  if (!data) {
    return (
      <div style={{ color: '#666', padding: '16px', textAlign: 'center' }}>
        Instance not found: {uri}
      </div>
    )
  }

  // Instance body can have:
  // - definition: inline hiccup definition
  // - widget: URI to a widget definition
  // - widgetConfig: props to pass to the widget
  const { body } = data
  const definition =
    body?.definition || (body?.widget ? [body.widget, body.widgetConfig || {}] : null)

  if (!definition) {
    return (
      <div style={{ color: 'orange', padding: '16px' }}>
        Instance {uri} has no definition or widget reference
      </div>
    )
  }

  return (
    <WidgetRenderer
      definition={definition}
      registry={registry}
      compile={compile}
      instanceUri={uri}
    />
  )
}

/**
 * RootRenderer - Subscribes to bl:///ui/root and renders content
 *
 * The content can be:
 * - A URI string: renders that instance
 * - An inline definition: renders directly
 *
 * @param {object} props
 * @param {object} props.registry - Widget registry
 * @param {Function} props.compile - Compiler function
 * @param {React.ReactNode} [props.fallback] - Fallback when no content
 *
 * @example
 * function App() {
 *   const widgets = useWidgetsModule()
 *   return (
 *     <BasslineProvider value={bl}>
 *       <WebSocketProvider url="ws://localhost:9111">
 *         <RootRenderer
 *           registry={widgets.registry}
 *           compile={widgets.compile}
 *         />
 *       </WebSocketProvider>
 *     </BasslineProvider>
 *   )
 * }
 */
export function RootRenderer({ registry, compile, fallback }) {
  const { data, loading, error } = useLiveResource('bl:///ui/root')

  if (loading) {
    return (
      <div
        style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            border: '4px solid #e5e5e5',
            borderTopColor: '#0066cc',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        />
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ color: 'red', padding: '32px', textAlign: 'center' }}>
        Error loading root: {error.message}
      </div>
    )
  }

  if (!data || !data.body?.content) {
    // No root content set - render fallback or empty
    return (
      fallback || (
        <div style={{ color: '#666', padding: '32px', textAlign: 'center' }}>
          No UI root defined. Set content at bl:///ui/root
        </div>
      )
    )
  }

  const { content } = data.body

  // Wrap in provider for context
  return (
    <WidgetProvider registry={registry} compile={compile}>
      {typeof content === 'string' ? (
        // URI reference - render that instance
        <InstanceRenderer uri={content} registry={registry} compile={compile} />
      ) : (
        // Inline definition - render directly
        <WidgetRenderer
          definition={content}
          registry={registry}
          compile={compile}
          instanceUri="bl:///ui/root"
        />
      )}
    </WidgetProvider>
  )
}

/**
 * CSS for spinner animation
 * Add this to your app's global styles or use a style tag
 */
export const spinnerStyles = `
@keyframes spin {
  to { transform: rotate(360deg); }
}
`

/**
 * GlobalStyles - Injects necessary global styles
 */
export function GlobalStyles() {
  return <style dangerouslySetInnerHTML={{ __html: spinnerStyles }} />
}
