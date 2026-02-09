import { resource } from './core.js'

const normalizeSelector = (sel) => {
  if (typeof sel !== 'string') throw new TypeError(`selector must be a string, got ${typeof sel}`)
  return sel === '' ? '' : sel.split(':').filter(Boolean).sort().map(k => k + ':').join('')
}

export const selector = (msg) => normalizeSelector(
  Object.keys(msg).map(k => k + ':').join('')
)

export const coreSpec = {
  name: '@bassline/core',
  version: '1.0.0',
  protocols: {
    Slot: {
      get: [''],
      put: [''],
    },
    Slots: {
      get: ['at:', 'at:ifAbsentPut:'],
      put: ['at:'],
    },
    Watchable: {
      extends: ['Slot'],
      get: ['watch:', 'unwatch:'],
    },
  },
}

export const spec = (data) =>
  resource({
    data,
    get(msg) {
      if (msg.protocol) return this.resolveProtocol(msg.protocol)
      if (msg.protocols) return this.data.protocols ?? {}
      if (msg.version) return this.data.version
      if (msg.name) return this.data.name
      return this.data
    },
    resolveProtocol(name, visited) {
      if (visited?.has(name)) return undefined
      const proto = this.data.protocols?.[name]
      if (!proto) return undefined
      const seen = visited ?? new Set()
      seen.add(name)
      let get = [], put = []
      for (const ext of proto.extends ?? []) {
        const parent = this.resolveProtocol(ext, seen)
        if (parent) {
          get = [...get, ...parent.get]
          put = [...put, ...parent.put]
        }
      }
      get = [...new Set([...get, ...(proto.get ?? [])].map(normalizeSelector))]
      put = [...new Set([...put, ...(proto.put ?? [])].map(normalizeSelector))]
      const { extends: _, ...rest } = proto
      return { ...rest, get, put }
    },
  })

export const conforms = (message, protocolName, specResource) => {
  const proto = specResource({ protocol: protocolName })
  if (!proto) return { ok: false, error: 'unknown protocol' }

  if ('put' in message) {
    const { put: _, ...rest } = message
    const sel = selector(rest)
    if (proto.put.includes(sel))
      return { ok: true, selector: sel, dispatch: 'put' }
  } else {
    const sel = selector(message)
    if (proto.get.includes(sel))
      return { ok: true, selector: sel, dispatch: 'get' }
  }
  return { ok: false, error: 'no matching selector' }
}
