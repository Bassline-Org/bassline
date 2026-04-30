import { leaf } from '@bassline/std/ns'
import { portLike, matches, Request } from '@bassline/std/roles'
import { docs, scalar } from '@bassline/std/data'

const acknowledge = matches(Request, req => {
  req.reply(scalar('logged'))
  console.log('acknowledged')
})

const logger = leaf(msg => {
  acknowledge(msg)
  console.log('logger: ', msg)
})

const introMsg = docs('a logger')

export default function introduce(session) {
  const { send } = logger
  const close = () => console.log('port tried to close the logger?')
  const m = portLike(introMsg, { send, close })
  session.send(m)
}
