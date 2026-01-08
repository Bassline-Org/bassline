/**
 * Semantic Types Index
 *
 * Register all semantic types here.
 */

import { registerSemantic } from '../lib/semantics'
import { FilterSemantic } from './filter'
import { MapSemantic } from './map'
import { TemplateSemantic } from './template'
import { ResourceSemantic } from './resource'
import { DisplaySemantic } from './display'
import { ReflectSemantic } from './reflect'
import { HelpSemantic } from './help'

// Register all semantics
registerSemantic({
  id: 'filter',
  name: 'Filter',
  icon: 'filter',
  component: FilterSemantic,
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

registerSemantic({
  id: 'resource',
  name: 'Resource',
  icon: 'terminal',
  component: ResourceSemantic,
})

registerSemantic({
  id: 'display',
  name: 'Display',
  icon: 'layout-grid',
  component: DisplaySemantic,
})

registerSemantic({
  id: 'reflect',
  name: 'Reflect',
  icon: 'refresh-cw',
  component: ReflectSemantic,
})

registerSemantic({
  id: 'help',
  name: 'Help',
  icon: 'help-circle',
  component: HelpSemantic,
})
