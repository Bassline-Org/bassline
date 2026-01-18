// Introspection
import { Vocab } from '../primitives.js'

export function createReflectVocab(rt) {
  const vocab = new Vocab('reflect')
  const saved = rt.current
  rt.current = vocab

  rt.def('words', () => {
    const all = []
    for (const v of rt.vocabs) {
      for (const [, word] of v.words) {
        all.push(word)
      }
    }
    if (rt.current && !rt.vocabs.includes(rt.current)) {
      for (const [, word] of rt.current.words) {
        all.push(word)
      }
    }
    return [all]
  })

  rt.def('word-name', word => [word?.name ?? null])
  rt.def('word-attr', (word, key) => [word?.attributes?.[key] ?? null])
  rt.def('find', name => [rt.find(name)])
  rt.def('last-word', () => [rt.last])

  rt.current = saved
  return vocab
}
