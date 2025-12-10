import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'

/**
 * React context for Bassline instance
 */
export const BasslineContext = createContext(null)

/**
 * React context for WebSocket connection
 */
export const WebSocketContext = createContext(null)

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
export function BasslineProvider({ value, children }) {
  return (
    <BasslineContext.Provider value={value}>
      {children}
    </BasslineContext.Provider>
  )
}

/**
 * Hook to access the Bassline instance
 *
 * @returns {import('@bassline/core').Bassline}
 *
 * @example
 * function MyComponent() {
 *   const bl = useBassline()
 *
 *   async function handleClick() {
 *     const data = await bl.get('bl:///data/users/alice')
 *     console.log(data)
 *   }
 *
 *   return <button onClick={handleClick}>Load</button>
 * }
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
 * @param {string} uri - Resource URI
 * @returns {{ data: any, loading: boolean, error: Error | null, refetch: () => void }}
 *
 * @example
 * function UserProfile({ userId }) {
 *   const { data, loading, error } = useResource(`bl:///data/users/${userId}`)
 *
 *   if (loading) return <div>Loading...</div>
 *   if (error) return <div>Error: {error.message}</div>
 *   if (!data) return <div>Not found</div>
 *
 *   return <div>{data.body.name}</div>
 * }
 */
export function useResource(uri) {
  const bl = useBassline()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await bl.get(uri)
      setData(result)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [bl, uri])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { data, loading, error, refetch: fetch }
}

/**
 * Hook to write to a resource
 *
 * @param {string} uri - Resource URI
 * @returns {(body: any) => Promise<any>}
 *
 * @example
 * function Counter() {
 *   const { data } = useResource('bl:///data/counter')
 *   const write = useWrite('bl:///data/counter')
 *
 *   return (
 *     <button onClick={() => write({ value: (data?.body?.value || 0) + 1 })}>
 *       Count: {data?.body?.value || 0}
 *     </button>
 *   )
 * }
 */
export function useWrite(uri) {
  const bl = useBassline()
  return useCallback((body) => bl.put(uri, {}, body), [bl, uri])
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
 * @param {string} uri - Resource URI to subscribe to
 * @param {object} options - Options
 * @param {boolean} options.subscribe - Whether to auto-subscribe (default: true)
 * @returns {{ data: any, loading: boolean, error: Error | null, refetch: () => void, isLive: boolean }}
 */
export function useLiveResource(uri, options = {}) {
  const { subscribe = true } = options
  const bl = useBassline()
  const ws = useWebSocket()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isLive, setIsLive] = useState(false)
  const subscriptionRef = useRef(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await bl.get(uri)
      setData(result)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [bl, uri])

  // Initial fetch
  useEffect(() => {
    fetch()
  }, [fetch])

  // WebSocket subscription
  useEffect(() => {
    if (!subscribe || !ws || !uri) return

    const handleMessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        // Check if this message is for our URI
        if (msg.uri === uri || msg.uri?.startsWith(uri)) {
          // Refetch on change
          fetch()
          setIsLive(true)
        }
      } catch {
        // Ignore parse errors
      }
    }

    // Subscribe to changes
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'subscribe', uri }))
      setIsLive(true)
    }

    ws.addEventListener('message', handleMessage)
    subscriptionRef.current = { uri, handler: handleMessage }

    return () => {
      ws.removeEventListener('message', handleMessage)
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'unsubscribe', uri }))
      }
      setIsLive(false)
    }
  }, [ws, uri, subscribe, fetch])

  return { data, loading, error, refetch: fetch, isLive }
}

/**
 * Hook for keyboard shortcuts
 *
 * @param {string} key - Key combination (e.g., 'k', 'Escape', 'Enter')
 * @param {function} handler - Callback when key is pressed
 * @param {object} options - Options
 * @param {boolean} options.meta - Require meta/cmd key (default: false)
 * @param {boolean} options.ctrl - Require ctrl key (default: false)
 * @param {boolean} options.shift - Require shift key (default: false)
 * @param {boolean} options.preventDefault - Prevent default behavior (default: true)
 */
export function useHotkey(key, handler, options = {}) {
  const { meta = false, ctrl = false, shift = false, preventDefault = true } = options

  useEffect(() => {
    const handleKeyDown = (e) => {
      const isMetaMatch = meta ? (e.metaKey || e.ctrlKey) : true
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
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [key, handler, meta, ctrl, shift, preventDefault])
}

/**
 * Hook to delete a resource
 *
 * @param {string} uri - Resource URI
 * @returns {() => Promise<any>}
 */
export function useDelete(uri) {
  const bl = useBassline()
  return useCallback(() => bl.delete?.(uri) || bl.put(uri, {}, null), [bl, uri])
}

/**
 * Provider for WebSocket connection with auto-reconnect
 */
export function WebSocketProvider({ url, children }) {
  const [ws, setWs] = useState(null)
  const reconnectRef = useRef(null)

  useEffect(() => {
    if (!url) return

    const connect = () => {
      const socket = new WebSocket(url)

      socket.onopen = () => {
        console.log('WebSocket connected')
        setWs(socket)
      }

      socket.onclose = () => {
        console.log('WebSocket disconnected, reconnecting...')
        setWs(null)
        // Reconnect after 2 seconds
        reconnectRef.current = setTimeout(connect, 2000)
      }

      socket.onerror = (err) => {
        console.error('WebSocket error:', err)
      }

      return socket
    }

    const socket = connect()

    return () => {
      clearTimeout(reconnectRef.current)
      socket.close()
    }
  }, [url])

  return (
    <WebSocketContext.Provider value={ws}>
      {children}
    </WebSocketContext.Provider>
  )
}
