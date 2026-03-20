import { hasKeys } from '@bassline/core'

export function hasType<K extends string>(msg: unknown, type: K): msg is { type: typeof type } {
  return hasKeys(msg, ['type']) && msg.type === type
}
