import {isPlainObject} from "./utils.js"

export class Message {
  content = {}
  update(callback) {
    callback(this.content)
    if('body' in this.content
       && this.content.body === undefined) {
      delete this.content.body
    }
    return this
  }
  get op() {
    return this.content?.body === undefined ? 'get' : 'put'
  }
  get isEmpty() {
    return Object.keys(this.content).length === 0
  }
  toJSON() {
    return this.content
  }
  static from(content) {
    if (content instanceof Message) return content
    if (content === undefined) return new Message()
    if (isPlainObject(content)) {
      return new Message().update(c => Object.assign(c, content ?? {}))
    } else {
      return new Message().update(c => c.body = content)
    }
  }
}
export const message = c => Message.from(c)
export default message

export const transcribe = (msg, content) =>
  msg.update(c => {
    if (c.transcript === undefined) c.transcript = []
    c.transcript.push(message(content))
  })

export const warning = reason => message({type: 'warning', body: reason})
export const warn = (msg, reason) => transcribe(msg, warning(reason))

export const fault = (condition, msg, context = {}) => message({fault: condition, on: msg, ...context})
export const throwFault = (condition, msg, context = {}) => {throw fault(condition, msg, context)};
