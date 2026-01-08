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

// Block semantics
import { TextSemantic } from './text'
import { NumberSemantic } from './number'
import { ListSemantic } from './list'
import { ObjectSemantic } from './object'
import { DocumentSemantic } from './document'

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

// Block semantics
registerSemantic({
  id: 'text',
  name: 'Text',
  icon: 'type',
  component: TextSemantic,
})

registerSemantic({
  id: 'number',
  name: 'Number',
  icon: 'hash',
  component: NumberSemantic,
})

registerSemantic({
  id: 'list',
  name: 'List',
  icon: 'list',
  component: ListSemantic,
})

registerSemantic({
  id: 'object',
  name: 'Object',
  icon: 'braces',
  component: ObjectSemantic,
})

registerSemantic({
  id: 'document',
  name: 'Document',
  icon: 'file-text',
  component: DocumentSemantic,
})
