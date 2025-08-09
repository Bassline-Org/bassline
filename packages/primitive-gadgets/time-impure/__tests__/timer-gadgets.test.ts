/**
 * Tests for timer gadgets using real propagation networks
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { Kernel } from '@bassline/core'
import { UserspaceRuntime, PrimitiveLoaderDriver } from '@bassline/core'
import { brand } from '@bassline/core'
import * as timerGadgets from '../src/timer'
import * as dateGadgets from '../src/date'

describe('Timer Gadgets', () => {
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
    
    // Load timer gadgets
    await primitiveLoader.loadModule({
      type: 'builtin',
      module: async () => ({ ...timerGadgets, ...dateGadgets }),
      namespace: '@time'
    })
  })
  
  describe('now', () => {
    it('should get current timestamp', async () => {
      const beforeTime = Date.now()
      
      // Create root group
      const rootGroupId = brand.groupId('root')
      await runtime.registerGroup({
        id: rootGroupId,
        name: 'Now Test',
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: []
      })
      
      // Create now gadget
      const nowGadgetId = await runtime.createPrimitiveGadget('@time/now', rootGroupId)
      const state = await runtime.getState(nowGadgetId)
      
      const triggerInput = Array.from(state.contacts.values())
        .find(c => c.name === 'trigger' && c.boundaryDirection === 'input')
      const timestampOutput = Array.from(state.contacts.values())
        .find(c => c.name === 'timestamp' && c.boundaryDirection === 'output')
      const isoOutput = Array.from(state.contacts.values())
        .find(c => c.name === 'iso' && c.boundaryDirection === 'output')
      const unixOutput = Array.from(state.contacts.values())
        .find(c => c.name === 'unix' && c.boundaryDirection === 'output')
      
      // Trigger now
      await runtime.scheduleUpdate(triggerInput!.id, true)
      
      // Wait for propagation
      await new Promise(resolve => setTimeout(resolve, 50))
      
      const afterTime = Date.now()
      
      // Check results
      const result = await runtime.getState(nowGadgetId)
      const timestamp = result.contacts.get(timestampOutput!.id)?.content as number
      const iso = result.contacts.get(isoOutput!.id)?.content as string
      const unix = result.contacts.get(unixOutput!.id)?.content as number
      
      // Timestamp should be between before and after
      expect(timestamp).toBeGreaterThanOrEqual(beforeTime)
      expect(timestamp).toBeLessThanOrEqual(afterTime)
      
      // ISO string should be valid
      expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
      
      // Unix timestamp should be seconds
      expect(unix).toBe(Math.floor(timestamp / 1000))
    })
  })
  
  describe('delay', () => {
    it('should delay value propagation', async () => {
      const testValue = 'delayed value'
      const delayMs = 100
      
      // Create root group
      const rootGroupId = brand.groupId('root')
      await runtime.registerGroup({
        id: rootGroupId,
        name: 'Delay Test',
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: []
      })
      
      // Create delay gadget
      const delayGadgetId = await runtime.createPrimitiveGadget('@time/delay', rootGroupId)
      const state = await runtime.getState(delayGadgetId)
      
      const valueInput = Array.from(state.contacts.values())
        .find(c => c.name === 'value' && c.boundaryDirection === 'input')
      const millisecondsInput = Array.from(state.contacts.values())
        .find(c => c.name === 'milliseconds' && c.boundaryDirection === 'input')
      const valueOutput = Array.from(state.contacts.values())
        .find(c => c.name === 'value' && c.boundaryDirection === 'output')
      const elapsedOutput = Array.from(state.contacts.values())
        .find(c => c.name === 'elapsed' && c.boundaryDirection === 'output')
      
      // Set delay and value
      const startTime = Date.now()
      await runtime.scheduleUpdate(valueInput!.id, testValue)
      await runtime.scheduleUpdate(millisecondsInput!.id, delayMs)
      
      // Wait for propagation (should include delay)
      await new Promise(resolve => setTimeout(resolve, delayMs + 50))
      
      const endTime = Date.now()
      
      // Check results
      const result = await runtime.getState(delayGadgetId)
      const value = result.contacts.get(valueOutput!.id)?.content
      const elapsed = result.contacts.get(elapsedOutput!.id)?.content as number
      
      expect(value).toBe(testValue)
      expect(elapsed).toBeGreaterThanOrEqual(delayMs - 10) // Allow some tolerance
      expect(endTime - startTime).toBeGreaterThanOrEqual(delayMs)
    })
  })
  
  describe('formatDate', () => {
    it('should format dates according to pattern', async () => {
      const testDate = '2024-01-15T10:30:00.000Z'
      const formatPattern = 'yyyy-MM-dd HH:mm'
      
      // Create root group
      const rootGroupId = brand.groupId('root')
      await runtime.registerGroup({
        id: rootGroupId,
        name: 'Format Date Test',
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: []
      })
      
      // Create formatDate gadget
      const formatGadgetId = await runtime.createPrimitiveGadget('@time/formatDate', rootGroupId)
      const state = await runtime.getState(formatGadgetId)
      
      const dateInput = Array.from(state.contacts.values())
        .find(c => c.name === 'date' && c.boundaryDirection === 'input')
      const formatInput = Array.from(state.contacts.values())
        .find(c => c.name === 'format' && c.boundaryDirection === 'input')
      const formattedOutput = Array.from(state.contacts.values())
        .find(c => c.name === 'formatted' && c.boundaryDirection === 'output')
      
      // Format date
      await runtime.scheduleUpdate(dateInput!.id, testDate)
      await runtime.scheduleUpdate(formatInput!.id, formatPattern)
      
      // Wait for propagation
      await new Promise(resolve => setTimeout(resolve, 50))
      
      // Check result
      const result = await runtime.getState(formatGadgetId)
      const formatted = result.contacts.get(formattedOutput!.id)?.content
      
      expect(formatted).toBe('2024-01-15 10:30')
    })
    
    it('should handle different date input types', async () => {
      // Create root group
      const rootGroupId = brand.groupId('root')
      await runtime.registerGroup({
        id: rootGroupId,
        name: 'Date Input Types Test',
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: []
      })
      
      // Create formatDate gadget
      const formatGadgetId = await runtime.createPrimitiveGadget('@time/formatDate', rootGroupId)
      const state = await runtime.getState(formatGadgetId)
      
      const dateInput = Array.from(state.contacts.values())
        .find(c => c.name === 'date' && c.boundaryDirection === 'input')
      const formatInput = Array.from(state.contacts.values())
        .find(c => c.name === 'format' && c.boundaryDirection === 'input')
      const formattedOutput = Array.from(state.contacts.values())
        .find(c => c.name === 'formatted' && c.boundaryDirection === 'output')
      
      // Test with timestamp
      const timestamp = new Date('2024-01-15').getTime()
      await runtime.scheduleUpdate(dateInput!.id, timestamp)
      await runtime.scheduleUpdate(formatInput!.id, 'yyyy-MM-dd')
      
      // Wait for propagation
      await new Promise(resolve => setTimeout(resolve, 50))
      
      // Check result
      const result = await runtime.getState(formatGadgetId)
      const formatted = result.contacts.get(formattedOutput!.id)?.content
      
      expect(formatted).toBe('2024-01-15')
    })
  })
  
  describe('dateDiff', () => {
    it('should calculate difference between dates', async () => {
      const date1 = '2024-01-01T00:00:00.000Z'
      const date2 = '2024-01-08T00:00:00.000Z'
      
      // Create root group
      const rootGroupId = brand.groupId('root')
      await runtime.registerGroup({
        id: rootGroupId,
        name: 'Date Diff Test',
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: []
      })
      
      // Create dateDiff gadget
      const diffGadgetId = await runtime.createPrimitiveGadget('@time/dateDiff', rootGroupId)
      const state = await runtime.getState(diffGadgetId)
      
      const date1Input = Array.from(state.contacts.values())
        .find(c => c.name === 'date1' && c.boundaryDirection === 'input')
      const date2Input = Array.from(state.contacts.values())
        .find(c => c.name === 'date2' && c.boundaryDirection === 'input')
      const unitInput = Array.from(state.contacts.values())
        .find(c => c.name === 'unit' && c.boundaryDirection === 'input')
      const differenceOutput = Array.from(state.contacts.values())
        .find(c => c.name === 'difference' && c.boundaryDirection === 'output')
      
      // Calculate difference in days
      await runtime.scheduleUpdate(date1Input!.id, date1)
      await runtime.scheduleUpdate(date2Input!.id, date2)
      await runtime.scheduleUpdate(unitInput!.id, 'days')
      
      // Wait for propagation
      await new Promise(resolve => setTimeout(resolve, 50))
      
      // Check result
      let result = await runtime.getState(diffGadgetId)
      let difference = result.contacts.get(differenceOutput!.id)?.content
      
      expect(difference).toBe(7) // 7 days difference
      
      // Test with hours
      await runtime.scheduleUpdate(unitInput!.id, 'hours')
      await new Promise(resolve => setTimeout(resolve, 50))
      
      result = await runtime.getState(diffGadgetId)
      difference = result.contacts.get(differenceOutput!.id)?.content
      
      expect(difference).toBe(7 * 24) // 168 hours
    })
  })
  
  describe('dateAdd', () => {
    it('should add duration to date', async () => {
      const startDate = '2024-01-15T00:00:00.000Z'
      
      // Create root group
      const rootGroupId = brand.groupId('root')
      await runtime.registerGroup({
        id: rootGroupId,
        name: 'Date Add Test',
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: []
      })
      
      // Create dateAdd gadget
      const addGadgetId = await runtime.createPrimitiveGadget('@time/dateAdd', rootGroupId)
      const state = await runtime.getState(addGadgetId)
      
      const dateInput = Array.from(state.contacts.values())
        .find(c => c.name === 'date' && c.boundaryDirection === 'input')
      const amountInput = Array.from(state.contacts.values())
        .find(c => c.name === 'amount' && c.boundaryDirection === 'input')
      const unitInput = Array.from(state.contacts.values())
        .find(c => c.name === 'unit' && c.boundaryDirection === 'input')
      const resultOutput = Array.from(state.contacts.values())
        .find(c => c.name === 'result' && c.boundaryDirection === 'output')
      
      // Add 5 days
      await runtime.scheduleUpdate(dateInput!.id, startDate)
      await runtime.scheduleUpdate(amountInput!.id, 5)
      await runtime.scheduleUpdate(unitInput!.id, 'days')
      
      // Wait for propagation
      await new Promise(resolve => setTimeout(resolve, 50))
      
      // Check result
      const result = await runtime.getState(addGadgetId)
      const resultDate = result.contacts.get(resultOutput!.id)?.content
      
      expect(resultDate).toBe('2024-01-20T00:00:00.000Z')
    })
  })
})