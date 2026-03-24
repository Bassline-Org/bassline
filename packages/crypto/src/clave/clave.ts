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

class InvalidTx extends Error {
  static reason(error: string) {
    return new InvalidTx(error)
  }
}

export function createClave(opts: ClaveOptions = {}) {
  const kp = opts.kp ?? generateKeyPair()
  const trace = opts.trace ?? (() => {})
  const hash = (s: string) => bytesToHex(sha256(enc.encode(s)))
  const address = pubKeyHash(kp.pubKey)
  const signFields = (id: string, type: string, data: unknown) =>
    sign(sha256(enc.encode(JSON.stringify({ id, type, data }))), kp.privKey)

  const tokens = {
    store: opts.tokens ?? new Map<string, Token>(),

    create(type: string, data: unknown, origin = 'coinbase') {
      const id = crypto.randomUUID()
      return {
        id,
        type,
        data,
        origin,
        issuer: address,
        sig: signFields(id, type, data),
      } satisfies Token
    },
    burn(token: Token) {
      tokens.store.delete(token.id)
      trace({ type: 'clave.token.burn', token })
    },
    mint<T = unknown>(token: Token & T) {
      tokens.store.set(token.id, token)
      trace({ type: 'clave.token.mint', token })
    },

    assertLive(tx: Tx) {
      for (const { id } of tx.tokens) {
        if (!tokens.store.has(id)) throw InvalidTx.reason(`token ${id.slice(0, 8)}… not live`)
      }
    },
  }

  const rules = {
    store: opts.rules ?? new Map<string, Rule>(),

    register(type: string, rule: Rule) {
      rules.store.set(type, rule)
      trace?.({ type: 'clave.rule.register', rule: type })
    },
    revoke(type: string) {
      rules.store.delete(type)
      trace?.({ type: 'clave.rule.revoke', rule: type })
    },

    assertKnown(tx: Tx) {
      const rule = rules.store.get(tx.type)
      if (!rule) throw InvalidTx.reason(`unknown tx type: ${tx.type}`)
      return rule!
    },
  }

  function validate(tx: Tx) {
    try {
      tokens.assertLive(tx)
      const rule = rules.assertKnown(tx)
      const result = rule(tx, id => tokens.store.get(id))
      if (result.status === 'err') throw InvalidTx.reason(result.error)

      const txId = hash(JSON.stringify(tx))
      const minted = result.produce.map(out => tokens.create(out.type, out.data, txId))
      return { status: 'ok', consumed: result.consume, minted, tx, txId } satisfies TxResult
    } catch (e) {
      if (e instanceof InvalidTx) return { status: 'err', error: e.message, tx } satisfies TxResult
      throw e
    }
  }

  const finalize = (result: TxResult) => {
    if (result.status === 'ok') {
      for (const t of result.consumed) tokens.burn(t)
      for (const t of result.minted) tokens.mint(t)
    }
    trace?.({ type: 'clave.tx.result', result })
  }

  const { send, close, task } = utxoish<Tx, TxResult>({ validate, finalize })

  return { send, close, task, address, rules, tokens } as const
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

type Trace<S extends string, T> = { type: `clave.${S}` } & T
type ClaveTrace =
  | Trace<'tx.result', { result: TxResult }>
  | Trace<'token.mint', { token: Token }>
  | Trace<'token.burn', { token: Token }>
  | Trace<'rule.register', { rule: string }>
  | Trace<'rule.revoke', { rule: string }>

type ClaveOptions = {
  kp?: KeyPair
  tokens?: Map<string, Token>
  rules?: Map<string, Rule>
  trace?: Send<ClaveTrace>
}
