//@ts-check
import { is, cell } from '@bassline/core'
import { invariants, failure, conforms, merge } from '../shape.js'
/**
@import { Semver, Ordering } from "./types"
@import { Send, Message } from "@bassline/core"
 */

/**
 * @param {number} [major]
 * @param {number} [minor]
 * @param {number} [patch]
 * @returns {Semver}
 */
export function semver(major = 0, minor = 0, patch = 0) {
  const m = { major, minor, patch }
  assertSemver(m)
  return m
}

/**
@type {(versioned: Semver, field: keyof Semver) => Semver}
 */
export function bump(versioned, field) {
  const { major, minor, patch } = versioned
  switch (field) {
    case 'major':
      return merge([versioned, semver(major + 1, 0, 0)])
    case 'minor':
      return merge([versioned, semver(major, minor + 1, 0)])
    case 'patch':
      return merge([versioned, semver(major, minor, patch + 1)])
    default:
      console.warn('unknown bump: ', field)
      return versioned
  }
}

/**
@type {(a: Semver, b: Semver) => Semver}
 */
export function maxVersion(a, b) {
  switch (cmpSemver(a, b)) {
    case 'gt':
    case 'eq':
      return a
    case 'lt':
      return b
    case 'nc':
      throw failure(`Cannot compare: ${JSON.stringify({ a, b })}`)
  }
}

/**
@type {(a: Semver, b: Semver) => Semver}
 */
export function minVersion(a, b) {
  switch (cmpSemver(a, b)) {
    case 'gt':
      return b
    case 'lt':
    case 'eq':
      return a
    case 'nc':
      throw failure(`Cannot compare: ${JSON.stringify({ a, b })}`)
  }
}

/**
@type {(a: Semver, b: Semver) => Ordering}
 */
export function cmpSemver(a, b) {
  const result = a.major - b.major || a.minor - b.minor || a.patch - b.patch
  if (result > 0) return 'gt'
  if (result === 0) return 'eq'
  if (result < 0) return 'lt'
  return 'nc'
}

// ==== shape predicates ====
export const assertVersionNum = invariants([
  [is.number, 'version num must be a number'],
  [
    (/** @type {number}*/ n) => Number.isInteger(n),
    'version num must be an integer',
  ],
  [(/** @type {number}*/ n) => n >= 0, 'version num must be >= 0'],
])
export const assertSemver = invariants([
  [
    conforms({
      major: assertVersionNum,
      minor: assertVersionNum,
      patch: assertVersionNum,
    }),
    'invalid semver',
  ],
])
export const isSemver = assertSemver.test

// ==== cell merges ====
/**
@param {Semver} acc
@param {Semver} inc
@param {Send<Semver>} update
 */
export function versionMerge(acc, inc, update) {
  if (!isSemver(inc)) return
  const max = maxVersion(acc, inc)
  if (max === acc) return
  update(inc)
}

/**
 * @param {Message} init
 */
export const versioned = init => cell(versionMerge, merge([semver(), init]))
