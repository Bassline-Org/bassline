/**
 * Tests for data validation gadgets using real propagation networks
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { Kernel } from '@bassline/core'
import { UserspaceRuntime } from '@bassline/core/src/kernel/userspace-runtime'
import { PrimitiveLoaderDriver } from '@bassline/core/src/kernel/drivers/primitive-loader-driver'
import { brand } from '@bassline/core'
import * as validationGadgets from '../src/validation'

describe('Data Validation Gadgets', () => {
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
    
    // Load validation gadgets
    await primitiveLoader.loadModule({
      type: 'builtin',
      module: async () => validationGadgets,
      namespace: '@data/validation'
    })
  })
  
  describe('validateEmail', () => {
    it('should validate correct email addresses', async () => {
      // Create root group
      const rootGroupId = brand.groupId('root')
      await runtime.registerGroup({
        id: rootGroupId,
        name: 'Email Validation Test',
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: []
      })
      
      // Create validateEmail gadget
      const emailGadgetId = await runtime.createPrimitiveGadget('@data/validation/validateEmail', rootGroupId)
      const state = await runtime.getState(emailGadgetId)
      
      const emailInput = Array.from(state.contacts.values())
        .find(c => c.name === 'email' && c.boundaryDirection === 'input')
      const validOutput = Array.from(state.contacts.values())
        .find(c => c.name === 'valid' && c.boundaryDirection === 'output')
      
      // Test valid email
      await runtime.scheduleUpdate(emailInput!.id, 'user@example.com')
      
      // Wait for propagation
      await new Promise(resolve => setTimeout(resolve, 50))
      
      // Check result
      const result = await runtime.getState(emailGadgetId)
      const valid = result.contacts.get(validOutput!.id)?.content
      expect(valid).toBe(true)
    })
    
    it('should reject invalid email addresses', async () => {
      // Create root group
      const rootGroupId = brand.groupId('root')
      await runtime.registerGroup({
        id: rootGroupId,
        name: 'Invalid Email Test',
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: []
      })
      
      // Create validateEmail gadget
      const emailGadgetId = await runtime.createPrimitiveGadget('@data/validation/validateEmail', rootGroupId)
      const state = await runtime.getState(emailGadgetId)
      
      const emailInput = Array.from(state.contacts.values())
        .find(c => c.name === 'email' && c.boundaryDirection === 'input')
      const validOutput = Array.from(state.contacts.values())
        .find(c => c.name === 'valid' && c.boundaryDirection === 'output')
      const errorOutput = Array.from(state.contacts.values())
        .find(c => c.name === 'error' && c.boundaryDirection === 'output')
      
      // Test invalid email
      await runtime.scheduleUpdate(emailInput!.id, 'not-an-email')
      
      // Wait for propagation
      await new Promise(resolve => setTimeout(resolve, 50))
      
      // Check result
      const result = await runtime.getState(emailGadgetId)
      const valid = result.contacts.get(validOutput!.id)?.content
      const error = result.contacts.get(errorOutput!.id)?.content
      
      expect(valid).toBe(false)
      expect(error).toBe('Invalid email format')
    })
  })
  
  describe('validateUrl', () => {
    it('should validate and parse URLs', async () => {
      const testUrl = 'https://example.com:8080/path?query=value#hash'
      
      // Create root group
      const rootGroupId = brand.groupId('root')
      await runtime.registerGroup({
        id: rootGroupId,
        name: 'URL Validation Test',
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: []
      })
      
      // Create validateUrl gadget
      const urlGadgetId = await runtime.createPrimitiveGadget('@data/validation/validateUrl', rootGroupId)
      const state = await runtime.getState(urlGadgetId)
      
      const urlInput = Array.from(state.contacts.values())
        .find(c => c.name === 'url' && c.boundaryDirection === 'input')
      const validOutput = Array.from(state.contacts.values())
        .find(c => c.name === 'valid' && c.boundaryDirection === 'output')
      const parsedOutput = Array.from(state.contacts.values())
        .find(c => c.name === 'parsed' && c.boundaryDirection === 'output')
      
      // Validate URL
      await runtime.scheduleUpdate(urlInput!.id, testUrl)
      
      // Wait for propagation
      await new Promise(resolve => setTimeout(resolve, 50))
      
      // Check result
      const result = await runtime.getState(urlGadgetId)
      const valid = result.contacts.get(validOutput!.id)?.content
      const parsed = result.contacts.get(parsedOutput!.id)?.content as any
      
      expect(valid).toBe(true)
      expect(parsed.protocol).toBe('https:')
      expect(parsed.hostname).toBe('example.com')
      expect(parsed.port).toBe('8080')
      expect(parsed.pathname).toBe('/path')
      expect(parsed.search).toBe('?query=value')
      expect(parsed.hash).toBe('#hash')
    })
  })
  
  describe('validateSchema', () => {
    it('should validate data against JSON Schema', async () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number', minimum: 0 },
          email: { type: 'string', format: 'email' }
        },
        required: ['name', 'age']
      }
      
      const validData = {
        name: 'Alice',
        age: 30,
        email: 'alice@example.com'
      }
      
      // Create root group
      const rootGroupId = brand.groupId('root')
      await runtime.registerGroup({
        id: rootGroupId,
        name: 'Schema Validation Test',
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: []
      })
      
      // Create validateSchema gadget
      const schemaGadgetId = await runtime.createPrimitiveGadget('@data/validation/validateSchema', rootGroupId)
      const state = await runtime.getState(schemaGadgetId)
      
      const dataInput = Array.from(state.contacts.values())
        .find(c => c.name === 'data' && c.boundaryDirection === 'input')
      const schemaInput = Array.from(state.contacts.values())
        .find(c => c.name === 'schema' && c.boundaryDirection === 'input')
      const validOutput = Array.from(state.contacts.values())
        .find(c => c.name === 'valid' && c.boundaryDirection === 'output')
      
      // Validate data
      await runtime.scheduleUpdate(dataInput!.id, validData)
      await runtime.scheduleUpdate(schemaInput!.id, schema)
      
      // Wait for propagation
      await new Promise(resolve => setTimeout(resolve, 50))
      
      // Check result
      const result = await runtime.getState(schemaGadgetId)
      const valid = result.contacts.get(validOutput!.id)?.content
      expect(valid).toBe(true)
    })
    
    it('should report schema validation errors', async () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number', minimum: 0 }
        },
        required: ['name', 'age']
      }
      
      const invalidData = {
        name: 'Bob',
        age: -5 // Invalid: negative age
      }
      
      // Create root group
      const rootGroupId = brand.groupId('root')
      await runtime.registerGroup({
        id: rootGroupId,
        name: 'Schema Error Test',
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: []
      })
      
      // Create validateSchema gadget
      const schemaGadgetId = await runtime.createPrimitiveGadget('@data/validation/validateSchema', rootGroupId)
      const state = await runtime.getState(schemaGadgetId)
      
      const dataInput = Array.from(state.contacts.values())
        .find(c => c.name === 'data' && c.boundaryDirection === 'input')
      const schemaInput = Array.from(state.contacts.values())
        .find(c => c.name === 'schema' && c.boundaryDirection === 'input')
      const validOutput = Array.from(state.contacts.values())
        .find(c => c.name === 'valid' && c.boundaryDirection === 'output')
      const errorsOutput = Array.from(state.contacts.values())
        .find(c => c.name === 'errors' && c.boundaryDirection === 'output')
      
      // Validate invalid data
      await runtime.scheduleUpdate(dataInput!.id, invalidData)
      await runtime.scheduleUpdate(schemaInput!.id, schema)
      
      // Wait for propagation
      await new Promise(resolve => setTimeout(resolve, 50))
      
      // Check result
      const result = await runtime.getState(schemaGadgetId)
      const valid = result.contacts.get(validOutput!.id)?.content
      const errors = result.contacts.get(errorsOutput!.id)?.content as any[]
      
      expect(valid).toBe(false)
      expect(errors).toHaveLength(1)
      expect(errors[0]).toHaveProperty('instancePath', '/age')
    })
  })
  
  describe('validateRange', () => {
    it('should validate and clamp numbers within range', async () => {
      // Create root group
      const rootGroupId = brand.groupId('root')
      await runtime.registerGroup({
        id: rootGroupId,
        name: 'Range Validation Test',
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: []
      })
      
      // Create validateRange gadget
      const rangeGadgetId = await runtime.createPrimitiveGadget('@data/validation/validateRange', rootGroupId)
      const state = await runtime.getState(rangeGadgetId)
      
      const valueInput = Array.from(state.contacts.values())
        .find(c => c.name === 'value' && c.boundaryDirection === 'input')
      const minInput = Array.from(state.contacts.values())
        .find(c => c.name === 'min' && c.boundaryDirection === 'input')
      const maxInput = Array.from(state.contacts.values())
        .find(c => c.name === 'max' && c.boundaryDirection === 'input')
      const validOutput = Array.from(state.contacts.values())
        .find(c => c.name === 'valid' && c.boundaryDirection === 'output')
      const clampedOutput = Array.from(state.contacts.values())
        .find(c => c.name === 'clamped' && c.boundaryDirection === 'output')
      
      // Test value within range
      await runtime.scheduleUpdate(valueInput!.id, 5)
      await runtime.scheduleUpdate(minInput!.id, 0)
      await runtime.scheduleUpdate(maxInput!.id, 10)
      
      // Wait for propagation
      await new Promise(resolve => setTimeout(resolve, 50))
      
      // Check result
      let result = await runtime.getState(rangeGadgetId)
      let valid = result.contacts.get(validOutput!.id)?.content
      let clamped = result.contacts.get(clampedOutput!.id)?.content
      
      expect(valid).toBe(true)
      expect(clamped).toBe(5)
      
      // Test value below minimum
      await runtime.scheduleUpdate(valueInput!.id, -5)
      await new Promise(resolve => setTimeout(resolve, 50))
      
      result = await runtime.getState(rangeGadgetId)
      valid = result.contacts.get(validOutput!.id)?.content
      clamped = result.contacts.get(clampedOutput!.id)?.content
      
      expect(valid).toBe(false)
      expect(clamped).toBe(0) // Clamped to minimum
      
      // Test value above maximum
      await runtime.scheduleUpdate(valueInput!.id, 15)
      await new Promise(resolve => setTimeout(resolve, 50))
      
      result = await runtime.getState(rangeGadgetId)
      valid = result.contacts.get(validOutput!.id)?.content
      clamped = result.contacts.get(clampedOutput!.id)?.content
      
      expect(valid).toBe(false)
      expect(clamped).toBe(10) // Clamped to maximum
    })
  })
})