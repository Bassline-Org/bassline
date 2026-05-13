import { msg, is, failure } from '@bassline/core'
import { lambda } from './lambda.js'

const description = `\
I am a menu.
I represent a group of logically related "callable" things.
In other words I present a domain specific way of invoking "call" \
on a group of lambdas.

Each of my capabilities expects something with 'resolve' and 'reject'.

Like lambda, I will invoke one of those always if present, ignoring
the argument otherwise.`

export function menu(verbs, aMsg = msg()) {
  if (!is.object(verbs))
    throw failure(
      `invalid verbs: must be an object. Got: ${JSON.stringify(verbs)}`
    )

  const caps = {}
  for (const [verb, lam] of Object.entries(verbs)) {
    let verbMsg
    if (is.fn(lam)) {
      verbMsg = lambda(lam)
      verbMsg.closedBy(aMsg)
    } else if (is.msg(lam) && lam.capableOf('call')) {
      verbMsg = lam
    } else {
      throw failure(`invalid verb: ${JSON.stringify(lam)}`)
    }
    caps[verb] = aMsg => verbMsg.invoke('call', aMsg)
  }

  return aMsg.defaults({ description }).grantCaps(caps)
}
