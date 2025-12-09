#!/usr/bin/env node

const [cmd, ...args] = process.argv.slice(2)

switch (cmd) {
  case 'daemon':
    await import('../src/daemon.js')
    break
  case 'get':
    const { get } = await import('../src/client.js')
    await get(args[0])
    break
  case 'put':
    const { put } = await import('../src/client.js')
    await put(args[0], args[1])
    break
  default:
    console.log(`Usage:
  bl daemon              Start the daemon
  bl get <uri>           Get a resource
  bl put <uri> <json>    Put a resource

Environment:
  BL_PORT   Daemon port (default: 9111)
  BL_DATA   Data directory (default: .bassline)`)
}
