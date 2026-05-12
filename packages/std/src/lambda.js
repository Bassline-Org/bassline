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
  const lambdaMsg = msg()
    .merge({ description })
    .grantCaps({ call, close: () => lambdaMsg.close() })

  async function call(aMsg) {
    if (!aMsg.capableOf(requiredCaps)) return
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
        lambdaMsg.closes(m)
        transferred = true
        return responder.invoke('resolve', m)
      }
      if (is.undefined(result)) {
        return responder.invoke('resolve', msg())
      }
      throw failure(`invalid result: ${JSON.stringify(result)}`)
    } catch (e) {
      if (e instanceof Error) {
        return responder.invoke('reject', msg().merge({ error: e.message }))
      }
      throw e
    } finally {
      responder.close()
      if (!transferred) aMsg.close()
    }
  }
  return lambdaMsg
}

export function createPromise(aMsg = msg()) {
  const resolver = aMsg
  const promise = new Promise((resolve, reject) => {
    resolver.grantCaps({ resolve, reject })
  })
  return [resolver, promise]
}

export const request =
  spelling =>
  aTarget =>
  async (aMsg = msg()) => {
    const [resolver, promise] = createPromise(aMsg.copy())
    const lam = await aTarget
    lam.invoke(spelling, resolver)
    const result = await promise
    return result
  }

export const call = request('call')
