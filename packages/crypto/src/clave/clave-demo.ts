import { port, hasKeys, isString } from '@bassline/core'
import { createClave, Rule, Tx, ruleOk, ruleErr } from './clave.js'
import { claveClient } from './clave-client.js'

const log = (label: string, ...args: unknown[]) => console.log(`[${label}]`, ...args)
const pretty = (v: unknown) => JSON.stringify(v, null, 2)

type Grant = Tx & { recipient: string; capability: string }
function isGrant(tx: unknown): tx is Grant {
  return hasKeys(tx, ['recipient', 'capability']) && isString(tx.capability) && isString(tx.recipient)
}
const grantRule: Rule = tx => {
  if (!isGrant) return ruleErr('grant requires recipient and capability')
  const { recipient, capability } = tx
  return ruleOk([], [{ type: 'capability', data: { recipient, capability } }])
}

type Use = Tx & { action: string }
type Cap = Tx & { type: 'capability'; data: { capability: string } }
function isCapability(tx: unknown): tx is Cap {
  return (
    hasKeys(tx, ['data', 'type']) &&
    tx.type === 'capability' &&
    hasKeys(tx.data, ['capability']) &&
    isString(tx.data.capability)
  )
}

const useRule: Rule = tx => {
  const { action } = tx
  if (!action) return ruleErr('use requires action')
  const cap = tx.tokens.find(t => isCapability(t))
  if (!cap) return ruleErr('no capability token')
  if (cap.data.capability !== action) return ruleErr(`capability mismatch`)
  return ruleOk([cap], [{ type: 'receipt', data: { action, consumed: cap.id } }])
}

const results = port()

const clave = createClave({
  trace: msg => {
    log('trace', msg.type, msg.result)
    if (msg.type === 'clave.tx') results.send(msg.result)
  },
})

clave.register('grant', grantRule)
clave.register('use', useRule)

const client = claveClient({ port: { send: clave.send, recv: results.recv, close: results.close } })

const seed = clave.mint('seed', { purpose: 'genesis' })
log('mint', `seed: ${seed.id.slice(0, 12)}…`)

log('tx', 'granting "deploy" to alice')
const grant = await client.transact({ type: 'grant', tokens: [], recipient: 'alice', capability: 'deploy' })
log('result', grant.status)

const cap = grant.status === 'ok' ? grant.minted[0] : null
if (!cap) throw new Error('grant failed')
log('minted', `capability: ${cap.id.slice(0, 12)}… → ${pretty(cap.data)}`)

log('tx', 'using "deploy" capability')
const use = await client.transact({ type: 'use', tokens: [cap], action: 'deploy' })
log('result', use.status, use.status === 'ok' ? `receipt: ${use.minted[0].id.slice(0, 12)}…` : '')

log('tx', 'reusing consumed capability')
const reuse = await client.transact({ type: 'use', tokens: [cap], action: 'deploy' })
log('result', reuse.status, reuse.status === 'err' ? reuse.error : '')

log('final', `tokens: ${clave.tokens.size}`)
for (const t of clave.tokens.values()) {
  log('token', `${t.id.slice(0, 12)}… type=${t.type} data=${JSON.stringify(t.data)}`)
}

clave.close()
client.close()
