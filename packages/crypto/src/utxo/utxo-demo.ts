import { createValidator } from './utxo-validator.js'
import { wallet } from '../helpers.js'

const log = (label: string, ...args: unknown[]) => console.log(`[${label}]`, ...args)

const node = (name: string) => createValidator(res => log(name, res))

const chain = node('official')

const alice = wallet(chain.store, chain.send)
const bob = wallet(chain.store, chain.send)
const carol = wallet(chain.store, chain.send)
const balances = () => [alice, bob, carol].map(w => w.balance(w.address))

log('coinbase', 'minting 100 to Alice')
const seeded = chain.coinbase([
  { value: 50, pubKeyHash: alice.address },
  { value: 50, pubKeyHash: alice.address },
])
log('coinbase', `minted ${seeded.length} UTXOs`)
log('balances', balances())

log('spend', 'Alice → 30 to Bob, 20 change')
alice.sendTx({
  inputs: [seeded[0]],
  outputs: [
    { value: 20, pubKeyHash: alice.address },
    { value: 30, pubKeyHash: bob.address },
  ],
})

await new Promise(r => setTimeout(r, 10))
log('balances', balances())

log('spend', 'Bob → 15 to Carol, 15 change')
bob.sendTx({
  inputs: [bob.forOwner()[0]],
  outputs: [
    { value: 15, pubKeyHash: carol.address },
    { value: 15, pubKeyHash: bob.address },
  ],
})

await new Promise(r => setTimeout(r, 10))
log('balances', balances())

log('spend', 'Alice tries to double-spend her first UTXO')
alice.sendTx({
  inputs: [seeded[0]],
  outputs: [{ value: 50, pubKeyHash: bob.address }],
})

await new Promise(r => setTimeout(r, 10))

log('spend', 'Alice tries to spend 50 but only output 10')
const aliceNow = alice.forOwner()
alice.sendTx({
  inputs: [aliceNow[0]],
  outputs: [{ value: 10, pubKeyHash: bob.address }],
})

await new Promise(r => setTimeout(r, 10))

log('spend', "Bob tries to spend Alice's UTXO")
bob.sendTx({
  inputs: [aliceNow[0]],
  outputs: [{ value: aliceNow[0].value, pubKeyHash: bob.address }],
})

await new Promise(r => setTimeout(r, 10))

log('final', `UTXO set size: ${chain.store.size}`)
log('final', balances())
log('final', 'all UTXOs:', chain.store.values())

chain.close()
