import { createContext, useContext, createSignal, createResource, onCleanup } from 'solid-js'

/**
 * Solid.js context for Bassline instance
 */
const BasslineContext = createContext(null)

/**
 * Solid.js context for WebSocket connection
 */
const WebSocketContext = createContext(null)

/**
 * Provider component for Bassline instance
 *
 * @example
 * import { Bassline } from '@bassline/core'
 * import { createRemoteRoutes } from '@bassline/remote-browser'
 *
 * const bl = new Bassline()
 * bl.install(createRemoteRoutes())
 *
 * function App() {
 *   return (
 *     <BasslineProvider value={bl}>
 *       <MyComponent />
 *     </BasslineProvider>
 *   )
 * }
 */
export function BasslineProvider(props) {
  return <BasslineContext.Provider value={props.value}>{props.children}</BasslineContext.Provider>
}

/**
 * Hook to access the Bassline instance
 *
 * @returns {import('@bassline/core').Bassline}
 */
export function useBassline() {
  const bl = useContext(BasslineContext)
  if (!bl) {
    throw new Error('useBassline must be used within a BasslineProvider')
  }
  return bl
}

/**
 * Hook to fetch a resource by URI
 *
 * @param {() => string} uri - Accessor returning resource URI
 * @returns {{ data: any, loading: boolean, error: Error | null, refetch: () => void }}
 *
 * @example
 * function UserProfile(props) {
 *   const { data, loading, error } = useResource(() => `bl:///data/users/${props.userId}`)
 *
 *   return (
 *     <Show when={!loading()} fallback={<div>Loading...</div>}>
 *       <div>{data()?.body?.name}</div>
 *     </Show>
 *   )
 * }
 */
export function useResource(uri) {
  const bl = useBassline()

  const [resource, { refetch, mutate }] = createResource(uri, async (u) => {
    if (!u) return null
    try {
      return await bl.get(u)
    } catch (err) {
      throw err
    }
  })

  return {
    data: () => resource()?.body,
    headers: () => resource()?.headers,
    raw: resource,
    loading: () => resource.loading,
    error: () => resource.error,
    refetch,
    mutate,
  }
}

/**
 * Hook to write to a resource
 *
 * @param {() => string} uri - Accessor returning resource URI
 * @returns {(body: any, headers?: object) => Promise<any>}
 *
 * @example
 * function Counter() {
 *   const { data } = useResource(() => 'bl:///cells/counter')
 *   const write = useWrite(() => 'bl:///cells/counter/value')
 *
 *   return (
 *     <button onClick={() => write((data()?.value || 0) + 1)}>
 *       Count: {data()?.value || 0}
 *     </button>
 *   )
 * }
 */
export function useWrite(uri) {
  const bl = useBassline()
  return (body, headers = {}) => bl.put(typeof uri === 'function' ? uri() : uri, headers, body)
}

/**
 * Hook to access the WebSocket connection
 */
export function useWebSocket() {
  return useContext(WebSocketContext)
}

/**
 * Hook for live-updating resource with WebSocket subscription
 *
 * @param {() => string} uri - Accessor returning resource URI
 * @param {object} options - Options
 * @param {boolean} options.subscribe - Whether to auto-subscribe (default: true)
 * @returns {{ data: any, loading: boolean, error: Error | null, refetch: () => void, isLive: boolean }}
 */
export function useLiveResource(uri, options = {}) {
  const { subscribe = true } = options
  const bl = useBassline()
  const ws = useWebSocket()

  const [isLive, setIsLive] = createSignal(false)

  const [resource, { refetch, mutate }] = createResource(uri, async (u) => {
    if (!u) return null
    try {
      return await bl.get(u)
    } catch (err) {
      throw err
    }
  })

  // WebSocket subscription
  if (subscribe && ws) {
    const handleMessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        const currentUri = typeof uri === 'function' ? uri() : uri
        // Check if this message is for our URI
        if (msg.uri === currentUri || msg.uri?.startsWith(currentUri)) {
          refetch()
          setIsLive(true)
        }
      } catch {
        // Ignore parse errors
      }
    }

    // Subscribe when ws is ready
    const currentUri = typeof uri === 'function' ? uri() : uri
    if (ws.readyState === WebSocket.OPEN && currentUri) {
      ws.send(JSON.stringify({ type: 'subscribe', uri: currentUri }))
      setIsLive(true)
    }

    ws.addEventListener('message', handleMessage)

    onCleanup(() => {
      ws.removeEventListener('message', handleMessage)
      if (ws.readyState === WebSocket.OPEN && currentUri) {
        ws.send(JSON.stringify({ type: 'unsubscribe', uri: currentUri }))
      }
      setIsLive(false)
    })
  }

  return {
    data: () => resource()?.body,
    headers: () => resource()?.headers,
    raw: resource,
    loading: () => resource.loading,
    error: () => resource.error,
    refetch,
    mutate,
    isLive,
  }
}

/**
 * Provider for WebSocket connection with auto-reconnect
 */
export function WebSocketProvider(props) {
  const [ws, setWs] = createSignal(null)

  if (props.url) {
    let reconnectTimeout = null

    const connect = () => {
      const socket = new WebSocket(props.url)

      socket.onopen = () => {
        console.log('WebSocket connected')
        setWs(socket)
      }

      socket.onclose = () => {
        console.log('WebSocket disconnected, reconnecting...')
        setWs(null)
        // Reconnect after 2 seconds
        reconnectTimeout = setTimeout(connect, 2000)
      }

      socket.onerror = (err) => {
        console.error('WebSocket error:', err)
      }

      return socket
    }

    const socket = connect()

    onCleanup(() => {
      clearTimeout(reconnectTimeout)
      socket.close()
    })
  }

  return <WebSocketContext.Provider value={ws()}>{props.children}</WebSocketContext.Provider>
}

/**
 * Hook for keyboard shortcuts
 *
 * @param {string} key - Key to listen for
 * @param {function} handler - Callback when key is pressed
 * @param {object} options - Options
 */
export function useHotkey(key, handler, options = {}) {
  const { meta = false, ctrl = false, shift = false, preventDefault = true } = options

  const handleKeyDown = (e) => {
    const isMetaMatch = meta ? e.metaKey || e.ctrlKey : true
    const isCtrlMatch = ctrl ? e.ctrlKey : true
    const isShiftMatch = shift ? e.shiftKey : true
    const isKeyMatch = e.key.toLowerCase() === key.toLowerCase()

    if (isMetaMatch && isCtrlMatch && isShiftMatch && isKeyMatch) {
      if (preventDefault) {
        e.preventDefault()
      }
      handler(e)
    }
  }

  window.addEventListener('keydown', handleKeyDown)

  onCleanup(() => {
    window.removeEventListener('keydown', handleKeyDown)
  })
}
