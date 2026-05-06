import { msg, is, failure } from '@bassline/core'
const description = `\
I am a lambda.
I am internally a curried function.
I do not auto curry, so please invoke me 1 arg at a time. :)
I will only accept messages with the caps: resolve + reject.
When you invoke my call cap, I will apply my function to the message
and invoke resolve or reject.

I will always resolve & reject a message with caps.
If the fn returns a function, it will resolve to another lambda msg.
If the fn returns a msg, it will resolve to the msg.
If the fn returns undefined, it will resolve an empty message.
Anything else will reject the message.`

const requiredCaps = ['resolve', 'reject']

export function lambda(fn) {
  const message = msg({ description })
  message.grantAll({ call, close: message.close })
  async function call(aMsg) {
    if (!aMsg.hasCap(requiredCaps)) return
    // we do this to copy the resolve & reject caps for santiary reasons
    const responder = aMsg.copy()
    let transferred = false
    try {
      const result = await fn(aMsg)
      if (is.msg(result)) {
        return responder.invoke('resolve', result)
      }
      if (is.fn(result)) {
        const m = lambda(result)
        m.closes(aMsg)
        message.closes(m)
        transferred = true
        return responder.invoke('resolve', m)
      }
      if (is.undefined(result)) {
        return responder.invoke('resolve', msg({}))
      }
      throw failure(`invalid result: ${JSON.stringify(result)}`)
    } catch (e) {
      console.error(e)
      responder.invoke('reject', msg({ error: e.message }))
    } finally {
      responder.close()
      if (!transferred) aMsg.close()
    }
  }
  return message
}

export function createPromise(aMsg = msg({})) {
  const resolver = aMsg
  const promise = new Promise((resolve, reject) => {
    resolver.grantAll({ resolve, reject })
  })
  return [resolver, promise]
}

export const request =
  spelling =>
  aTarget =>
  async (aMsg = msg()) => {
    const [resolver, promise] = createPromise()
    const lam = await aTarget
    lam.invoke(
      spelling,
      aMsg.map(m => m.eat(resolver))
    )
    const result = await promise
    return result
  }

export const call = request('call')

export async function evaluate(expr) {
  if (is.msg(expr)) return expr
  if (!is.array(expr)) throw failure('evalute requires an array / msg for expr')
  const [head, ...tail] = expr
  let result = await evaluate(head)
  for (const m of tail) {
    result = await call(result)(await evaluate(m))
  }
  return result
}
