// hooks vocab - Synchronous event/effect system with keyed handlers
import { Vocab } from '../primitives.js'

const WS = ' \t\n\r'
const isWS = c => WS.includes(c)

export function createHooksVocab(rt) {
  const vocab = new Vocab('hooks')
  const saved = rt.current
  rt.current = vocab

  // hook ( -- ) parses name, defines word that pushes hook object
  rt.def('hook', () => {
    if (!rt.current) throw new Error('hook requires current vocabulary (use in: first)')
    const name = rt.parse(isWS)
    const hook = {
      _type: 'hook',
      handlers: {},
      once: []
    }
    rt.def(name, () => [hook])
  }, true)

  // .trigger ( hook -- ) runs all enabled handlers
  rt.def('.trigger', async hook => {
    // Run keyed handlers
    for (const h of Object.values(hook.handlers)) {
      if (h.enabled !== false) {
        await rt.runFresh(h.quot)
      }
    }
    // Run and remove one-shots
    for (const h of hook.once) {
      await rt.runFresh(h.quot)
    }
    hook.once = []
  })

  // .when ( hook key quot -- )
  rt.def('.when', (hook, key, quot) => {
    hook.handlers[key] = { quot, enabled: true }
  })

  // .once ( hook quot -- )
  rt.def('.once', (hook, quot) => {
    hook.once.push({ quot })
  })

  // .enable ( hook key -- )
  rt.def('.enable', (hook, key) => {
    if (hook.handlers[key]) hook.handlers[key].enabled = true
  })

  // .disable ( hook key -- )
  rt.def('.disable', (hook, key) => {
    if (hook.handlers[key]) hook.handlers[key].enabled = false
  })

  // .remove ( hook key -- )
  rt.def('.remove', (hook, key) => {
    delete hook.handlers[key]
  })

  // .clear ( hook -- )
  rt.def('.clear', hook => {
    hook.handlers = {}
    hook.once = []
  })

  // .handlers ( hook -- keys )
  rt.def('.handlers', hook => [Object.keys(hook.handlers)])

  rt.current = saved
  return vocab
}
