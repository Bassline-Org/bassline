/**
 * Semantic Types Index
 *
 * Register all semantic types here.
 */

import { registerSemantic } from '../lib/semantics'
import { JsonExportSemantic } from './json-export'
import { FilterSemantic } from './filter'
import { MergeSemantic } from './merge'
import { MapSemantic } from './map'
import { TemplateSemantic } from './template'

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

registerSemantic({
  id: 'merge',
  name: 'Merge',
  icon: 'git-merge',
  component: MergeSemantic,
})

registerSemantic({
  id: 'map',
  name: 'Map',
  icon: 'wand',
  component: MapSemantic,
})

registerSemantic({
  id: 'template',
  name: 'Template',
  icon: 'file-code',
  component: TemplateSemantic,
})
