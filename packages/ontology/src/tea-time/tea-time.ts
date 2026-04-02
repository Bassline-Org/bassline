import { net, consume, delay as _delay, propagator, cell, is, table } from '@bassline/core'
import type { Port, Message, Propagator, To, Send } from '@bassline/core'

/**
 * An implementation of something that looks like TeaTime as used by croquet
 *
 * The purpose of this is for a very scalable sequencing ontology that fits with how bassline systems want to work
 * NOTE: This is intentionally for a simple kind of sequencing system. This requires a total order, and a sequencer, but hey
 * it requires literally nothing of the reflector, meaning reflectors can themselves be nets of things.
 * Anyway, my point is total order === bad, but it's all good for now
 *
 * TeaTime works as a conversation between a client and a reflector.
 * The reflector is assumed to be know to all sibling clients, and can be rotated or swapped or whatever
 *
 * ============
 * Mr Reflector
 * ============
 * The reflector has a very simple job.
 * It defines the order in which messages take place
 * For each message it sees from a client:
 * 1. It will refer to the previous id it's seen
 * 2. It will generate a new id for the message
 * 3. It will return the received message to the client, enriched with the previous id, and the current id
 *
 * =========================================
 * Mr Client (or server, or mrs, or whateva)
 * =========================================
 *
 * The client is responsible for obviously sending messages to the reflector
 * However the way in which it does this, is that it will send a message to something.
 * That thing will not immediately apply that message, instead forwarding it to the reflector
 * When it receives the message back, it will try and append it to what it knows, ie can it build a chain from the previous id?
 * If not it can reach out to peers, or wait however long it wants.
 *
 * After a certain point (a few message in a chain), it is finalized and we can prune the history if we want, otherwise it could be aborted.
 * We omit that from this implementation
 **/

const shouldDelay = true
const rand = (max: number) => Math.floor(Math.random() * max)
async function delay(ms = 2000, force = false) {
  if (force || shouldDelay) await _delay(ms)
}

const connect = <T>(sources: { to: To<T> }[], target: { send: Send<T> }) => sources.forEach(s => s.to(target.send))

function orderingMember({ send, recv }: Port) {
  const id = crypto.randomUUID()
  let lastId = 'ROOT'
  const fromNet = consume(recv)
  fromNet.to(msg => {
    console.log('stamping', msg)
    const prev = lastId
    const curr = crypto.randomUUID()
    lastId = curr
    const tt = {
      prev,
      curr,
      reflector: id,
    } as const
    send({ tt, msg } as const)
  })
  return fromNet
}

function peer({ send, recv }: Port) {
  const { to } = consume(recv)
  return { to, send }
}

const messageCell = () =>
  cell<Set<string>>((state, ids, changed) => {
    let interesting = false
    ids.forEach(id => {
      if (state.has(id)) return
      interesting = true
      state.add(id)
    })
    if (interesting) changed(state)
    else console.log('yawn')
  }, new Set())

const n = net()

const ordered = orderingMember(n())
const a = peer(n())
const b = peer(n())

const ids = propagator<Message, Set<string>>((msg, p) => {
  const [tt] = table.index(msg, ['tt'])
  if (is.nil(tt)) return
  const [prev, curr] = table.index(tt, ['prev', 'curr'])
  if (is.string(prev) && is.string(curr)) p(new Set([prev, curr]))
})

const msgs = messageCell()

b.to(msg => console.log('b saw: ', msg))

a.send({ hello: 'world' })
b.send({ goodbye: 'world' })

connect([a, b], ids)
connect([ids], msgs)
msgs.to(msg => console.log('new messages: ', msg))
