import { fromWebSocket } from '/src/transports/websocket.js'
import { message } from '/src/messages.js'

const sessionId = 'ws-' + Math.random().toString(36).slice(2, 6)
document.getElementById('session').textContent = sessionId

const [read, write] = fromWebSocket(new WebSocket('ws://localhost:3000'))

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
