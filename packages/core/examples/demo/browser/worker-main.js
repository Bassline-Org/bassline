import { fromPort } from '/src/transports/worker.js'
import { message } from '/src/messages.js'

const sessionId = 'wk-' + Math.random().toString(36).slice(2, 6)
document.getElementById('session').textContent = sessionId

const worker = new Worker('/worker-bridge.js', { type: 'module' })
const [read, write] = fromPort(worker)

const form = document.getElementById('form')
const input = document.getElementById('input')
const messages = document.getElementById('messages')

form.addEventListener('submit', e => {
  e.preventDefault()
  const body = input.value.trim()
  if (!body) return
  write.send(message({ from: sessionId, body }))
  input.value = ''
})

read.sink(msg => {
  const li = document.createElement('li')
  li.textContent = `[${msg.from}] ${msg.body}`
  messages.appendChild(li)
})
