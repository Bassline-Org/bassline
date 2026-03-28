import { offer, accept, port, consume, Message, Send, Recv } from '@bassline/core'

const REPLY = Symbol.for('reply')
const FAKE = Symbol.for('fake')

// this builds a little system which let's us add our own caps to received messages
function exampleSystem(recv: Recv, send: Send) {
  const replies: Message[] = []

  const enrichedSend = offer(send, {
    [REPLY]: msg => {
      console.log('\n[Example] got a reply: \n', msg)
      replies.push(msg)
    },
  })

  consume(recv, msg => {
    console.log('\n[Example] got a msg:\n', msg)
    enrichedSend(msg)
  })
}

// this system accepts capabilities on messages it receives
function anotherSystem(recv: Recv) {
  consume(
    recv,
    accept({
      [REPLY]: (reply, msg) => reply({ hello: 'world' }),
      [FAKE]: () => {
        throw new Error('oops')
      },
    })
  )
}

const a = port()
const b = port()

exampleSystem(a.recv, b.send)
anotherSystem(b.recv)

// then we run this system
for (let i = 0; i < 10; i++) {
  const m = { foo: 'bar' }
  console.log('sent: ', m)
  a.send(m)
}
