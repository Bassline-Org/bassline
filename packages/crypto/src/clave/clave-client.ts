import { consume, Port } from '@bassline/core'
import { generateKeyPair, KeyPair, pubKeyHash } from '../helpers.js'
import { Tx, TxResult } from './clave.js'

export function claveClient({ port: { send, recv, close }, kp = generateKeyPair() }: ClientOptions) {
  const address = pubKeyHash(kp.pubKey)
  const pending = new Map<string, (result: TxResult) => void>()

  const task = consume(recv, (result: TxResult) => {
    const nonce = result.tx?.nonce as string | undefined
    if (nonce && pending.has(nonce)) {
      pending.get(nonce)!(result)
      pending.delete(nonce)
    }
  })

  return {
    transact(tx: Tx): Promise<TxResult> {
      const nonce = crypto.randomUUID()
      return new Promise(resolve => {
        pending.set(nonce, resolve)
        send({ ...tx, nonce })
      })
    },
    address,
    close,
    task,
  } as const
}

type ClientOptions = {
  port: Port<Tx, TxResult>
  kp?: KeyPair
}
