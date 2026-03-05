import message from "./messages.js"
import {thread, send} from "./sends.js"

export function log({ content, op }) {
  const { body, ...head } = content
  if (head.nolog) return
  console.log('op: ', op)
  if (head) console.log('head: ', head)
  if (body) console.log('body: ', body)
}

export const rand = (_msg) => Math.floor(Math.random() * 1000)
export const logrand = thread([log, rand])

export function ping(content = {}) {
  return message({ ping: Date.now(), ...content })
}

const p = ping()
const r = await send(logrand, p)

console.log(r)
