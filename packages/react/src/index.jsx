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
  const recvRef = useRef(recv)

  if (recvRef.current !== recv) {
    throw new Error(
      'useConsume requires a stable recv for the lifetime of the mounted component. Remount the consumer when the source changes.'
    )
  }

  if (loop.current) loop.current.cb = cb

  useEffect(() => {
    if (!loop.current) {
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
      loop.current.active = true
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
