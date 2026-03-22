import Graph, { DirectedGraph } from 'graphology'
import { net, port, consume, delay as _delay } from '@bassline/core'
import type { Send, Recv, Close } from '@bassline/core'

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
 */
const shouldDelay = true
const rand = (max: number) => Math.floor(Math.random() * max)
async function delay(ms = 2000, force = false) {
  if (force || shouldDelay) await _delay(ms)
}

function createReflector<Msg = unknown>(debug?: Send<{ stamped: TeaMsg<Msg>; ts: number }>) {
  const mrReflectorId = crypto.randomUUID()
  let lastId = 'ROOT'
  const clients = net<TeaMsg<Msg>>()

  // the primary stamping & reflecting actor
  type ToStamp = { msg: Msg; source: string }
  const stamper = port<ToStamp>(1000)
  consume(stamper.recv, msg => {
    const stamped = stamp(msg)
    const holup = rand(2000)
    stamped.tt.delay = holup
    debug?.({ stamped, ts: Date.now() })

    delay(holup).then(() => {
      clients.send(stamped)
    })
  })

  function stamp({ msg, source }: ToStamp) {
    const prev = lastId
    const curr = crypto.randomUUID()
    lastId = curr
    return {
      tt: { prev, curr, reflector: mrReflectorId, source, delay: -Infinity },
      msg,
    } satisfies TeaMsg<Msg>
  }

  function join() {
    // arbitrary buffer sizes, could be whatever
    const toStamper = port<Msg>(50)
    const toClient = clients(50)
    const clientId = crypto.randomUUID()
    consume(toStamper.recv, msg => stamper.send({ msg, source: clientId }))
    return {
      send: toStamper.send,
      recv: toClient.recv,
      close: () => {
        toClient.close()
        toStamper.close()
      },
    }
  }
  join.close = clients.close
  return join
}

function createMember<T>({ send, recv, close }: { send: Send<T>; recv: Recv<TeaMsg<T>>; close: Close }) {
  const graph = new Graph.DirectedGraph()

  consume(recv, ({ tt, msg }) => {
    const { prev, curr } = tt
    const arrivalIndex = graph.order
    graph.mergeNode(prev)
    graph.mergeNode(curr, { tt, msg, arrivalIndex })
    graph.mergeDirectedEdge(prev, curr)
  })

  return {
    send,
    close,
    graph,
  }
}

//================ Fin Implementation ================

const iota = (n: number, jump = 1) => {
  const arr = []
  for (let i = 0; i < n; i += jump) arr.push(i)
  return arr
}

const join = createReflector()

const members = iota(100).map(i => createMember(join()))

iota(1000).map(() => {
  const member = members.at(rand(members.length))!
  delay(rand(2000)).then(() => {
    member.send({ someValue: rand(500) })
  })
})

await delay(8000, true)

function analyzeSequence({ graph }: { graph: DirectedGraph }) {
  const roots = graph.filterNodes(node => graph.inDegree(node) === 0)
  const tails = graph.filterNodes(node => graph.outDegree(node) === 0)

  const sources = graph.reduceNodes((acc, node) => {
    const { source } = graph.getNodeAttribute(node, 'tt') ?? {}
    source && acc.add(source)
    return acc
  }, new Set())

  const maxDelay = graph.reduceNodes((max, node) => {
    const tt = graph.getNodeAttribute(node, 'tt') ?? {}
    const d = tt.delay ?? -Infinity
    return d > max ? d : max
  }, -Infinity)
  const minDelay = graph.reduceNodes((max, node) => {
    const tt = graph.getNodeAttribute(node, 'tt') ?? {}
    const d = tt.delay ?? Infinity
    return d < max ? d : max
  }, Infinity)

  return {
    nodes: graph.order,
    edges: graph.size,
    roots: roots.length,
    tails: tails.length,
    sources,
    maxDelay,
    minDelay,
  }
}

iota(5).forEach(() => {
  const member = members[rand(members.length)]
  console.log(analyzeSequence(member))
})

join.close()

export type TeaMsg<Msg> = {
  tt: {
    prev: string | 'ROOT'
    curr: string
    reflector: string
    source: string
    delay: number
  }
  msg: Msg
}
