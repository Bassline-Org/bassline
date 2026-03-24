/*
 *
 * If we look at utxo abstractly, we can see that it describes something like:
 *
 * fn validate(witness) -> (commitment(witness) | rejection(witness))
 *
 * The validate fn describes the set of constraints / rules a witness must satisfy
 * When it satisfies those constraints, it produces a commitment to the witness, which naturally forms a provenance chain
 *
 * This provenance chain doesn't have to be cryptographic, though it's useful when it is, nor does it have to be a single commitment
 * One could imagine a commitment that also specifies potential changes that could invalidate downstream things, such as the prior witness / related data
 *
 * But all of that would be considered interpretation rules on top of the generic commitment
 *
 */

import { port, consume } from '@bassline/core'

export function utxoish<Msg, Result>({ validate, finalize }: Utxoish<Msg, Result>) {
  const validator = port<Msg>()
  const finalizer = port<Result>()
  const task = Promise.all([
    consume(validator.recv, async msg => {
      const result = await validate(msg)
      finalizer.send(result)
    }),
    consume(finalizer.recv, finalize),
  ])
  return {
    send: validator.send,
    close: validator.close,
    task,
  } as const
}

type Utxoish<W, K> = {
  validate: (witness: W) => K | Promise<K>
  finalize: (result: K) => void | Promise<void>
}
