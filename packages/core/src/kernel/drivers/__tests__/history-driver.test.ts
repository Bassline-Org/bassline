import { describe, it, expect, beforeEach, vi } from 'vitest'
import { HistoryDriver } from '../history-driver'
import type { ContactChange } from '../../types'
import type { Kernel } from '../../kernel'
import { brand } from '../../../types'

describe('HistoryDriver', () => {
  let history: HistoryDriver
  let mockKernel: Kernel
  
  beforeEach(() => {
    history = new HistoryDriver('test-history', {
      maxHistorySize: 10,
      captureInterval: 50
    })
    
    mockKernel = {
      handleChange: vi.fn().mockResolvedValue({ status: 'accepted' })
    } as any
    
    history.setKernel(mockKernel)
  })
  
  describe('initialization', () => {
    it('should create with config', () => {
      expect(history.id).toBe('test-history')
      expect(history.name).toBe('history-driver')
      expect(history.version).toBe('1.0.0')
    })
    
    it('should auto-generate id if not provided', () => {
      const auto = new HistoryDriver()
      expect(auto.id).toMatch(/^history-\d+$/)
    })
  })
  
  describe('handleChange', () => {
    it('should record changes in history', async () => {
      const change1: ContactChange = {
        type: 'contact-change',
        contactId: brand.contactId('contact-1'),
        groupId: brand.groupId('group-1'),
        value: 'first',
        timestamp: Date.now()
      }
      
      const change2: ContactChange = {
        type: 'contact-change',
        contactId: brand.contactId('contact-2'),
        groupId: brand.groupId('group-1'),
        value: 'second',
        timestamp: Date.now()
      }
      
      await history.handleChange(change1)
      await history.handleChange(change2)
      
      // Check via get-history command
      const result = await history.handleCommand({ type: 'get-history' })
      expect(result.status).toBe('success')
      expect(result.data).toMatchObject({
        history: expect.arrayContaining([
          expect.objectContaining({ description: expect.any(String) }),
          expect.objectContaining({ description: expect.any(String) })
        ]),
        currentIndex: 1,
        canUndo: true,
        canRedo: false
      })
    })
    
    it('should coalesce rapid changes to same contact', async () => {
      const change1: ContactChange = {
        type: 'contact-change',
        contactId: brand.contactId('contact-1'),
        groupId: brand.groupId('group-1'),
        value: 'first',
        timestamp: Date.now()
      }
      
      const change2: ContactChange = {
        type: 'contact-change',
        contactId: brand.contactId('contact-1'), // Same contact
        groupId: brand.groupId('group-1'),
        value: 'second',
        timestamp: Date.now() + 10 // Within coalesce interval (50ms)
      }
      
      await history.handleChange(change1)
      await history.handleChange(change2)
      
      const result = await history.handleCommand({ type: 'get-history' })
      expect(result.data.history).toHaveLength(1) // Coalesced into one entry
    })
    
    it('should not coalesce changes to different contacts', async () => {
      const change1: ContactChange = {
        type: 'contact-change',
        contactId: brand.contactId('contact-1'),
        groupId: brand.groupId('group-1'),
        value: 'first',
        timestamp: Date.now()
      }
      
      const change2: ContactChange = {
        type: 'contact-change',
        contactId: brand.contactId('contact-2'), // Different contact
        groupId: brand.groupId('group-1'),
        value: 'second',
        timestamp: Date.now() + 10
      }
      
      await history.handleChange(change1)
      await history.handleChange(change2)
      
      const result = await history.handleCommand({ type: 'get-history' })
      expect(result.data.history).toHaveLength(2) // Not coalesced
    })
    
    it('should respect max history size', async () => {
      const maxSize = 5
      const smallHistory = new HistoryDriver('small', { maxHistorySize: maxSize })
      
      // Add more than max
      for (let i = 0; i < 10; i++) {
        await smallHistory.handleChange({
          type: 'contact-change',
          contactId: brand.contactId(`contact-${i}`),
          groupId: brand.groupId('group-1'),
          value: `value-${i}`,
          timestamp: Date.now() + i * 100 // Prevent coalescing
        })
      }
      
      const result = await smallHistory.handleCommand({ type: 'get-history' })
      expect(result.data.history).toHaveLength(maxSize)
    })
  })
  
  describe('undo', () => {
    beforeEach(async () => {
      // Set up some history - storing previous values
      const contactId = brand.contactId('contact-1')
      
      // First change (no previous value)
      await history.handleChange({
        type: 'contact-change',
        contactId,
        groupId: brand.groupId('group-1'),
        value: 'first',
        timestamp: Date.now()
      })
      
      // Store first value as previous for next change
      history.storePreviousValue(contactId, 'first')
      
      // Wait to avoid coalescing
      await new Promise(resolve => setTimeout(resolve, 60))
      
      // Second change
      await history.handleChange({
        type: 'contact-change',
        contactId,
        groupId: brand.groupId('group-1'),
        value: 'second',
        timestamp: Date.now()
      })
    })
    
    it('should undo last change', async () => {
      const result = await history.handleCommand({ type: 'undo' })
      
      expect(result.status).toBe('success')
      expect(result.data).toMatchObject({
        undone: expect.any(String),
        canUndo: true, // After undoing to index 0, we can still undo the first change
        canRedo: true
      })
      
      // Should have called kernel with inverse operation
      expect(mockKernel.handleChange).toHaveBeenCalledWith(
        expect.objectContaining({
          contactId: brand.contactId('contact-1'),
          value: 'first' // Previous value
        })
      )
    })
    
    it('should throw when nothing to undo', async () => {
      // Clear history
      await history.handleCommand({ type: 'clear-history' })
      
      await expect(history.handleCommand({ type: 'undo' }))
        .rejects.toThrow('Nothing to undo')
    })
    
    it('should throw when kernel not set', async () => {
      const noKernelHistory = new HistoryDriver()
      await noKernelHistory.handleChange({
        type: 'contact-change',
        contactId: brand.contactId('contact-1'),
        groupId: brand.groupId('group-1'),
        value: 'test',
        timestamp: Date.now()
      })
      
      await expect(noKernelHistory.handleCommand({ type: 'undo' }))
        .rejects.toThrow('Kernel not set')
    })
  })
  
  describe('redo', () => {
    beforeEach(async () => {
      // Set up history and undo once
      await history.handleChange({
        type: 'contact-change',
        contactId: brand.contactId('contact-1'),
        groupId: brand.groupId('group-1'),
        value: 'first',
        timestamp: Date.now()
      })
      
      await history.handleChange({
        type: 'contact-change',
        contactId: brand.contactId('contact-1'),
        groupId: brand.groupId('group-1'),
        value: 'second',
        timestamp: Date.now() + 100
      })
      
      await history.handleCommand({ type: 'undo' })
    })
    
    it('should redo undone change', async () => {
      const result = await history.handleCommand({ type: 'redo' })
      
      expect(result.status).toBe('success')
      expect(result.data).toMatchObject({
        redone: expect.any(String),
        canUndo: true,
        canRedo: false
      })
      
      // Should reapply the original change
      expect(mockKernel.handleChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          value: 'second'
        })
      )
    })
    
    it('should throw when nothing to redo', async () => {
      // Redo once (should work)
      await history.handleCommand({ type: 'redo' })
      
      // Try to redo again (should fail)
      await expect(history.handleCommand({ type: 'redo' }))
        .rejects.toThrow('Nothing to redo')
    })
  })
  
  describe('storePreviousValue', () => {
    it('should use stored value for accurate undo', async () => {
      const contactId = brand.contactId('contact-1')
      
      // Store original value
      history.storePreviousValue(contactId, 'original')
      
      // Make a change
      await history.handleChange({
        type: 'contact-change',
        contactId,
        groupId: brand.groupId('group-1'),
        value: 'new',
        timestamp: Date.now()
      })
      
      // Undo should restore original value
      await history.handleCommand({ type: 'undo' })
      
      expect(mockKernel.handleChange).toHaveBeenCalledWith(
        expect.objectContaining({
          value: 'original'
        })
      )
    })
  })
  
  describe('clear-history', () => {
    it('should clear all history', async () => {
      // Add some history
      await history.handleChange({
        type: 'contact-change',
        contactId: brand.contactId('contact-1'),
        groupId: brand.groupId('group-1'),
        value: 'test',
        timestamp: Date.now()
      })
      
      // Clear it
      const result = await history.handleCommand({ type: 'clear-history' })
      expect(result.status).toBe('success')
      
      // Check it's gone
      const historyResult = await history.handleCommand({ type: 'get-history' })
      expect(historyResult.data.history).toHaveLength(0)
      expect(historyResult.data.canUndo).toBe(false)
      expect(historyResult.data.canRedo).toBe(false)
    })
  })
  
  describe('getStats', () => {
    it('should return statistics', async () => {
      // Do some operations
      await history.handleChange({
        type: 'contact-change',
        contactId: brand.contactId('contact-1'),
        groupId: brand.groupId('group-1'),
        value: 'test',
        timestamp: Date.now()
      })
      
      await history.handleCommand({ type: 'undo' })
      await history.handleCommand({ type: 'redo' })
      
      const stats = await history.getStats()
      
      expect(stats).toMatchObject({
        processed: 1,
        failed: 0,
        pending: 0,
        custom: expect.objectContaining({
          historySize: 1,
          undoCount: 1,
          redoCount: 1
        })
      })
    })
  })
  
  describe('isHealthy', () => {
    it('should return true when within limits', async () => {
      const healthy = await history.isHealthy()
      expect(healthy).toBe(true)
    })
    
    it('should return false when exceeding buffer', async () => {
      const tinyHistory = new HistoryDriver('tiny', { maxHistorySize: 2 })
      
      // Fill beyond buffer (2x max size)
      for (let i = 0; i < 5; i++) {
        await tinyHistory.handleChange({
          type: 'contact-change',
          contactId: brand.contactId(`contact-${i}`),
          groupId: brand.groupId('group-1'),
          value: `value-${i}`,
          timestamp: Date.now() + i * 100
        })
      }
      
      // Should still be healthy because it enforces max size
      const healthy = await tinyHistory.isHealthy()
      expect(healthy).toBe(true)
    })
  })
})