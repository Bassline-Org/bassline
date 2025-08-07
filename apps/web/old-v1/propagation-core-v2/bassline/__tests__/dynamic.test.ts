import { describe, it, expect } from 'vitest'
import { exportGroupAsBassline } from '../export'
import { importBassline } from '../import'
import type { Group, GroupState, Contact } from '../../types'
import type { Bassline } from '../types'

describe('Dynamic Bassline Features', () => {
  describe('Dynamic Attributes', () => {
    it('should export groups with dynamic attribute configuration', () => {
      const group: Group = {
        id: 'dynamic-attrs',
        name: 'Dynamic Attributes Gadget',
        contactIds: ['@config', 'data', 'output'],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: ['@config', 'data', 'output'],
        attributes: {
          'bassline.dynamic-attributes': {
            enabled: true,
            contact: '@config',
            mode: 'merge',
          },
          'bassline.mutable': false,
          'permissions.modify': 'none',
        },
      }

      const contacts = new Map<string, Contact>([
        ['@config', {
          id: '@config',
          groupId: 'dynamic-attrs',
          blendMode: 'merge',
          isBoundary: true,
          boundaryDirection: 'input',
          name: 'Configuration',
        }],
        ['data', {
          id: 'data',
          groupId: 'dynamic-attrs',
          blendMode: 'accept-last',
          isBoundary: true,
          boundaryDirection: 'input',
        }],
        ['output', {
          id: 'output',
          groupId: 'dynamic-attrs',
          blendMode: 'accept-last',
          isBoundary: true,
          boundaryDirection: 'output',
        }],
      ])

      const state: GroupState = {
        group,
        contacts,
        wires: new Map(),
      }

      const bassline = exportGroupAsBassline(group, state)

      // Should preserve dynamic attribute configuration
      expect(bassline.attributes?.['bassline.dynamic-attributes']).toEqual({
        enabled: true,
        contact: '@config',
        mode: 'merge',
      })

      // Should detect @config as an attribute contact
      expect(bassline.interface?.attributes).toContain('@config')
      expect(bassline.interface?.inputs).toContain('data')
      expect(bassline.interface?.outputs).toContain('output')
    })

    it('should handle multiple attribute contacts', () => {
      const group: Group = {
        id: 'multi-attrs',
        name: 'Multiple Attribute Contacts',
        contactIds: ['@permissions', '@cache', '@timeout', 'data'],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: ['@permissions', '@cache', '@timeout', 'data'],
      }

      const contacts = new Map<string, Contact>([
        ['@permissions', {
          id: '@permissions',
          groupId: 'multi-attrs',
          blendMode: 'accept-last',
          isBoundary: true,
          boundaryDirection: 'input',
        }],
        ['@cache', {
          id: '@cache',
          groupId: 'multi-attrs',
          blendMode: 'accept-last',
          isBoundary: true,
          boundaryDirection: 'input',
        }],
        ['@timeout', {
          id: '@timeout',
          groupId: 'multi-attrs',
          blendMode: 'accept-last',
          isBoundary: true,
          boundaryDirection: 'input',
        }],
        ['data', {
          id: 'data',
          groupId: 'multi-attrs',
          blendMode: 'accept-last',
          isBoundary: true,
          boundaryDirection: 'input',
        }],
      ])

      const state: GroupState = {
        group,
        contacts,
        wires: new Map(),
      }

      const bassline = exportGroupAsBassline(group, state)

      // Should detect all @ contacts as attribute contacts
      expect(bassline.interface?.attributes).toHaveLength(3)
      expect(bassline.interface?.attributes).toContain('@permissions')
      expect(bassline.interface?.attributes).toContain('@cache')
      expect(bassline.interface?.attributes).toContain('@timeout')
      
      // Regular contacts should be in inputs
      expect(bassline.interface?.inputs).toContain('data')
    })

    it('should support attribute cycle configuration', () => {
      const group: Group = {
        id: 'cyclic-attrs',
        name: 'Cyclic Attributes',
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: [],
        attributes: {
          'bassline.attribute-cycles': {
            allowed: true,
            contradictionMode: 'merge',
            maxIterations: 10,
          },
        },
      }

      const state: GroupState = {
        group,
        contacts: new Map(),
        wires: new Map(),
      }

      const bassline = exportGroupAsBassline(group, state)

      expect(bassline.attributes?.['bassline.attribute-cycles']).toEqual({
        allowed: true,
        contradictionMode: 'merge',
        maxIterations: 10,
      })
    })
  })

  describe('Dynamic Topology', () => {
    it('should export groups with dynamic topology configuration', () => {
      const group: Group = {
        id: 'dynamic-topo',
        name: 'Dynamic Topology Gadget',
        contactIds: ['@schema', 'input', 'output'],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: ['@schema', 'input', 'output'],
        attributes: {
          'bassline.dynamic-topology': {
            enabled: true,
            schemaContact: '@schema',
            rebuildOn: 'change',
          },
          'bassline.pure': false,
        },
      }

      const contacts = new Map<string, Contact>([
        ['@schema', {
          id: '@schema',
          groupId: 'dynamic-topo',
          blendMode: 'accept-last',
          isBoundary: true,
          boundaryDirection: 'input',
          name: 'Network Schema',
        }],
        ['input', {
          id: 'input',
          groupId: 'dynamic-topo',
          blendMode: 'accept-last',
          isBoundary: true,
          boundaryDirection: 'input',
        }],
        ['output', {
          id: 'output',
          groupId: 'dynamic-topo',
          blendMode: 'accept-last',
          isBoundary: true,
          boundaryDirection: 'output',
        }],
      ])

      const state: GroupState = {
        group,
        contacts,
        wires: new Map(),
      }

      const bassline = exportGroupAsBassline(group, state)

      // Should preserve dynamic topology configuration
      expect(bassline.attributes?.['bassline.dynamic-topology']).toEqual({
        enabled: true,
        schemaContact: '@schema',
        rebuildOn: 'change',
      })

      // Should mark as not pure since topology can change
      expect(bassline.attributes?.['bassline.pure']).toBe(false)
    })

    it('should handle formula evaluator pattern', () => {
      // This is the canonical example of dynamic topology
      const formulaEvaluator: Group = {
        id: 'formula-eval',
        name: 'Formula Evaluator',
        contactIds: ['@formula', 'A1', 'A2', 'A3', 'result'],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: ['@formula', 'A1', 'A2', 'A3', 'result'],
        attributes: {
          'bassline.dynamic-topology': {
            enabled: true,
            schemaContact: '@formula',
            rebuildOn: 'change',
          },
          'x-spreadsheet.formula-syntax': 'excel',
          'x-spreadsheet.max-cells': 100,
        },
      }

      const contacts = new Map<string, Contact>([
        ['@formula', {
          id: '@formula',
          groupId: 'formula-eval',
          blendMode: 'accept-last',
          isBoundary: true,
          boundaryDirection: 'input',
          name: 'Formula AST',
        }],
        ['A1', {
          id: 'A1',
          groupId: 'formula-eval',
          blendMode: 'accept-last',
          isBoundary: true,
          boundaryDirection: 'input',
        }],
        ['A2', {
          id: 'A2',
          groupId: 'formula-eval',
          blendMode: 'accept-last',
          isBoundary: true,
          boundaryDirection: 'input',
        }],
        ['A3', {
          id: 'A3',
          groupId: 'formula-eval',
          blendMode: 'accept-last',
          isBoundary: true,
          boundaryDirection: 'input',
        }],
        ['result', {
          id: 'result',
          groupId: 'formula-eval',
          blendMode: 'accept-last',
          isBoundary: true,
          boundaryDirection: 'output',
        }],
      ])

      const state: GroupState = {
        group: formulaEvaluator,
        contacts,
        wires: new Map(),
      }

      const bassline = exportGroupAsBassline(formulaEvaluator, state)

      // Check all the pieces are in place
      expect(bassline.name).toBe('Formula Evaluator')
      expect(bassline.attributes?.['bassline.dynamic-topology']).toBeDefined()
      expect(bassline.interface?.attributes).toContain('@formula')
      expect(bassline.interface?.inputs).toContain('A1')
      expect(bassline.interface?.inputs).toContain('A2')
      expect(bassline.interface?.inputs).toContain('A3')
      expect(bassline.interface?.outputs).toContain('result')
      
      // Custom attributes should be preserved
      expect(bassline.attributes?.['x-spreadsheet.formula-syntax']).toBe('excel')
      expect(bassline.attributes?.['x-spreadsheet.max-cells']).toBe(100)
    })

    it('should handle network builder pattern', () => {
      // A gadget that builds networks from descriptions
      const networkBuilder: Group = {
        id: 'network-builder',
        name: 'Network Builder',
        contactIds: ['@network-spec', '@validation-rules', 'data-in', 'data-out'],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: ['@network-spec', '@validation-rules', 'data-in', 'data-out'],
        attributes: {
          'bassline.dynamic-topology': {
            enabled: true,
            schemaContact: '@network-spec',
            rebuildOn: 'explicit', // Only rebuild when explicitly triggered
          },
          'bassline.dynamic-attributes': {
            enabled: true,
            contact: '@validation-rules',
            mode: 'replace',
          },
          'x-meta.builder-version': '2.0',
        },
      }

      const contacts = new Map<string, Contact>([
        ['@network-spec', {
          id: '@network-spec',
          groupId: 'network-builder',
          blendMode: 'accept-last',
          isBoundary: true,
          boundaryDirection: 'input',
        }],
        ['@validation-rules', {
          id: '@validation-rules',
          groupId: 'network-builder',
          blendMode: 'merge',
          isBoundary: true,
          boundaryDirection: 'input',
        }],
        ['data-in', {
          id: 'data-in',
          groupId: 'network-builder',
          blendMode: 'accept-last',
          isBoundary: true,
          boundaryDirection: 'input',
        }],
        ['data-out', {
          id: 'data-out',
          groupId: 'network-builder',
          blendMode: 'accept-last',
          isBoundary: true,
          boundaryDirection: 'output',
        }],
      ])

      const state: GroupState = {
        group: networkBuilder,
        contacts,
        wires: new Map(),
      }

      const bassline = exportGroupAsBassline(networkBuilder, state)

      // Should have both dynamic topology AND dynamic attributes
      expect(bassline.attributes?.['bassline.dynamic-topology']).toBeDefined()
      expect(bassline.attributes?.['bassline.dynamic-attributes']).toBeDefined()
      
      // Should have multiple attribute contacts
      expect(bassline.interface?.attributes).toHaveLength(2)
      expect(bassline.interface?.attributes).toContain('@network-spec')
      expect(bassline.interface?.attributes).toContain('@validation-rules')
    })
  })

  describe('Progressive Lockdown', () => {
    it('should show progression from mutable to frozen', () => {
      // Stage 1: Exploration
      const explorationGroup: Group = {
        id: 'experiment',
        name: 'My Experiment',
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: [],
        attributes: {
          'bassline.mutable': true,
          'bassline.experimental': true,
          'permissions.modify': 'anyone',
        },
      }

      const explorationBassline = exportGroupAsBassline(explorationGroup, {
        group: explorationGroup,
        contacts: new Map(),
        wires: new Map(),
      })

      expect(explorationBassline.attributes?.['bassline.mutable']).toBe(true)
      expect(explorationBassline.attributes?.['permissions.modify']).toBe('anyone')

      // Stage 2: Testing
      const testingGroup: Group = {
        ...explorationGroup,
        attributes: {
          'bassline.mutable': true,
          'bassline.experimental': false,
          'permissions.modify': 'team',
          'validation.schema': '@schema-validator',
        },
      }

      const testingBassline = exportGroupAsBassline(testingGroup, {
        group: testingGroup,
        contacts: new Map(),
        wires: new Map(),
      })

      expect(testingBassline.attributes?.['bassline.mutable']).toBe(true)
      expect(testingBassline.attributes?.['permissions.modify']).toBe('team')
      expect(testingBassline.attributes?.['validation.schema']).toBeDefined()

      // Stage 3: Production
      const productionGroup: Group = {
        ...explorationGroup,
        attributes: {
          'bassline.mutable': false,
          'bassline.pure': true,
          'bassline.version': '1.0.0',
          'permissions.modify': 'none',
          'validation.upgrade': '@upgrade-validator',
          'runtime.cache': true,
        },
      }

      const productionBassline = exportGroupAsBassline(productionGroup, {
        group: productionGroup,
        contacts: new Map(),
        wires: new Map(),
      })

      expect(productionBassline.attributes?.['bassline.mutable']).toBe(false)
      expect(productionBassline.attributes?.['bassline.pure']).toBe(true)
      expect(productionBassline.attributes?.['permissions.modify']).toBe('none')
      expect(productionBassline.attributes?.['validation.upgrade']).toBeDefined()
    })
  })

  describe('Custom Attributes', () => {
    it('should preserve x- prefixed custom attributes', () => {
      const group: Group = {
        id: 'custom',
        name: 'Custom Attributes',
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: [],
        attributes: {
          // Well-known attributes
          'bassline.pure': true,
          // Custom attributes
          'x-ml.model': 'gpt-2',
          'x-ml.gpu-required': true,
          'x-audio.sample-rate': 44100,
          'x-custom.nested': {
            field: 'value',
            number: 42,
          },
        },
      }

      const state: GroupState = {
        group,
        contacts: new Map(),
        wires: new Map(),
      }

      const bassline = exportGroupAsBassline(group, state)

      // All custom attributes should be preserved
      expect(bassline.attributes?.['x-ml.model']).toBe('gpt-2')
      expect(bassline.attributes?.['x-ml.gpu-required']).toBe(true)
      expect(bassline.attributes?.['x-audio.sample-rate']).toBe(44100)
      expect(bassline.attributes?.['x-custom.nested']).toEqual({
        field: 'value',
        number: 42,
      })
    })
  })
})