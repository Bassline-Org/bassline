import { createContext, useContext, useEffect, useRef } from 'react'
import { channel } from '@bassline/core'

const NetContext = createContext(null)

export function Net({ net, children }) {
  return <NetContext.Provider value={net}>{children}</NetContext.Provider>
}

export function useNet() {
  return useContext(NetContext)
}

export function useJoin(net, cb = r => r) {
  const ref = useRef(null)
  if (!ref.current) {
    const [r, w] = net.join()
    ref.current = [cb(r), w]
  }
  useEffect(() => () => ref.current[1].close(), [])
  return ref.current
}

export function useSink(reader, cb) {
  const sunk = useRef(false)
  useEffect(() => {
    if (!sunk.current) {
      sunk.current = true
      reader.sink(cb)
    }
  }, [])
}

export function useChannel(chan = channel) {
  const ref = useRef(null)
  if (!ref.current) ref.current = chan()
  return ref.current
}

export function useBridgedWriter(target, bridge) {
  const [reader, writer] = useChannel()
  useSink(reader, { ...target, send: bridge(target) })
  return writer
}
