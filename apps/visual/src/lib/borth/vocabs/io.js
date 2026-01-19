// io vocab - Console I/O
import { Vocab } from '../primitives.js'

export function createIoVocab(rt) {
  const vocab = new Vocab('io')
  const saved = rt.current
  rt.current = vocab

  rt.def('.log', a => console.log(a))
  rt.def('.error', a => console.error(a))
  rt.def('.warn', a => console.warn(a))

  rt.current = saved
  return vocab
}
