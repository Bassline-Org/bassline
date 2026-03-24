import { Send } from '@bassline/core'
import { secp256k1 } from '@noble/curves/secp256k1.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js'

export const enc = new TextEncoder()

export const generateKeyPair = () => {
  const privKey = secp256k1.utils.randomSecretKey()
  const pubKey = secp256k1.getPublicKey(privKey)
  return { privKey, pubKey } as const
}
export const pubKeyHash = (pubKey: Uint8Array) => bytesToHex(sha256(pubKey))

export const hashSpend = (inputs: UTXO[], outputs: Coin[]) => {
  return sha256(enc.encode(JSON.stringify({ inputs, outputs })))
}

export const coinId = (signature: string, output: Coin, index: number) =>
  bytesToHex(sha256(enc.encode(signature + JSON.stringify(output) + index)))

export const sign = (hash: Uint8Array, privKey: Uint8Array) => bytesToHex(secp256k1.sign(hash, privKey))

export const verify = (sig: string, hash: Uint8Array, pubKey: string) =>
  secp256k1.verify(hexToBytes(sig), hash, hexToBytes(pubKey))

export const createSpend = (privKey: Uint8Array, pubKey: Uint8Array, inputs: UTXO[], outputs: Coin[]) => {
  const hash = hashSpend(inputs, outputs)
  return {
    inputs,
    outputs,
    signature: sign(hash, privKey),
    pubKey: bytesToHex(pubKey),
  }
}

export function wallet(store: Map<string, UTXO>, sendTx?: Send<Spend>, kp = generateKeyPair()) {
  const address = pubKeyHash(kp.pubKey)
  const w = {
    address,
    get: (id: string) => store.get(id),
    has: (id: string) => store.has(id),
    forOwner: (pkh = address) => [...store.values()].filter(u => u.pubKeyHash === pkh),
    balance: (pkh = address) => w.forOwner(pkh).reduce((s, i) => s + i.value, 0),
    get size() {
      return store.size
    },
    all: () => [...store.values()],
    sendTx: (spend: Unsigned<Spend>, target = sendTx) => {
      const signed = createSpend(kp.privKey, kp.pubKey, spend.inputs, spend.outputs)
      if (target) {
        target(signed)
      } else {
        console.warn('failed to spend, not connected')
      }
    },
  } as const
  return w
}

export class InvalidTx extends Error {}
export const invalid = (msg: string) => new InvalidTx(msg)

export type KeyPair = {
  privkey: Uint8Array<ArrayBufferLike>
  pubkey: Uint8Array<ArrayBufferLike>
}
export type Coin = {
  value: number
  pubKeyHash: string
}
export type UTXO = Coin & { id: string }
export type Unsigned<T> = Omit<T, 'signature' | 'pubKey'>
export type Signed = { signature: string; pubKey: string }
export type Spend = Signed & {
  inputs: UTXO[]
  outputs: Coin[]
}
export type ValidationResult =
  | { status: 'ok'; spending: UTXO[]; minting: UTXO[]; spend: Spend }
  | { status: 'err'; error: string; spend: Spend }
export type ApplyResult = Accepted | Err
type Accepted = { spent: UTXO[]; minted: UTXO[]; spend: Spend }
type Err = { err: string; spend: Spend }
