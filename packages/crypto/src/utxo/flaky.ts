import { offer, accept, Message, delay, propagator } from '@bassline/core'

const SYN = Symbol.for('ack'),
  MSG_COUNT = 1000000,
  COOLDOWN = 100,
  FAILURE_ODDS = 70,
  MAX_ROUNDS = 20

let round = 1,
  failures = 0

const unreliable = propagator((msg, p) => {
  const rand = (n: number) => Math.floor(Math.random() * n)
  if (rand(100) > FAILURE_ODDS) p(msg)
  else failures++
})

function reliable() {
  const pending = new Map<number, Attempt>()
  const success = new Set<number>()
  let id_ = 0
  const count = () => ({ unknown: pending.size, success: success.size })

  function send(msg: Message) {
    const id = id_++
    const withSyn = offer({
      [SYN]: _ => {
        if (pending.has(id)) {
          pending.delete(id)
          success.add(id)
        }
      },
    })
    const attempt = () => withSyn.send(msg)
    pending.set(id, attempt)
    attempt()
  }

  return {
    send,
    count,
    pending,
  }
}

unreliable.to(
  accept({
    [SYN]: (msg, ack) => ack({}),
  })
)

const sender = reliable(receiver)

console.log('initial send started')
for (let i = 0; i < MSG_COUNT; i++) {
  sender.send({ hello: i })
}
console.log('initial send done')

async function retry() {
  for (const [_, attempt] of sender.pending) {
    for (let i = 0; i < round; i++) attempt()
  }
  await delay(COOLDOWN)
}

function status() {
  const { success, unknown } = sender.count()
  console.log(`[step: ${round}] confirmed: `, success)
  console.log(`[step: ${round}] unknown: `, unknown)
  console.log('Success %', (success / MSG_COUNT) * 100)
  console.log('total failures', failures)
}

await delay(COOLDOWN)

for (round = 1; round < MAX_ROUNDS; round++) {
  status()
  await retry()
  const { unknown } = sender.count()
  if (unknown === 0) break
}

const { unknown } = sender.count()
if (unknown === 0) {
  console.log('delivered in ', round, ' rounds')
} else {
  console.log('failed to deliver ', unknown, ' in ', round, 'rounds')
}

type Attempt = () => void
