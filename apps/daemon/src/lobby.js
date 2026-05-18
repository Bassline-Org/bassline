import { failure, msg } from '@bassline/core'
import { lambda } from '@bassline/std'

export const localBindings = {}

const write = lambda(
  aMsg => {
    if (!aMsg.has(['key', 'val']))
      throw failure('missing key & val keys on msg')
    const [key, val] = aMsg.get(['key', 'val'])
    localBindings[key] = val
    return val
  },
  msg({
    description:
      'Call me with {key, val} and ill update the value of the binding',
  })
)

const read = lambda(
  aMsg => {
    if (!aMsg.has(['key'])) throw failure('missing key on msg')
    const key = aMsg.get('key')
    const val = localBindings[key]
    return msg({ [key]: val })
  },
  msg({
    description:
      'call me with a key provided, and ill return the value of the binding',
  })
)

const bindings = msg({
  read,
  write,
})

export const lobby = msg({ bindings })
