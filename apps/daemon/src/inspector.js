/**
 * @import { Msg } from '@bassline/core'
 */
import { is, propagator } from '@bassline/core'
import { styleText } from 'node:util'

const STR_MAX = 80
const DEPTH_MAX = 6
const INLINE_MAX = 60

export const [inspector, onMsg] = propagator()

onMsg(m => console.log(pp(m)))

/**
 * @param {unknown} value
 * @param {number} [depth]
 * @param {number} [indent]
 * @param {WeakSet<object>} [seen]
 * @returns {string}
 */
export function pp(value, depth = 0, indent = 0, seen = new WeakSet()) {
  if (depth > DEPTH_MAX) return styleText('dim', '…')
  if (is.msg(value)) return ppMsg(value, depth, indent, seen)
  if (is.string(value)) return ppString(value, indent)
  if (is.number(value)) return styleText('yellow', String(value))
  if (is.boolean(value)) return styleText('magenta', String(value))
  if (is.null(value)) return styleText('magenta', 'null')
  if (is.undefined(value)) return styleText('dim', 'undefined')
  if (is.array(value)) return ppArray(value, depth, indent, seen)
  if (is.fn(value)) return styleText('cyan', '<fn>')
  if (is.object(value))
    return ppObject(
      /** @type {Record<string, unknown>} */ (value),
      depth,
      indent,
      seen
    )
  return String(value)
}

/**
 * @param {string} s
 * @param {number} indent
 */
function ppString(s, indent) {
  if (!s.includes('\n')) {
    if (s.length <= STR_MAX) return styleText('yellow', JSON.stringify(s))
    const head = JSON.stringify(s.slice(0, STR_MAX))
    return (
      styleText('yellow', head.slice(0, -1)) +
      styleText('dim', '…') +
      styleText('yellow', '"')
    )
  }
  const pad = ' '.repeat(indent + 2)
  const close = ' '.repeat(indent)
  const body = s
    .split('\n')
    .map(line => pad + line)
    .join('\n')
  return (
    styleText('yellow', '"') +
    '\n' +
    styleText('yellow', body) +
    '\n' +
    close +
    styleText('yellow', '"')
  )
}

/**
 * @param {Msg} m
 * @param {number} depth
 * @param {number} indent
 * @param {WeakSet<object>} seen
 */
function ppMsg(m, depth, indent, seen) {
  if (seen.has(m)) return styleText('dim', '<circular>')

  const label = styleText('dim', 'Msg')
  const capStr = m.capKeys.length
    ? '<' + m.capKeys.map(k => styleText('cyan', String(k))).join(', ') + '>'
    : ''
  const head = label + capStr

  if (m.keys.length === 0) {
    return capStr ? head : head + ' {}'
  }

  seen.add(m)
  try {
    return (
      head +
      ' ' +
      ppObject(
        /** @type {Record<string, unknown>} */ (m.data),
        depth,
        indent,
        seen
      )
    )
  } finally {
    seen.delete(m)
  }
}

/**
 * @param {Record<string, unknown>} obj
 * @param {number} depth
 * @param {number} indent
 * @param {WeakSet<object>} seen
 */
function ppObject(obj, depth, indent, seen) {
  const entries = Object.entries(obj)
  if (entries.length === 0) return '{}'

  const inlineItems = entries.map(
    ([k, v]) => `${k}: ${pp(v, depth + 1, 0, seen)}`
  )
  const inline = '{ ' + inlineItems.join(', ') + ' }'
  if (!inline.includes('\n') && stripAnsi(inline).length <= INLINE_MAX)
    return inline

  const nextIndent = indent + 2
  const pad = ' '.repeat(nextIndent)
  const close = ' '.repeat(indent)
  const lines = entries.map(
    ([k, v]) => `${pad}${k}: ${pp(v, depth + 1, nextIndent, seen)}`
  )
  return '{\n' + lines.join(',\n') + '\n' + close + '}'
}

/**
 * @param {readonly unknown[]} arr
 * @param {number} depth
 * @param {number} indent
 * @param {WeakSet<object>} seen
 */
function ppArray(arr, depth, indent, seen) {
  if (arr.length === 0) return '[]'
  const items = arr.map(v => pp(v, depth + 1, indent + 2, seen))
  const inline = '[' + items.join(', ') + ']'
  if (!inline.includes('\n') && stripAnsi(inline).length <= INLINE_MAX)
    return inline

  const nextIndent = indent + 2
  const pad = ' '.repeat(nextIndent)
  const close = ' '.repeat(indent)
  return '[\n' + items.map(s => pad + s).join(',\n') + '\n' + close + ']'
}

/** @param {string} s */
function stripAnsi(s) {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b\[[0-9;]*m/g, '')
}
