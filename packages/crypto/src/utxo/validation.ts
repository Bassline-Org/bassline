import { hexToBytes } from '@noble/hashes/utils.js'
import { Spend, UTXO, pubKeyHash, hashSpend, verify, invalid } from '../helpers.js'

export const isValid = {
  inputs(spend: Spend, store: Map<UTXO['id'], UTXO>) {
    const seen = new Set()
    const spending: UTXO[] = []
    for (const s of spend.inputs) {
      const { id } = s
      if (seen.has(id)) throw invalid('duplicate input id!')
      else seen.add(id)

      if (!store.has(id)) throw invalid(`input: ${id} not found`)
      else spending.push(s)
    }
    return spending
  },
  spender(spend: Spend, spending: UTXO[]) {
    const signerHash = pubKeyHash(hexToBytes(spend.pubKey))
    for (const tx of spending) {
      if (tx.pubKeyHash !== signerHash) {
        throw invalid(`input ${tx.id.slice(0, 8)}… not owned by signer`)
      }
    }
    const hash = hashSpend(spend.inputs, spend.outputs)
    const valid = verify(spend.signature, hash, spend.pubKey)
    if (!valid) throw invalid('invalid signature')
  },
  balance<T extends { value: number }>(spend: T) {
    const { value } = spend
    if (value < 0) throw invalid('negative balance')
    if (!Number.isInteger(value)) throw invalid('not an integer')
    return spend
  },
  balances(spend: Spend, spending: UTXO[]) {
    const sum = (items: Array<{ value: number }>) =>
      items.reduce((s, i) => {
        isValid.balance(i)
        return s + i.value
      }, 0)
    const inputSum = sum(spending)
    const outputSum = sum(spend.outputs)
    if (inputSum !== outputSum) throw invalid(`input sum ${inputSum} ≠ output sum ${outputSum}`)
  },
}

export default isValid
