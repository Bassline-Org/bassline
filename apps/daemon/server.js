#!/usr/bin/env node
import { createDaemonProps } from './daemon.js'
import { withReply } from './lib.js'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { consume } from '@bassline/core'
import { serve } from '@bassline/core/serve/tcp'

// ./server.js <path> <socket>
const [_, __, path, socket] = process.argv,
  raw = JSON.parse(readFileSync(path, 'utf8')),
  mod = await import(resolve(raw.types)),
  config = { name: raw.name, types: mod.default }

const [bus, _graph] = createDaemonProps(config)

const { connections, close } = serve({ path: socket })

consume(connections, conn => {
  consume(conn.recv, msg => {
    bus.send(withReply(msg, conn.send))
  })
})

process.on('SIGINT', close)
process.on('SIGTERM', close)
