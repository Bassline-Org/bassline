#!/usr/bin/env node
//
// Mount Ethereum mainnet as a filesystem.
//
// Usage:
//   RPC_URL=https://... node examples/mount-mainnet.js [mountpoint]
//
import { Platform, reducers, scope } from '@bassline/core'
import fuse from '@bassline/core/platforms/fuse'
import ethModule from '../src/index.js'

const RPC_URL = process.env.RPC_URL
if (!RPC_URL) {
  console.error('RPC_URL environment variable required')
  console.error('Usage: RPC_URL=https://... node examples/mount-mainnet.js [mountpoint]')
  process.exit(1)
}

const mountpoint = process.argv[2] ?? `${process.env.HOME}/mnt`

const p = new Platform()
p.use(reducers, scope, fuse)
const eth = ethModule(p)
eth.setUrl(RPC_URL)

const instance = await p.fuse.mount({ mountpoint })

console.log(`Ethereum mainnet mounted at ${mountpoint}`)
console.log('')
console.log(`  ls ${mountpoint}`)
console.log(`  cat ${mountpoint}/block-number`)
console.log(`  cat ${mountpoint}/chain-id`)
console.log(`  cat ${mountpoint}/gas-price`)
console.log(`  cat ${mountpoint}/blocks/latest/.json`)
console.log(`  cat ${mountpoint}/blocks/latest/hash`)
console.log(`  ls  ${mountpoint}/blocks/latest/`)
console.log(`  echo 'latest' > ${mountpoint}/blocks/ctl`)
console.log(`  echo '0xaddr' > ${mountpoint}/accounts/ctl`)
console.log('')
console.log('Ctrl+C to unmount')

process.on('SIGINT', async () => {
  console.log('\nUnmounting...')
  await instance.unmount()
  process.exit(0)
})
