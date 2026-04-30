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
 * - semver
 * - uri
 * - capabilities
 * - basic provenance types
 * @todo the uri is just an href for now but this will support both reprs later
 */

export * from './scalar.js'
export * from './collection.js'
export * from './interval.js'
export * from './semver.js'
export * from './uri.js'
export * from './caps.js'
export * from './provenance.js'
