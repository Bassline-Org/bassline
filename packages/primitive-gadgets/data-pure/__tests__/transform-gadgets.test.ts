/**
 * Tests for data transformation gadgets using real propagation networks
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { Kernel } from '@bassline/core'
import { UserspaceRuntime, PrimitiveLoaderDriver } from '@bassline/core'
import { brand } from '@bassline/core'
import * as transformGadgets from '../src/transform'

describe('Data Transformation Gadgets', () => {
  let kernel: Kernel
  let runtime: UserspaceRuntime
  let primitiveLoader: PrimitiveLoaderDriver
  
  beforeEach(async () => {
    // Set up kernel and runtime
    kernel = new Kernel({ debug: false })
    runtime = new UserspaceRuntime({ kernel })
    
    await kernel.initializeSystemDrivers()
    kernel.setUserspaceRuntime(runtime)
    
    primitiveLoader = kernel.getPrimitiveLoader()!
    runtime.setPrimitiveLoader(primitiveLoader)
    
    const schedulerDriver = kernel.getSchedulerDriver()
    if (schedulerDriver) {
      runtime.setSchedulerDriver(schedulerDriver)
    }
    
    // Load transform gadgets
    await primitiveLoader.loadModule({
      type: 'builtin',
      module: async () => transformGadgets,
      namespace: '@data/transform'
    })
  })
  
  describe('JSON operations', () => {
    it('should parse and stringify JSON through connected gadgets', async () => {
      const testData = { name: 'Bassline', version: 1, features: ['propagation', 'gadgets'] }
      const jsonString = JSON.stringify(testData)
      
      // Create root group
      const rootGroupId = brand.groupId('root')
      await runtime.registerGroup({
        id: rootGroupId,
        name: 'JSON Test',
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: []
      })
      
      // Create parse gadget
      const parseGadgetId = await runtime.createPrimitiveGadget('@data/transform/jsonParse', rootGroupId)
      const parseState = await runtime.getState(parseGadgetId)
      
      const parseTextInput = Array.from(parseState.contacts.values())
        .find(c => c.name === 'text' && c.boundaryDirection === 'input')
      const parseDataOutput = Array.from(parseState.contacts.values())
        .find(c => c.name === 'data' && c.boundaryDirection === 'output')
      
      // Create stringify gadget
      const stringifyGadgetId = await runtime.createPrimitiveGadget('@data/transform/jsonStringify', rootGroupId)
      const stringifyState = await runtime.getState(stringifyGadgetId)
      
      const stringifyDataInput = Array.from(stringifyState.contacts.values())
        .find(c => c.name === 'data' && c.boundaryDirection === 'input')
      const stringifyIndentInput = Array.from(stringifyState.contacts.values())
        .find(c => c.name === 'indent' && c.boundaryDirection === 'input')
      const stringifyTextOutput = Array.from(stringifyState.contacts.values())
        .find(c => c.name === 'text' && c.boundaryDirection === 'output')
      
      // Wire parse output to stringify input
      await runtime.connect(parseDataOutput!.id, stringifyDataInput!.id)
      
      // Parse JSON
      await runtime.scheduleUpdate(parseTextInput!.id, jsonString)
      
      // Set indent for pretty printing
      await runtime.scheduleUpdate(stringifyIndentInput!.id, 2)
      
      // Wait for propagation
      await new Promise(resolve => setTimeout(resolve, 50))
      
      // Check parse result
      const parseResult = await runtime.getState(parseGadgetId)
      const parsedData = parseResult.contacts.get(parseDataOutput!.id)?.content
      expect(parsedData).toEqual(testData)
      
      // Check stringify result
      const stringifyResult = await runtime.getState(stringifyGadgetId)
      const stringifiedText = stringifyResult.contacts.get(stringifyTextOutput!.id)?.content
      const reparsed = JSON.parse(stringifiedText as string)
      expect(reparsed).toEqual(testData)
    })
    
    it('should handle JSON parse errors', async () => {
      const invalidJson = '{ invalid json }'
      
      // Create root group
      const rootGroupId = brand.groupId('root')
      await runtime.registerGroup({
        id: rootGroupId,
        name: 'JSON Error Test',
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: []
      })
      
      // Create parse gadget
      const parseGadgetId = await runtime.createPrimitiveGadget('@data/transform/jsonParse', rootGroupId)
      const parseState = await runtime.getState(parseGadgetId)
      
      const textInput = Array.from(parseState.contacts.values())
        .find(c => c.name === 'text' && c.boundaryDirection === 'input')
      const errorOutput = Array.from(parseState.contacts.values())
        .find(c => c.name === 'error' && c.boundaryDirection === 'output')
      
      // Try to parse invalid JSON
      await runtime.scheduleUpdate(textInput!.id, invalidJson)
      
      // Wait for propagation
      await new Promise(resolve => setTimeout(resolve, 50))
      
      // Check error was captured
      const result = await runtime.getState(parseGadgetId)
      const error = result.contacts.get(errorOutput!.id)?.content
      expect(error).toContain('JSON')
    })
  })
  
  describe('CSV operations', () => {
    it('should parse and stringify CSV data', async () => {
      const csvText = 'name,age,city\nAlice,30,NYC\nBob,25,LA'
      
      // Create root group
      const rootGroupId = brand.groupId('root')
      await runtime.registerGroup({
        id: rootGroupId,
        name: 'CSV Test',
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: []
      })
      
      // Create CSV parse gadget
      const parseGadgetId = await runtime.createPrimitiveGadget('@data/transform/csvParse', rootGroupId)
      const parseState = await runtime.getState(parseGadgetId)
      
      const textInput = Array.from(parseState.contacts.values())
        .find(c => c.name === 'text' && c.boundaryDirection === 'input')
      const dataOutput = Array.from(parseState.contacts.values())
        .find(c => c.name === 'data' && c.boundaryDirection === 'output')
      
      // Parse CSV
      await runtime.scheduleUpdate(textInput!.id, csvText)
      
      // Wait for propagation
      await new Promise(resolve => setTimeout(resolve, 50))
      
      // Check result
      const result = await runtime.getState(parseGadgetId)
      const data = result.contacts.get(dataOutput!.id)?.content as any[]
      
      expect(data).toHaveLength(2)
      expect(data[0]).toEqual({ name: 'Alice', age: 30, city: 'NYC' })
      expect(data[1]).toEqual({ name: 'Bob', age: 25, city: 'LA' })
    })
    
    it('should handle custom delimiters', async () => {
      const tsvText = 'name\tage\tcity\nAlice\t30\tNYC'
      
      // Create root group
      const rootGroupId = brand.groupId('root')
      await runtime.registerGroup({
        id: rootGroupId,
        name: 'TSV Test',
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: []
      })
      
      // Create CSV parse gadget
      const parseGadgetId = await runtime.createPrimitiveGadget('@data/transform/csvParse', rootGroupId)
      const parseState = await runtime.getState(parseGadgetId)
      
      const textInput = Array.from(parseState.contacts.values())
        .find(c => c.name === 'text' && c.boundaryDirection === 'input')
      const delimiterInput = Array.from(parseState.contacts.values())
        .find(c => c.name === 'delimiter' && c.boundaryDirection === 'input')
      const dataOutput = Array.from(parseState.contacts.values())
        .find(c => c.name === 'data' && c.boundaryDirection === 'output')
      
      // Parse TSV with tab delimiter
      await runtime.scheduleUpdate(textInput!.id, tsvText)
      await runtime.scheduleUpdate(delimiterInput!.id, '\t')
      
      // Wait for propagation
      await new Promise(resolve => setTimeout(resolve, 50))
      
      // Check result
      const result = await runtime.getState(parseGadgetId)
      const data = result.contacts.get(dataOutput!.id)?.content as any[]
      
      expect(data).toHaveLength(1)
      expect(data[0]).toEqual({ name: 'Alice', age: 30, city: 'NYC' })
    })
  })
  
  describe('Base64 operations', () => {
    it('should encode and decode Base64', async () => {
      const originalText = 'Hello, Bassline!'
      
      // Create root group
      const rootGroupId = brand.groupId('root')
      await runtime.registerGroup({
        id: rootGroupId,
        name: 'Base64 Test',
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: []
      })
      
      // Create encode gadget
      const encodeGadgetId = await runtime.createPrimitiveGadget('@data/transform/base64Encode', rootGroupId)
      const encodeState = await runtime.getState(encodeGadgetId)
      
      const encodeDataInput = Array.from(encodeState.contacts.values())
        .find(c => c.name === 'data' && c.boundaryDirection === 'input')
      const encodeOutput = Array.from(encodeState.contacts.values())
        .find(c => c.name === 'encoded' && c.boundaryDirection === 'output')
      
      // Create decode gadget
      const decodeGadgetId = await runtime.createPrimitiveGadget('@data/transform/base64Decode', rootGroupId)
      const decodeState = await runtime.getState(decodeGadgetId)
      
      const decodeEncodedInput = Array.from(decodeState.contacts.values())
        .find(c => c.name === 'encoded' && c.boundaryDirection === 'input')
      const decodeDataOutput = Array.from(decodeState.contacts.values())
        .find(c => c.name === 'data' && c.boundaryDirection === 'output')
      
      // Wire encode output to decode input
      await runtime.connect(encodeOutput!.id, decodeEncodedInput!.id)
      
      // Encode text
      await runtime.scheduleUpdate(encodeDataInput!.id, originalText)
      
      // Wait for propagation
      await new Promise(resolve => setTimeout(resolve, 50))
      
      // Check encoded result
      const encodeResult = await runtime.getState(encodeGadgetId)
      const encoded = encodeResult.contacts.get(encodeOutput!.id)?.content
      expect(encoded).toBe(Buffer.from(originalText).toString('base64'))
      
      // Check decoded result
      const decodeResult = await runtime.getState(decodeGadgetId)
      const decoded = decodeResult.contacts.get(decodeDataOutput!.id)?.content
      expect(decoded).toBe(originalText)
    })
  })
})