import { msg, delay } from '@bassline/core'
import { connect } from '@bassline/core/transports/socket'
import { dialogue } from '@bassline/std/cache'

const options = { port: '6969' }

const msgCounts = new Map()
const inc = id => {
  const existing = msgCounts.get(id) ?? 0
  msgCounts.set(id, existing + 1)
}

async function connectClient(id) {
  const log = (...args) => console.log(`[client ${id}] `, ...args)
  log('connecting')
  const [conv, onMsg] = dialogue(connect(options))
  log('connected')

  conv.onClose(() => log('disconnected'))
  onMsg(aMsg => {
    inc(id)
    aMsg.invoke('foo', msg({ stfu: `from client ${id}` }))
  })

  const description = `Hello, I am client ${id}, thank you for hosting me.`
  const greet = msg({ description }).grant('foo', m => log('foo: ', m.data))

  return async () => {
    await delay(1000)
    conv.send(greet)
    for (let i = 0; i < 5; i++) {
      greet.map(aMsg => {
        const m = aMsg.grant('foo', m => log(`version ${i}`, m.data))
        conv.send(m)
      })
      await delay(100)
    }
    return async () => {
      conv.close()
    }
  }
}

const tasks = []

for (let i = 0; i < 50; i++) {
  tasks.push(connectClient(i))
}

const connected = await Promise.all(tasks)
console.log('connected')

const bursted = await Promise.all(connected.map(f => f()))
console.log('bursted')

await Promise.all(bursted.map(f => f()))
console.log('closed')

console.log('total messages: ', Object.fromEntries(msgCounts.entries()))
