/**
 * Bassline Setup
 *
 * Creates a Bassline instance with standard middleware registered.
 *
 * @example
 * import { createBassline, ref } from '@bassline/core';
 *
 * const bl = createBassline();
 * bl.write('bl:///cell/counter', 42);
 * bl.read('bl:///cell/counter'); // 42
 */

import { Bassline } from './bassline.js';
import { Cell } from './mirror/cell.js';
import {
  SumFold,
  MaxFold,
  MinFold,
  AvgFold,
  CountFold,
  FirstFold,
  LastFold,
  ConcatFold,
  ListFold
} from './mirror/fold.js';
import { RemoteMirror } from './mirror/remote.js';
import { HTTPServerMirror } from './mirror/http-server.js';
import { HTTPClientMirror } from './mirror/http-client.js';
import { TCPServerMirror } from './mirror/tcp-server.js';
import { RegistryMirror } from './mirror/registry-mirror.js';

// Re-export core types
export { Bassline } from './bassline.js';
export { ref, Ref, isRef, word, Word, isWord } from './types.js';

// Re-export mirrors
export { Cell, cell } from './mirror/cell.js';
export {
  SumFold,
  MaxFold,
  MinFold,
  AvgFold,
  CountFold,
  FirstFold,
  LastFold,
  ConcatFold,
  ListFold
} from './mirror/fold.js';
export { RemoteMirror } from './mirror/remote.js';
export { HTTPServerMirror } from './mirror/http-server.js';
export { HTTPClientMirror } from './mirror/http-client.js';
export { TCPServerMirror } from './mirror/tcp-server.js';
export { RegistryMirror } from './mirror/registry-mirror.js';
export { BaseMirror, isMirror } from './mirror/interface.js';

// Re-export serialization
export { serializeValue, reviveValue } from './mirror/serialize.js';

/**
 * Create a Bassline instance with standard middleware.
 *
 * @returns {Bassline}
 *
 * @example
 * const bl = createBassline();
 *
 * // Cell - mutable value
 * bl.write('bl:///cell/counter', 42);
 * bl.read('bl:///cell/counter'); // 42
 *
 * // Fold - computed from sources
 * bl.write('bl:///cell/a', 10);
 * bl.write('bl:///cell/b', 20);
 * bl.read('bl:///fold/sum?sources=bl:///cell/a,bl:///cell/b'); // 30
 *
 * // Registry - introspection
 * bl.read('bl:///registry/mirrors'); // ['bl:///cell/counter', ...]
 */
export function createBassline() {
  const bl = new Bassline();

  // Cell middleware
  bl.use('/cell', (ref, bl) => new Cell(ref, bl));

  // Fold middleware - each fold is explicit
  bl.use('/fold/sum', (ref, bl) => new SumFold(ref, bl));
  bl.use('/fold/max', (ref, bl) => new MaxFold(ref, bl));
  bl.use('/fold/min', (ref, bl) => new MinFold(ref, bl));
  bl.use('/fold/avg', (ref, bl) => new AvgFold(ref, bl));
  bl.use('/fold/count', (ref, bl) => new CountFold(ref, bl));
  bl.use('/fold/first', (ref, bl) => new FirstFold(ref, bl));
  bl.use('/fold/last', (ref, bl) => new LastFold(ref, bl));
  bl.use('/fold/concat', (ref, bl) => new ConcatFold(ref, bl));
  bl.use('/fold/list', (ref, bl) => new ListFold(ref, bl));

  // Remote middleware
  bl.use('/remote', (ref, bl) => new RemoteMirror(ref, bl));

  // HTTP middleware
  bl.use('/server/http', (ref, bl) => new HTTPServerMirror(ref, bl));
  bl.use('/http', (ref, bl) => new HTTPClientMirror(ref, bl));

  // TCP middleware (BL/T protocol)
  bl.use('/server/tcp', (ref, bl) => new TCPServerMirror(ref, bl));

  // Registry middleware - introspection
  bl.use('/registry', (ref, bl) => new RegistryMirror(ref, bl));

  return bl;
}
