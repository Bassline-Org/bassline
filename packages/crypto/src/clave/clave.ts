/**
 * The clave (pronounced clah-vay) in music is a rhythmic pattern used as a tool for temporal organization in Cuban music.
 * A clave in Bassline is a participant that contributes local authority
 * Allowing for local authority to be expressed and validated
 */

import { Message } from '@bassline/core'
import { enc, generateKeyPair, bytesToHex, sign, verify } from '../helpers.js'

export type Signed<T = unknown> = Message<{ type: 'clave.attestation'; sig: string; pubKey: string; msg: Message<T> }>

export type Clave = {
  pubKey: string
  attest<T>(msg: Message<T>): Signed<T>
  verifyOwn<T>(attestation: Signed<T>): boolean
}

const encode = (msg: unknown) => enc.encode(JSON.stringify(msg))

export function createClave(kp = generateKeyPair()) {
  const pubKey = bytesToHex(kp.pubKey)

  function attest<T>(msg: Message<T>) {
    return {
      type: 'clave.attestation',
      sig: sign(encode(msg), kp.privKey),
      pubKey,
      msg,
    } satisfies Signed<T>
  }
  const verifyOwn = <T>(attestation: Signed<T>) => verifyAttestation(attestation, pubKey)

  return { attest, pubKey, verifyOwn } satisfies Clave
}

export function verifyAttestation<T>(attestation: Signed<T>, pubKey: string) {
  return attestation.pubKey === pubKey && verify(attestation.sig, encode(attestation.msg), pubKey)
}
