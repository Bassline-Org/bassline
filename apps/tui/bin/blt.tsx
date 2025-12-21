#!/usr/bin/env node
import React from 'react'
import { withFullScreen } from 'fullscreen-ink'
import { parseArgs } from 'util'
import App from '../src/App.js'
import { createBlit } from '../src/blit-loader.js'

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    create: { type: 'boolean', short: 'c', description: 'Create a new blit file' },
    help: { type: 'boolean', short: 'h', description: 'Show help' },
  },
})

if (values.help) {
  console.log(`
blt - Bassline Terminal

Usage:
  blt [options] [path]

Options:
  -c, --create    Create a new blit file at the given path
  -h, --help      Show this help

Examples:
  blt                      Open blit picker
  blt my.blit              Open existing blit
  blt -c new.blit          Create and open new blit
`)
  process.exit(0)
}

const blitPath = positionals[0]

// If --create flag and path provided, create the blit first
if (values.create && blitPath) {
  try {
    const blit = await createBlit(blitPath)
    blit.close()
    console.log(`Created: ${blitPath}`)
  } catch (err: unknown) {
    console.error(`Error creating blit: ${(err as Error).message}`)
    process.exit(1)
  }
}

withFullScreen(<App blitPath={blitPath} />).start()
