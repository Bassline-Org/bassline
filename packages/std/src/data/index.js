/**
 * A set of useful data types reified as messages for Bassline
 * The data types chosen are inspired by rebol, but slightly modified
 *
 * Additionally these data types are structural, and designed to be layered
 * When we build a "scalar", we shouldn't think of it as being only a scalar.
 * Instead we should think of it as having a scalar representation.
 *
 * This allows us to, for example, merge a semver + scalar, expressing
 * to have a versioned scalar.
 * ie: { major: 1, minor: 0, patch: 0, scalar: 100 }
 *
 * Currently we expose the following data types
 * - scalars
 * - collections
 * - intervals
 * - semver (wip)
 * - uri
 * @todo the uri is just an href for now but this will support both reprs later
 */
import { is, msg, failure } from '@bassline/core'

//@todo I need to update semver and it's logic
//export * from './semver.js'

export function scalar(value, aMsg = msg()) {
  if (!is.scalar(value))
    throw failure(`scalar: invalid value ${JSON.stringify(value)}`)
  return aMsg.merge({ scalar: value })
}

export function uri(href, aMsg = msg()) {
  if (!URL.canParse(href)) throw failure(`uri: cannot parse href ${href}`)
  return aMsg.merge({ href })
}

export function describe(description, aMsg = msg()) {
  if (!is.string(description))
    throw failure(`describe: invalid description: ${description}`)
  return aMsg.merge({ description })
}

export function interval(min, max, aMsg = msg()) {
  if (!(is.number(min) && is.number(max)))
    throw failure(`interval: min ${min} max:${max}`)

  if (min > max) throw failure('interval: min cannot be > max')

  return aMsg.merge({ min, max })
}

export function collection(items, aMsg = msg()) {
  if (!is.array(items))
    throw failure(`collection: items must be an array: ${items}`)
  return aMsg.merge({ items })
}
