import { createController } from '@bassline/core'
import { connect } from '@bassline/core/transports/socket'
import { multi } from './mm.js'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

export function factotum({ save, load }) {
  const { ctl, close } = createController()
  const live = {}
  const cache = load?.() ?? {}
  const materialize = multi(msg => msg.kind)

  const fac = { ctl, close, live, cache, materialize, store, install }

  function store(m) {
    const msg = { ...m, id: m.id ?? crypto.randomUUID() }
    cache[msg.id] = msg
    return msg
  }

  function install(modules) {
    return modules.map(mod => mod(fac))
  }

  ctl.onClose(() => {
    Object.values(live).forEach(e => e.close())
    save?.(cache)
  })

  install([sync, modules, connectors])

  return fac
}

function sync({ cache, live, materialize }) {
  materialize.method('factotum:update', msg => {
    for (const [key, value] of Object.entries(msg.cache)) {
      cache[key] = value
    }
  })
  materialize.method('connect:id', msg => {
    const instance = live[msg.id]
    if (!instance) {
      const cached = cache[msg.id]
      if (msg === cached) return
      return materialize(cached)
    }
    return instance
  })
}

function modules({ live, store, materialize }) {
  materialize.method('module:load', async m => {
    const msg = store(m)
    const mod = await import(msg.path)
    live[msg.id] = mod
    console.log('loaded: ', mod)
    return mod
  })
}

function connectors({ live, materialize, store }) {
  materialize.method('connect:socket', msg => {
    const { path, host, port, id } = store(msg)
    let conn
    if (path) {
      conn = connect({ path })
    } else {
      conn = connect({ host, port })
    }
    live[id] = conn
    conn.ctl.onClose(() => {
      delete live[id]
    })
    return conn
  })
}

export function persistFile(path) {
  const save = cache => writeFileSync(path, JSON.stringify(cache))
  const load = () => {
    if (existsSync(path)) {
      return JSON.parse(readFileSync(path))
    }
    return {}
  }
  return { save, load }
}
