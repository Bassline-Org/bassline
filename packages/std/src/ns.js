import { port, consume, createController } from '@bassline/core'
import { send as sendCap, close as closeCap, enrich } from './caps.js'

/**
 * Builds a namespace & router tool for bassline systems
 * @import {Send, Ctl, Close, Port, Revocable, Consume, Message} from "@bassline/core"
 * @typedef {ReturnType<typeof leaf>} Leaf
 * @typedef {{port: Port, propagator: Consume<Message>}} NsEntry
 * @typedef {ReturnType<typeof namespace>} Namespace
 */

/**
 *
 * a leaf participant
 * @param {Send} fn
 * @returns {{send: Send, ctl: Ctl, close: Close}}
 */
export const leaf = fn => {
  const { ctl, close } = createController()
  /**
   * @type {Revocable<Send>}
   */
  const send = ctl.fn(msg => void fn(msg))
  return { ctl, close, send }
}

/**
 * @param {number} [defaultSize]
 */
export function namespace(defaultSize) {
  const ports = new Map()
  const { close, ctl } = createController()
  /**
   * @param {string} name
   * @param {number} [size]
   * @returns {NsEntry}
   */
  const at = (name, size) => {
    if (!ports.has(name)) {
      const p = port(size ?? defaultSize)
      ports.set(name, { port: p })
      p.ctl.onClose(() => ports.delete(name))
    }
    return ports.get(name)
  }
  const common = {
    messages: at('messages', 256),
    errors: at('errors'),
  }
  /**
   * @param {string} name
   * @param {Send} fn
   * @returns {ReturnType<Consume<Message>['to']>}
   */
  const relay = (name, fn) => {
    const entry = at(name)
    entry.propagator ??= consume(entry.port.recv)
    const cleanup = entry.propagator.to(send)
    function send(msg) {
      try {
        fn(msg)
      } catch (e) {
        if (name === 'errors') {
          throw e
        }
        const m = enrich({ source: name, error: e }, [
          [closeCap, cleanup],
          [sendCap, send],
        ])
        common.errors.port.send(m)
      }
    }
    return cleanup
  }
  const keys = ctl.fn(() => ports.keys())
  const entries = ctl.fn(() => ports.entries())
  const has = key => ports.has(key)

  return {
    close,
    ctl,
    common,
    keys,
    entries,
    relay: ctl.fn(relay),
    has: ctl.fn(has),
    at: ctl.fn(at),
  }
}

/**
 *
 * @param {Namespace} ns
 * @returns {Leaf}
 */
export function router(ns) {
  const l = leaf(m => {
    const { via, ...msg } = m
    if (typeof via !== 'string') return
    if (via !== 'messages') ns.common.messages.port.send(m)
    ns.at(via).port.send(msg)
  })
  const { ctl, close, send } = l
  const sendTo = (via, msg) => send({ ...msg, via })
  ns.ctl.closes(l)
  return { ctl, close, send, sendTo }
}
