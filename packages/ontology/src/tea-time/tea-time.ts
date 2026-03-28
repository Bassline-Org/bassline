import Graph, { DirectedGraph } from 'graphology'
import { net, port, consume, delay as _delay, offer, accept } from '@bassline/core'
import type { Send, Recv, Close, Message, Port } from '@bassline/core'

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

const STAMP = Symbol.for('stamp')

function ordering({ send, recv, close }: Port) {
  const id = crypto.randomUUID()
  let lastId = 'ROOT'

  consume(
    recv,
    accept({
      [STAMP]: (res, msg) => {
        console.log('stamping', msg)
        const prev = lastId
        const curr = crypto.randomUUID()
        lastId = curr
        const tt = {
          prev,
          curr,
          reflector: id,
        }
        res({ tt })
        send({ tt, msg })
      },
    })
  )

  return close
}

function peer({ send, recv, close }: Port) {
  consume(recv, msg => {
    console.log('saw: ', msg)
  })

  return {
    send: offer(send, {
      [STAMP]: msg => console.log('received stamped: ', msg),
    }),
    close,
  }
}

const n = net()

const closeReflector = ordering(n())
const a = peer(n())
const b = peer(n())

a.send({ hello: 'world' })

b.send({ goodbye: 'world' })
