import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex } from '@noble/hashes/utils.js'
import { Output, enc, Spend, UTXO, utxoId, ValidationResult, InvalidTx } from './helpers.js'
import { Send } from '@bassline/core'
import isValid from './validation.js'
import { utxoish } from './utxoish.js'

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

export function createValidator(sendResults?: Send<ValidationResult>) {
  const utxos = new Map<string, UTXO>()

  const validate = (spend: Spend): ValidationResult => {
    try {
      const spending = isValid.inputs(spend, utxos)
      isValid.spender(spend, spending)
      isValid.balances(spend, spending)
      const minting = spend.outputs.map((out, i) => {
        const id = utxoId(spend.signature, out, i)
        return { id, value: out.value, pubKeyHash: out.pubKeyHash } satisfies UTXO
      })
      return { status: 'ok', spending, minting, spend } as const
    } catch (e) {
      if (e instanceof InvalidTx) return { status: 'err', error: e.message, spend } as const
      throw e
    }
  }

  const finalize = (result: ValidationResult) => {
    if (result.status === 'ok') {
      const { spending, minting } = result
      for (const spend of spending) utxos.delete(spend.id)
      for (const mint of minting) utxos.set(mint.id, mint)
    }
    sendResults?.(result)
  }

  const coinbase = (outputs: Output[]): UTXO[] => {
    const entropy = bytesToHex(sha256(enc.encode(crypto.randomUUID())))
    const minted: UTXO[] = []
    for (let i = 0; i < outputs.length; i++) {
      const out = outputs[i]
      isValid.balance(out)
      const id = bytesToHex(sha256(enc.encode(entropy + JSON.stringify(out) + i)))
      const utxo = { id, value: out.value, pubKeyHash: out.pubKeyHash } satisfies UTXO
      utxos.set(id, utxo)
      minted.push(utxo)
    }
    return minted
  }

  const { send, close, task } = utxoish({ validate, finalize })

  return {
    send,
    close,
    task,
    coinbase,
    store: utxos,
  } as const
}
