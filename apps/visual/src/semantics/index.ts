/**
 * Semantic Types Index
 *
 * Register all semantic types here.
 */

import { registerSemantic } from '../lib/semantics'
import { JsonExportSemantic } from './json-export'
import { FilterSemantic } from './filter'

// Register all semantics
registerSemantic({
  id: 'json-export',
  name: 'JSON Export',
  icon: 'file-json',
  component: JsonExportSemantic,
})

registerSemantic({
  id: 'filter',
  name: 'Filter',
  icon: 'filter',
  component: FilterSemantic,
})
