export { createCellRoutes } from './cell.js'
export { lattices, getLattice, maxNumber, minNumber, setUnion, lww } from './lattices.js'

// Fuzzy cells - intelligent compaction
export { FuzzyCell } from './fuzzy.js'
export { createFuzzyCellRoutes } from './fuzzy-routes.js'
export {
  createKnowledgeCompactor,
  createDedupeCompactor,
  createTimeWindowCompactor,
  createSlidingWindowCompactor,
  createCompositeCompactor
} from './compactors.js'

// Upgrade modules for dynamic installation
export { default as upgradeCells } from './upgrade.js'
