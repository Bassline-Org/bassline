import { Bassline, createLinkIndex, createPlumber } from '@bassline/core'
import { createFileStore } from '@bassline/store-node'
import { createHttpServerRoutes, createWsServerRoutes } from '@bassline/server-node'

const DATA_DIR = process.env.BL_DATA || '.bassline'
const HTTP_PORT = parseInt(process.env.BL_HTTP_PORT || process.env.BL_PORT || '9111')
const WS_PORT = parseInt(process.env.BL_WS_PORT || '9112')

const bl = new Bassline()
const links = createLinkIndex()
const plumber = createPlumber()

// Install core features
links.install(bl)
plumber.install(bl)

// Install file store - handles /data/:path*
bl.install(createFileStore(DATA_DIR, '/data'))

// Install server capabilities
bl.install(createHttpServerRoutes())
bl.install(createWsServerRoutes(plumber))

// Bootstrap: start servers via resources
await bl.put(`bl:///server/http/${HTTP_PORT}`, {}, {})
await bl.put(`bl:///server/ws/${WS_PORT}`, {}, {})

console.log('Bassline daemon running')
console.log(`  Data:  ${DATA_DIR}`)
console.log(`  HTTP:  http://localhost:${HTTP_PORT}`)
console.log(`  WS:    ws://localhost:${WS_PORT}`)
console.log(`\nResources:`)
console.log(`  GET  http://localhost:${HTTP_PORT}?uri=bl:///data`)
console.log(`  GET  http://localhost:${HTTP_PORT}?uri=bl:///server`)
console.log(`  GET  http://localhost:${HTTP_PORT}?uri=bl:///plumb/rules`)
