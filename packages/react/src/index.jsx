import { createContext, useContext, useEffect, useRef } from 'react'
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

export function useConsume(recv, cb) {
  const loop = useRef(null)

  useEffect(() => {
    if (!loop.current) {
      // First mount: start the single consume loop
      const state = { active: true, cb }
      loop.current = state
      ;(async () => {
        while (true) {
          const msg = await recv()
          if (isEOF(msg)) break
          if (state.active) state.cb(msg)
        }
      })()
    } else {
      // StrictMode remount: reactivate with current callback
      loop.current.active = true
      loop.current.cb = cb
    }

    return () => {
      if (loop.current) loop.current.active = false
    }
  }, [])
}

export function usePort(factory = port) {
  const ref = useRef(null)
  if (!ref.current) ref.current = factory()
  return ref.current
}
