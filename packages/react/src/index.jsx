import { createContext, useContext, useState, useEffect, useRef } from 'react'

const NetContext = createContext(null)

export function Net({ net, children }) {
  return <NetContext.Provider value={net}>{children}</NetContext.Provider>
}

export function useNet() {
  return useContext(NetContext)
}

export function useJoin(net, cb = r => r) {
  const ref = useRef(null)
  if (!ref.current) ref.current = net.join(cb)
  useEffect(() => () => ref.current[1].close(), [])
  return ref.current
}

export function useSink(reader, seed) {
  const [state, setState] = useState(seed)
  const sunk = useRef(false)
  useEffect(() => {
    if (!sunk.current) {
      sunk.current = true
      reader.sink(v => setState(v))
    }
  }, [])
  return state
}
