//@ts-check
/**
 * @import { Role } from "./role"
 * @import { Message, Send } from "@bassline/core"
 */

/**
 * @template {typeof Role} T
 * @param {T} aRole
 * @param {Send<InstanceType<T>>} fn
 * @returns {Send<Message>}
 */
export function matches(aRole, fn) {
  return msg => {
    const match = aRole.match(msg)
    if (match) fn(match)
  }
}
