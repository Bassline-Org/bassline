import { createContext, useContext, useState, useEffect, useCallback } from 'react'

/**
 * React context for Bassline instance
 */
export const BasslineContext = createContext(null)

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
