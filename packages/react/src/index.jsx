import { createContext, useContext, useEffect, useMemo, useRef } from 'react'
import { port, consume, isEOF } from '@bassline/core'

const NetContext = createContext(null)

export function Net({ join, children }) {
  return <NetContext.Provider value={join}>{children}</NetContext.Provider>
}

export function useNet() {
  return useContext(NetContext)
}

export function useJoin(join) {
  const ref = useRef(null)
  if (!ref.current) ref.current = join()
  useEffect(() => () => ref.current.close(), [])
  return ref.current
}

export function useSink(recv, cb) {
  const started = useRef(false)
  useEffect(() => {
    if (!started.current) {
      started.current = true
      consume(recv, cb)
    }
  }, [])
}

export function usePort(factory = port) {
  const ref = useRef(null)
  if (!ref.current) ref.current = factory()
  return ref.current
}
