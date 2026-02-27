// Portable core — no Node.js imports
export { Platform, platform, Resource, kResource, ResourceMirror } from './platform.js'
export { default as reducers } from './modules/reducers.js'
export { default as scope } from './modules/scope.js'
export { default as propagators } from './modules/propagators.js'
export { default as garage, Garage } from './modules/garage.js'
export { default as session, memoryTransport } from './modules/session.js'
export { default as gate } from './modules/gate.js'
export { default as persistence } from './modules/persistence.js'
