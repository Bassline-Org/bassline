import { createContext, useContext, useEffect, useRef } from 'react'
import { port, consume } from '@bassline/core'

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

export function useConsume(recv, cb) {
  const cbRef = useRef(cb)
  cbRef.current = cb
  useEffect(() => {
    consume(recv, msg => cbRef.current(msg))
  }, [])
}

export function usePort(factory = port) {
  const ref = useRef(null)
  if (!ref.current) ref.current = factory()
  return ref.current
}
