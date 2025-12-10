import { Bassline, createLinkIndex, createPlumber } from '@bassline/core'
import { createFileStore } from '@bassline/store-node'
import { createHttpServerRoutes, createWsServerRoutes } from '@bassline/server-node'
import { createCellRoutes } from '@bassline/cells'
import { createPropagatorRoutes } from '@bassline/propagators'

const DATA_DIR = process.env.BL_DATA || '.bassline'
const HTTP_PORT = parseInt(process.env.BL_HTTP_PORT || process.env.BL_PORT || '9111')
const WS_PORT = parseInt(process.env.BL_WS_PORT || '9112')

const bl = new Bassline()
const links = createLinkIndex()
const plumber = createPlumber()

// Install core features
links.install(bl)
plumber.install(bl)

// Create propagators first (need reference for cell callback)
const propagators = createPropagatorRoutes({ bl })

// Create cells with callback that fires propagators
const cells = createCellRoutes({
  onCellChange: ({ uri }) => {
    propagators.onCellChange(uri)
  }
})

cells.install(bl)
propagators.install(bl)

// Wire up plumber: cell changes → propagators
// Add rule to route cell-value changes to propagators port
plumber.addRule('cell-to-propagators', {
  match: { headers: { type: 'bl:///types/cell-value', changed: true } },
  port: 'cell-changes'
})

// Propagators listen on the cell-changes port
plumber.listen('cell-changes', (msg) => {
  // Extract cell URI from the message URI (remove /value suffix)
  const cellUri = msg.uri.replace(/\/value$/, '')
  propagators.onCellChange(cellUri)
})

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
