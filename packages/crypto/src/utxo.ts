import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js'
import { port, consume } from '@bassline/core'
import type { Send, Recv } from '@bassline/core'
import {
  ApplyResult,
  createSpend,
  generateKeyPair,
  hashSpend,
  Output,
  pubKeyHash,
  enc,
  Spend,
  UTXO,
  utxoId,
  verify,
} from './helpers.js'

/**
 * In this file, we implement a proof of concept of UTXO accounting using bassline
 *
 * UTXO models transactions structures of:
 * - public key hash (who can spend)
 * - a balance (how much it's worth)
 * - the signature of the spend that produced it
 *   OR a unique random id if it comes from the coinbase (such as a block hash, but we don't use blocks)
 *
 * With UTXO the "current state" of the blockchain as the set of unspent outputs
 * A users balance is then the sum of all utxos that reference a users pubkeyhash
 *
 * When sending a spend we must provide:
 * - inputs (the list of utxos we are spending)
 * - outputs (the list of utxos we are minting)
 *
 * When spending one must ensure the total balance of the inputs must equal the total balance of the outputs, otherwise it is invalid
 * Or in other words, input sum & output sum must be balanced, otherwise it's an invalid tx
 *
 * When a UTXO is used as an input, it is then spent, and tombstoned, invalidating any future tx that tries to spend it
 *
 * In addition to this operational data, UTXO requires an authentication mechanism, this can be done using normal crypto key nonsense
 * When someone submits a spend, they must sign the inputs & outputs of the spend to produce a signature.
 * This is included alongside the inputs & outputs for the tx, allowing validators to ensure the person spending "owns" the coins.
 *
 * This implementation is intentionally dumb, and only validates balances similar to bitcoin.
 * However this implementation could be trivially specialized to support arbitrary execution logic for coin spends or a custom VM set.
 * Chia (shoutout bram cohen) is a good reference on how the UTXO model can be extended.
 */

class InvalidTx extends Error {}
const invalid = (msg: string) => new InvalidTx(msg)
function createUtxoSet() {
  const utxos = new Map<string, UTXO>()

  const ensureValidBalance = (spend: Output) => {
    const { value } = spend
    if (value < 0) throw invalid('negative balance')
    if (!Number.isInteger(value)) throw invalid('not an integer')
    return spend
  }

  const ensureInputs = (spend: Spend) => {
    const seen = new Set()
    const valid: UTXO[] = []
    for (const id of spend.inputs) {
      if (seen.has(id)) throw invalid('duplicate input id!')
      else seen.add(id)

      const utxo = utxos.get(id)

      if (!utxo) throw invalid(`input: [${id}] not found`)
      else valid.push(utxo!)
    }
    return valid
  }

  const ensureOwnership = (spend: Spend, inputUtxos: UTXO[]) => {
    const signerHash = pubKeyHash(hexToBytes(spend.pubKey))
    for (const u of inputUtxos)
      if (u.pubKeyHash !== signerHash) throw invalid(`input ${u.id.slice(0, 8)}… not owned by signer`)
  }

  const ensureBalanced = (spend: Spend, inputUtxos: UTXO[]) => {
    const sum = (s: number, u: Output) => {
      ensureValidBalance(u)
      return s + u.value
    }
    const inSum = inputUtxos.reduce(sum, 0)
    const outSum = spend.outputs.reduce(sum, 0)
    if (inSum !== outSum) throw invalid(`input sum ${inSum} ≠ output sum ${outSum}`)
  }

  const ensureSignature = (spend: Spend) => {
    const hash = hashSpend(spend.inputs, spend.outputs)
    const valid = verify(spend.signature, hash, spend.pubKey)
    if (!valid) throw invalid('invalid signature')
  }

  const prepareMints = (spend: Spend) =>
    spend.outputs.map((out, i) => {
      const id = utxoId(spend.signature, out, i)
      return { id, value: out.value, pubKeyHash: out.pubKeyHash } satisfies UTXO
    })

  function apply(spend: Spend): ApplyResult {
    try {
      const inputUtxos = ensureInputs(spend)
      ensureOwnership(spend, inputUtxos)
      ensureBalanced(spend, inputUtxos)
      ensureSignature(spend)
      const minted = prepareMints(spend)
      for (const id of spend.inputs) utxos.delete(id)
      for (const utxo of minted) utxos.set(utxo.id, utxo)
      return { minted, spend }
    } catch (e) {
      if (e instanceof InvalidTx) return { err: e.message, spend }
      else throw e
    }
  }

  function coinbase(outputs: Output[]): string[] {
    const entropy = bytesToHex(sha256(enc.encode(crypto.randomUUID())))
    const minted: string[] = []
    for (let i = 0; i < outputs.length; i++) {
      const out = outputs[i]
      ensureValidBalance(out)
      const id = bytesToHex(sha256(enc.encode(entropy + JSON.stringify(out) + i)))
      utxos.set(id, { id, value: out.value, pubKeyHash: out.pubKeyHash })
      minted.push(id)
    }
    return minted
  }

  return {
    apply,
    coinbase,
    get: (id: string) => utxos.get(id),
    has: (id: string) => utxos.has(id),
    balance: (pkh: string) => {
      let sum = 0
      for (const u of utxos.values()) if (u.pubKeyHash === pkh) sum += u.value
      return sum
    },
    forOwner: (pkh: string) => [...utxos.values()].filter(u => u.pubKeyHash === pkh),
    get size() {
      return utxos.size
    },
    all: () => [...utxos.values()],
  }
}

