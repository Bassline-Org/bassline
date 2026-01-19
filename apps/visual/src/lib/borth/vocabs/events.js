// events vocab - Event emission, triggers, toasts, chrons
import { Vocab, panic } from '../primitives.js'

const WS = ' \t\n\r'
const isWS = c => WS.includes(c)

export function createEventsVocab(rt) {
  const vocab = new Vocab('events')
  const saved = rt.current
  rt.current = vocab

  rt.def('emit', async (eventName, data) => {
    await rt.emitEvent(eventName, data)
  })

  rt.def('trigger', async (payload, eventName) => {
    await rt.emitEvent(eventName, payload)
  })

  rt.def('toast', async (type, message) => {
    await rt.emitEvent('toast:show', { type, message })
  })

  rt.def('chron', () => {
    const name = rt.parse(isWS)
    const interval = rt.parse(isWS)
    const match = interval.match(/^(\d+)(s|m|h|d)$/)
    if (match) {
      const [, num, unit] = match
      const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 }
      const ms = parseInt(num, 10) * multipliers[unit]
      rt.startChron(name, ms)
    } else {
      panic(`chron: invalid interval ${interval}`)
    }
  })

  rt.def('stop-chron', () => {
    const name = rt.parse(isWS)
    rt.stopChron(name)
  })

  rt.current = saved
  return vocab
}
