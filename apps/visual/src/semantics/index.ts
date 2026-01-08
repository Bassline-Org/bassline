/**
 * Semantic Types Index
 *
 * Register all semantic types here.
 */

import { registerSemantic } from '../lib/semantics'
import { JsonExportSemantic } from './json-export'

// Register all semantics
registerSemantic({
  id: 'json-export',
  name: 'JSON Export',
  icon: 'file-json',
  component: JsonExportSemantic,
})
