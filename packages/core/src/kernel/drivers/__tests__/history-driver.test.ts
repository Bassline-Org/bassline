import { describe, it, expect, beforeEach } from 'vitest'
import { HistoryDriver } from '../history-driver'
import type { ExternalInput } from '../../types'

describe('HistoryDriver', () => {
  let driver: HistoryDriver
  let capturedInputs: ExternalInput[]
  
  beforeEach(() => {
    driver = new HistoryDriver('test-history')
    capturedInputs = []
    
    // Set up a mock input handler that captures emitted operations
    driver.setInputHandler(async (input) => {
      capturedInputs.push(input)
    })
  })
  
  describe('record()', () => {
    it('should record operations performed in callback', async () => {
      const result = await driver.record('Test action', async () => {
        // Simulate some operations
        driver.trackOperation({
          type: 'external-add-contact',
          source: 'test',
          groupId: 'group1',
          contact: { content: 'Hello', blendMode: 'accept-last' }
        } as ExternalInput)
        
        return 'done'
      })
      
      expect(result).toBe('done')
      
      // Check that we can undo
      const undoResult = await driver.handleCommand({ type: 'undo' })
      expect(undoResult.status).toBe('success')
      expect(undoResult.data?.undone).toBe('Test action')
    })
    
    it('should not record nested operations', async () => {
      await driver.record('Outer action', async () => {
        driver.trackOperation({
          type: 'external-add-contact',
          source: 'test',
          groupId: 'group1',
          contact: { content: 'First' }
        } as ExternalInput)
        
        // Nested record should not create a separate history entry
        await driver.record('Inner action', async () => {
          driver.trackOperation({
            type: 'external-add-contact',
            source: 'test',
            groupId: 'group1',
            contact: { content: 'Second' }
          } as ExternalInput)
        })
      })
      
      // Should only have one history entry
      const status = await driver.handleCommand({ type: 'get-history' })
      expect(status.data?.history).toHaveLength(1)
    })
    
    it('should not record when nothing happens in callback', async () => {
      await driver.record('Empty action', async () => {
        // Do nothing
      })
      
      // Should have no history, so undo should throw
      await expect(driver.handleCommand({ type: 'undo' }))
        .rejects.toThrow('Nothing to undo')
    })
  })
  
  describe('undo/redo', () => {
    it('should undo contact additions', async () => {
      await driver.record('Add contact', async () => {
        const input: ExternalInput = {
          type: 'external-add-contact',
          source: 'test',
          groupId: 'group1',
          contact: { content: 'Test Contact' },
          resultId: 'contact123' // Store the ID for inverse
        } as any
        driver.trackOperation(input)
      })
      
      capturedInputs = [] // Clear
      
      // Undo should emit remove-contact
      await driver.handleCommand({ type: 'undo' })
      
      expect(capturedInputs).toHaveLength(1)
      expect(capturedInputs[0].type).toBe('external-remove-contact')
      expect((capturedInputs[0] as any).contactId).toBe('contact123')
    })
    
    it('should undo contact updates with previous value', async () => {
      await driver.record('Update contact', async () => {
        const input: ExternalInput = {
          type: 'external-contact-update',
          source: 'test',
          contactId: 'contact1',
          groupId: 'group1',
          value: 'New Value',
          previousValue: 'Old Value' // Store for inverse
        } as any
        driver.trackOperation(input)
      })
      
      capturedInputs = []
      
      // Undo should restore previous value
      await driver.handleCommand({ type: 'undo' })
      
      expect(capturedInputs).toHaveLength(1)
      expect(capturedInputs[0].type).toBe('external-contact-update')
      expect((capturedInputs[0] as any).value).toBe('Old Value')
    })
    
    it('should undo contact removals', async () => {
      await driver.record('Remove contact', async () => {
        const input: ExternalInput = {
          type: 'external-remove-contact',
          source: 'test',
          contactId: 'contact1',
          // Store data needed to recreate
          groupId: 'group1',
          contact: { content: 'Deleted Contact', blendMode: 'accept-last' }
        } as any
        driver.trackOperation(input)
      })
      
      capturedInputs = []
      
      // Undo should re-add the contact
      await driver.handleCommand({ type: 'undo' })
      
      expect(capturedInputs).toHaveLength(1)
      expect(capturedInputs[0].type).toBe('external-add-contact')
      expect((capturedInputs[0] as any).groupId).toBe('group1')
      expect((capturedInputs[0] as any).contact.content).toBe('Deleted Contact')
    })
    
    it('should apply operations in reverse order for undo', async () => {
      await driver.record('Multiple operations', async () => {
        driver.trackOperation({
          type: 'external-add-contact',
          source: 'test',
          groupId: 'group1',
          contact: { content: 'First' },
          resultId: 'contact1'
        } as any)
        
        driver.trackOperation({
          type: 'external-add-contact',
          source: 'test',
          groupId: 'group1',
          contact: { content: 'Second' },
          resultId: 'contact2'
        } as any)
      })
      
      capturedInputs = []
      
      // Undo should apply inverses in reverse order
      await driver.handleCommand({ type: 'undo' })
      
      expect(capturedInputs).toHaveLength(2)
      expect((capturedInputs[0] as any).contactId).toBe('contact2') // Second removed first
      expect((capturedInputs[1] as any).contactId).toBe('contact1') // First removed second
    })
    
    it('should redo by replaying original operations', async () => {
      await driver.record('Add contact', async () => {
        driver.trackOperation({
          type: 'external-add-contact',
          source: 'test',
          groupId: 'group1',
          contact: { content: 'Test' },
          resultId: 'contact1'
        } as any)
      })
      
      // Undo
      await driver.handleCommand({ type: 'undo' })
      capturedInputs = []
      
      // Redo should replay the original operation
      await driver.handleCommand({ type: 'redo' })
      
      expect(capturedInputs).toHaveLength(1)
      expect(capturedInputs[0].type).toBe('external-add-contact')
      expect((capturedInputs[0] as any).contact.content).toBe('Test')
    })
    
    it('should handle wire operations', async () => {
      await driver.record('Create wire', async () => {
        driver.trackOperation({
          type: 'external-create-wire',
          source: 'test',
          fromContactId: 'contact1',
          toContactId: 'contact2',
          resultId: 'wire123'
        } as any)
      })
      
      capturedInputs = []
      
      // Undo should remove the wire
      await driver.handleCommand({ type: 'undo' })
      
      expect(capturedInputs).toHaveLength(1)
      expect(capturedInputs[0].type).toBe('external-remove-wire')
      expect((capturedInputs[0] as any).wireId).toBe('wire123')
    })
  })
  
  describe('canUndo/canRedo', () => {
    it('should track undo/redo availability', async () => {
      expect(driver.canUndo()).toBe(false)
      expect(driver.canRedo()).toBe(false)
      
      await driver.record('Action 1', async () => {
        driver.trackOperation({
          type: 'external-add-contact',
          source: 'test',
          groupId: 'g1',
          contact: {}
        } as ExternalInput)
      })
      
      expect(driver.canUndo()).toBe(true)
      expect(driver.canRedo()).toBe(false)
      
      await driver.handleCommand({ type: 'undo' })
      
      expect(driver.canUndo()).toBe(false)
      expect(driver.canRedo()).toBe(true)
      
      await driver.handleCommand({ type: 'redo' })
      
      expect(driver.canUndo()).toBe(true)
      expect(driver.canRedo()).toBe(false)
    })
    
    it('should NOT truncate future history when recording after undo (non-destructive)', async () => {
      // Record two actions
      await driver.record('Action 1', async () => {
        driver.trackOperation({
          type: 'external-add-contact',
          source: 'test',
          groupId: 'g1',
          contact: { content: '1' }
        } as ExternalInput)
      })
      
      await driver.record('Action 2', async () => {
        driver.trackOperation({
          type: 'external-add-contact',
          source: 'test',
          groupId: 'g1',
          contact: { content: '2' }
        } as ExternalInput)
      })
      
      // currentIndex should be 1 (pointing at second action)
      expect(driver.canUndo()).toBe(true)
      
      // Undo once - currentIndex becomes 0
      await driver.handleCommand({ type: 'undo' })
      expect(driver.canRedo()).toBe(true)
      
      // Record new action - should insert after current position without truncating
      await driver.record('Action 3', async () => {
        console.log('About to track Action 3')
        driver.trackOperation({
          type: 'external-add-contact',
          source: 'test',
          groupId: 'g1',
          contact: { content: '3' }
        } as ExternalInput)
        console.log('Tracked Action 3')
      })
      
      // History should now be [Action 1, Action 3, Action 2], currentIndex = 1
      // We can still redo to Action 2 (non-destructive history)
      expect(driver.canRedo()).toBe(true)
      expect(driver.canUndo()).toBe(true)
      
      // Verify history was NOT truncated - all actions preserved
      const status = await driver.handleCommand({ type: 'get-history' })
      expect(status.data?.history).toHaveLength(3)
      expect(status.data?.history[0].description).toBe('Action 1')
      expect(status.data?.history[1].description).toBe('Action 3')
      expect(status.data?.history[2].description).toBe('Action 2')
      
      // We should be able to redo to get to Action 2
      await driver.handleCommand({ type: 'redo' })
      expect(driver.canUndo()).toBe(true)
      
      // Verify we're now at Action 2
      const finalStatus = await driver.handleCommand({ type: 'get-history' })
      expect(finalStatus.data?.currentIndex).toBe(2)
    })
  })
  
  describe('history management', () => {
    it('should respect max history size', async () => {
      const smallDriver = new HistoryDriver('test', { maxHistorySize: 3 })
      smallDriver.setInputHandler(async () => {})
      
      // Record 5 actions
      for (let i = 0; i < 5; i++) {
        await smallDriver.record(`Action ${i}`, async () => {
          smallDriver.trackOperation({
            type: 'external-add-contact',
            source: 'test',
            groupId: 'g1',
            contact: { content: `${i}` }
          } as ExternalInput)
        })
      }
      
      // Should only keep last 3
      const status = await smallDriver.handleCommand({ type: 'get-history' })
      expect(status.data?.history).toHaveLength(3)
      expect(status.data?.history[0].description).toBe('Action 2')
    })
    
    it('should clear history on command', async () => {
      await driver.record('Action', async () => {
        driver.trackOperation({
          type: 'external-add-contact',
          source: 'test',
          groupId: 'g1',
          contact: {}
        } as ExternalInput)
      })
      
      expect(driver.canUndo()).toBe(true)
      
      await driver.handleCommand({ type: 'clear-history' })
      
      expect(driver.canUndo()).toBe(false)
    })
  })
})