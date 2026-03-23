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
export const hashSpend = (inputs: string[], outputs: Output[]) =>
  sha256(enc.encode(JSON.stringify({ inputs, outputs })))

export const utxoId = (signature: string, output: Output, index: number) =>
  bytesToHex(sha256(enc.encode(signature + JSON.stringify(output) + index)))

export const sign = (hash: Uint8Array, privKey: Uint8Array) => bytesToHex(secp256k1.sign(hash, privKey))

export const verify = (sig: string, hash: Uint8Array, pubKey: string) =>
  secp256k1.verify(hexToBytes(sig), hash, hexToBytes(pubKey))

export const createSpend = (privKey: Uint8Array, pubKey: Uint8Array, inputs: string[], outputs: Output[]) => {
  const hash = hashSpend(inputs, outputs)
  return {
    inputs,
    outputs,
    signature: sign(hash, privKey),
    pubKey: bytesToHex(pubKey),
  }
}

export type UTXO = {
  id: string
  value: number
  pubKeyHash: string
}

export type Output = {
  value: number
  pubKeyHash: string
}

export type Spend = {
  inputs: string[]
  outputs: Output[]
  signature: string
  pubKey: string
}
export type ApplyResult = { minted: UTXO[]; spend: Spend } | { err: string; spend: Spend }
