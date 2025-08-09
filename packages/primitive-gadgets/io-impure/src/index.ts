/**
 * @bassline/gadgets-io-impure
 * 
 * Impure I/O primitive gadgets for Bassline
 * These gadgets perform side effects and are non-deterministic
 */

// File system operations
export {
  fileRead,
  fileWrite,
  fileAppend,
  fileExists,
  fileDelete,
  dirList,
  fileStats,
  fileWatch
} from './file'

// Network operations
export {
  httpFetch,
  httpGet,
  httpPost,
  websocket,
  graphql
} from './network'

// Polymorphic I/O
export {
  slurp,
  spit
} from './slurp'