// ============ Spend builder ============

function utxoValidator(recv: Recv<Spend>, send: Send<ApplyResult>) {
  const set = createUtxoSet()
  consume(recv, spend => {
    send(set.apply(spend))
  })
  return set
}

const log = (label: string, ...args: unknown[]) => console.log(`[${label}]`, ...args)
const balances = (set: ReturnType<typeof createUtxoSet>, actors: Record<string, string>) =>
  Object.fromEntries(Object.entries(actors).map(([name, pkh]) => [name, set.balance(pkh)]))

const alice = generateKeyPair()
const bob = generateKeyPair()
const carol = generateKeyPair()

const aliceHash = pubKeyHash(alice.pubKey)
const bobHash = pubKeyHash(bob.pubKey)
const carolHash = pubKeyHash(carol.pubKey)

const actors = { alice: aliceHash, bob: bobHash, carol: carolHash }

// Wire up: port for spends, validator consumes them
const { send, recv, close } = port<Spend>()
const results = port<ApplyResult>()
const set = utxoValidator(recv, results.send)

// Collect results
const resultLog: ApplyResult[] = []
consume(results.recv, r => {
  resultLog.push(r)
})

// 1. Coinbase: seed Alice with 100
log('coinbase', 'minting 100 to Alice')
const seeded = set.coinbase([
  { value: 50, pubKeyHash: aliceHash },
  { value: 50, pubKeyHash: aliceHash },
])
log('coinbase', `minted ${seeded.length} UTXOs`)
log('balances', balances(set, actors))

// 2. Alice sends 30 to Bob, 20 back to herself (from first UTXO)
log('spend', 'Alice → 30 to Bob, 20 change')
const aliceUtxos = set.forOwner(aliceHash)
send(
  createSpend(
    alice.privKey,
    alice.pubKey,
    [aliceUtxos[0].id],
    [
      { value: 30, pubKeyHash: bobHash },
      { value: 20, pubKeyHash: aliceHash },
    ]
  )
)

await new Promise(r => setTimeout(r, 50))
log('result', resultLog.at(-1))
log('balances', balances(set, actors))

// 3. Bob sends 15 to Carol, 15 back to himself
log('spend', 'Bob → 15 to Carol, 15 change')
const bobUtxos = set.forOwner(bobHash)
send(
  createSpend(
    bob.privKey,
    bob.pubKey,
    [bobUtxos[0].id],
    [
      { value: 15, pubKeyHash: carolHash },
      { value: 15, pubKeyHash: bobHash },
    ]
  )
)

await new Promise(r => setTimeout(r, 50))
log('result', resultLog.at(-1))
log('balances', balances(set, actors))

// 4. Alice tries to double-spend the UTXO she already spent
log('spend', 'Alice tries to double-spend her first UTXO')
send(createSpend(alice.privKey, alice.pubKey, [seeded[0]], [{ value: 50, pubKeyHash: aliceHash }]))

await new Promise(r => setTimeout(r, 50))
log('result', resultLog.at(-1))

// 5. Values don't balance
log('spend', 'Alice tries to spend 50 but only output 10')
const aliceNow = set.forOwner(aliceHash)
send(createSpend(alice.privKey, alice.pubKey, [aliceNow[0].id], [{ value: 10, pubKeyHash: bobHash }]))

await new Promise(r => setTimeout(r, 50))
log('result', resultLog.at(-1))

// 6. Bob tries to spend Alice's UTXO
log('spend', "Bob tries to spend Alice's UTXO")
send(createSpend(bob.privKey, bob.pubKey, [aliceNow[0].id], [{ value: aliceNow[0].value, pubKeyHash: bobHash }]))

await new Promise(r => setTimeout(r, 50))
log('result', resultLog.at(-1))

// Final state
log('final', `UTXO set size: ${set.size}`)
log('final', balances(set, actors))
log(
  'final',
  'all UTXOs:',
  set.all().map(u => ({
    id: u.id.slice(0, 8) + '…',
    value: u.value,
    owner: Object.entries(actors).find(([, h]) => h === u.pubKeyHash)?.[0] ?? 'unknown',
  }))
)

close()
results.close()

export type { UTXO, Output, Spend, ApplyResult }
export { generateKeyPair, pubKeyHash, createUtxoSet, createSpend, utxoValidator }
