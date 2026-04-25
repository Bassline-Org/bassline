import { routeCaps, cacheCaps } from '../src/reify-caps.js'
import { reply, cancel, enrich } from '../src/caps.js'
import { collection, scalar } from '../src/data.js'
import { entries } from '../src/shape.js'
import { leaf } from '../src/ns.js'

const log = prefix => msg => console.log(prefix, msg)

const ensureData = msg => JSON.parse(JSON.stringify(msg))

// participant A
const localStore = routeCaps()

// participant B
const remoteClient = cacheCaps(leaf(localStore.dispatch))

const exampleMsg = enrich(collection([1, 2, 3]), [
  [reply, log('reply')],
  [cancel, log('cancel')],
])
const reified = ensureData(localStore.reify(exampleMsg))
const caps = reified.capabilities
const remoteBound = remoteClient.bind(reified)

console.log('these should work\n')
reply.invoke(exampleMsg, scalar('hi example'))
reply.invoke(remoteBound, scalar('hi remoteBound'))
cancel.invoke(exampleMsg, scalar('hi example'))
cancel.invoke(remoteBound, scalar('hi remoteBound'))

console.log('these shouldnt work\n')
reply.invoke(reified, scalar('hi reified'))
cancel.invoke(reified, scalar('hi reified'))
reply.invoke(ensureData(remoteBound), scalar('what'))
cancel.invoke(ensureData(remoteBound), scalar('what'))

console.log('revoking handlers')
for (const [_key, value] of entries(caps)) {
  localStore.revoke(value)
}
reply.invoke(exampleMsg, scalar('hi example'))
cancel.invoke(exampleMsg, scalar('hi example'))

reply.invoke(remoteBound, scalar('hi remoteBound'))
cancel.invoke(remoteBound, scalar('hi remoteBound'))
