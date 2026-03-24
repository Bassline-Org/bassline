/**
 * The clave (pronounced clah-vay) in music is a rhythmic pattern used as a tool for temporal organization in Cuban music.
 * A clave in Bassline is a local tool for capability organization.
 * It mints signed tokens, validates transactions via pluggable rules, and tracks token state.
 */

import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex } from '@noble/hashes/utils.js'
import type { Message, Send } from '@bassline/core'
import { utxoish } from '../utxo/utxoish.js'
import { generateKeyPair, pubKeyHash, sign, enc, KeyPair } from '../helpers.js'

class InvalidTx extends Error {}
const invalid = (error: string) => new InvalidTx(error)

const valid = {}

export function createClave({
  kp = generateKeyPair(),
  tokens = new Map(),
  rules = new Map(),
  trace = () => {},
}: ClaveOptions = {}) {
  const address = pubKeyHash(kp.pubKey)

  const hash = (s: string) => bytesToHex(sha256(enc.encode(s)))
  const signFields = (id: string, type: string, data: unknown) =>
    sign(sha256(enc.encode(JSON.stringify({ id, type, data }))), kp.privKey)

  function mint(type: string, data: unknown, origin = 'coinbase'): Token {
    const id = crypto.randomUUID()
    const token = {
      id,
      type,
      data,
      origin,
      issuer: address,
      sig: signFields(id, type, data),
    } satisfies Token
    tokens.set(id, token)
    trace?.({ type: 'clave.mint', token })
    return token
  }

  function register(type: string, rule: Rule) {
    rules.set(type, rule)
    trace?.({ type: 'clave.register', rule: type })
  }
  const allTokensLive = (tx: Tx) => {
    for (const { id } of tx.tokens) {
      if (!tokens.has(id)) throw invalid(`token ${id.slice(0, 8)}… not live`)
    }
  }
  const knownTxType = (tx: Tx) => {
    const rule = rules.get(tx.type)
    if (!rule) throw invalid(`unknown tx type: ${tx.type}`)
    return rule!
  }
  const validate = (tx: Tx): TxResult => {
    try {
      allTokensLive(tx)
      const rule = knownTxType(tx)
      const result = rule(tx, id => tokens.get(id))
      if (result.status === 'err') throw invalid(result.error)

      const txId = hash(JSON.stringify(tx))
      const minted = result.produce.map(out => mint(out.type, out.data, txId))
      return { status: 'ok', consumed: result.consume, minted, tx, txId }
    } catch (e) {
      if (e instanceof InvalidTx) return { status: 'err', error: e.message, tx }
      throw e
    }
  }

  const finalize = (result: TxResult) => {
    if (result.status === 'ok') {
      for (const token of result.consumed) tokens.delete(token.id)
      for (const token of result.minted) tokens.set(token.id, token)
    }
    trace?.({ type: 'clave.tx', result })
  }

  const { send, close, task } = utxoish<Tx, TxResult>({ validate, finalize })

  return { send, close, task, mint, register, address, tokens } as const
}

export const ruleOk = (consume: RuleOk['consume'] = [], produce: RuleOk['produce'] = []): RuleOk => ({
  status: 'ok',
  consume,
  produce,
})
export const ruleErr = (error: string): RuleErr => ({ status: 'err', error })

export type Token = {
  id: string
  type: string
  data: unknown
  issuer: string
  sig: string
  origin: string
}

export type Tx = {
  type: string
  tokens: Token[]
  [key: string]: unknown
}

type RuleOk = { status: 'ok'; consume: Token[]; produce: Pick<Token, 'type' | 'data'>[] }
type RuleErr = { status: 'err'; error: string }
type RuleResult = RuleOk | RuleErr

export type Rule = (tx: Tx, get: (id: string) => Token | undefined) => RuleResult
export type TxResult =
  | { status: 'ok'; consumed: Token[]; minted: Token[]; tx: Tx; txId: string }
  | { status: 'err'; error: string; tx: Tx }

type ClaveTrace = Message<{ type: 'clave.tx'; result: TxResult }> | Message<{ type: string }>
type ClaveOptions = {
  kp?: KeyPair
  tokens?: Map<string, Token>
  rules?: Map<string, Rule>
  trace?: Send<ClaveTrace>
}
