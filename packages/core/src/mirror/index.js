/**
 * Mirror System - Public API
 *
 * Mirrors are reflective objects that provide controlled reification
 * and intercession for resources identified by URIs.
 */

// Interface
export { isMirror, BaseMirror } from './interface.js';

// Mirror types
export { Cell, cell } from './cell.js';
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
} from './fold.js';
export { RemoteMirror } from './remote.js';

// Serialization
export { serializeValue, reviveValue } from './serialize.js';

// Re-export Ref from types
export { Ref, ref, isRef } from '../types.js';
