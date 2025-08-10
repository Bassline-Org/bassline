import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CompoundDriver } from '../compound-driver'
import type { ExtendedDriver, CompoundDriverCommand } from '../compound-driver'
import type { ContactChange, CommandResponse } from '../../types'
import type { StorageDriver } from '../../driver'
import { brand } from '../../../types'

describe('CompoundDriver', () => {
  let compound: CompoundDriver
  
  beforeEach(() => {
    compound = new CompoundDriver('test-compound')
  })
  
  describe('initialization', () => {
    it('should create with unique id', () => {
      expect(compound.id).toBe('test-compound')
      expect(compound.name).toBe('compound-driver')
      expect(compound.version).toBe('1.0.0')
    })
    
    it('should auto-generate id if not provided', () => {
      const auto = new CompoundDriver()
      expect(auto.id).toMatch(/^compound-\d+$/)
    })
  })
  
  describe('sub-driver management', () => {
    it('should set storage driver', () => {
      const mockStorage: StorageDriver = {
        id: 'mock-storage',
        name: 'mock',
        version: '1.0.0',
        handleChange: vi.fn(),
        handleCommand: vi.fn(),
        isHealthy: vi.fn(),
        loadGroup: vi.fn(),
        getCapabilities: () => ({
          supportsBatching: false,
          supportsTransactions: false,
          supportsStreaming: false,
          persistent: false
        })
      }
      
      compound.setStorageDriver(mockStorage)
      // Would need getter to test, but we can test indirectly through handleChange
    })
    
    it('should set history driver', () => {
      const mockHistory: ExtendedDriver<CompoundDriverCommand> = {
        id: 'mock-history',
        name: 'mock',
        version: '1.0.0',
        handleChange: vi.fn(),
        handleCommand: vi.fn(),
        isHealthy: vi.fn()
      }
      
      compound.setHistoryDriver(mockHistory)
    })
  })
  
  describe('handleChange', () => {
    it('should pass changes to all sub-drivers', async () => {
      const mockStorage: StorageDriver = {
        id: 'storage',
        name: 'storage',
        version: '1.0.0',
        handleChange: vi.fn().mockResolvedValue({ status: 'success' }),
        handleCommand: vi.fn(),
        isHealthy: vi.fn(),
        loadGroup: vi.fn(),
        getCapabilities: () => ({
          supportsBatching: false,
          supportsTransactions: false,
          supportsStreaming: false,
          persistent: false
        })
      }
      
      const mockHistory: ExtendedDriver<CompoundDriverCommand> = {
        id: 'history',
        name: 'history',
        version: '1.0.0',
        handleChange: vi.fn().mockResolvedValue({ status: 'success' }),
        handleCommand: vi.fn(),
        isHealthy: vi.fn()
      }
      
      compound.setStorageDriver(mockStorage)
      compound.setHistoryDriver(mockHistory)
      
      const change: ContactChange = {
        type: 'contact-change',
        contactId: brand.contactId('contact-1'),
        groupId: brand.groupId('group-1'),
        value: 'test',
        timestamp: Date.now()
      }
      
      const result = await compound.handleChange(change)
      
      expect(result.status).toBe('success')
      expect(mockHistory.handleChange).toHaveBeenCalledWith(change)
      expect(mockStorage.handleChange).toHaveBeenCalledWith(change)
    })
    
    it('should continue even if history driver fails', async () => {
      const mockStorage: StorageDriver = {
        id: 'storage',
        name: 'storage',
        version: '1.0.0',
        handleChange: vi.fn().mockResolvedValue({ status: 'success' }),
        handleCommand: vi.fn(),
        isHealthy: vi.fn(),
        loadGroup: vi.fn(),
        getCapabilities: () => ({
          supportsBatching: false,
          supportsTransactions: false,
          supportsStreaming: false,
          persistent: false
        })
      }
      
      const mockHistory: ExtendedDriver<CompoundDriverCommand> = {
        id: 'history',
        name: 'history',
        version: '1.0.0',
        handleChange: vi.fn().mockRejectedValue(new Error('History error')),
        handleCommand: vi.fn(),
        isHealthy: vi.fn()
      }
      
      compound.setStorageDriver(mockStorage)
      compound.setHistoryDriver(mockHistory)
      
      const change: ContactChange = {
        type: 'contact-change',
        contactId: brand.contactId('contact-1'),
        groupId: brand.groupId('group-1'),
        value: 'test',
        timestamp: Date.now()
      }
      
      const result = await compound.handleChange(change)
      
      // Should still succeed despite history failure
      expect(result.status).toBe('success')
      expect(mockStorage.handleChange).toHaveBeenCalledWith(change)
    })
  })
  
  describe('handleCommand', () => {
    it('should route undo/redo to history driver', async () => {
      const mockHistory: ExtendedDriver<CompoundDriverCommand> = {
        id: 'history',
        name: 'history',
        version: '1.0.0',
        handleChange: vi.fn(),
        handleCommand: vi.fn().mockResolvedValue({ 
          status: 'success',
          data: { undone: 'test' }
        }),
        isHealthy: vi.fn()
      }
      
      compound.setHistoryDriver(mockHistory)
      
      const result = await compound.handleCommand({ type: 'undo' })
      
      expect(result.status).toBe('success')
      expect(mockHistory.handleCommand).toHaveBeenCalledWith({ type: 'undo' })
    })
    
    it('should throw error if history driver not configured for undo', async () => {
      await expect(compound.handleCommand({ type: 'undo' }))
        .rejects.toThrow('History driver not configured')
    })
    
    it('should initialize all sub-drivers', async () => {
      const mockStorage: StorageDriver = {
        id: 'storage',
        name: 'storage',
        version: '1.0.0',
        handleChange: vi.fn(),
        handleCommand: vi.fn().mockResolvedValue({ status: 'success' }),
        isHealthy: vi.fn(),
        loadGroup: vi.fn(),
        getCapabilities: () => ({
          supportsBatching: false,
          supportsTransactions: false,
          supportsStreaming: false,
          persistent: false
        })
      }
      
      const mockHistory: ExtendedDriver<CompoundDriverCommand> = {
        id: 'history',
        name: 'history',
        version: '1.0.0',
        handleChange: vi.fn(),
        handleCommand: vi.fn().mockResolvedValue({ status: 'success' }),
        isHealthy: vi.fn()
      }
      
      compound.setStorageDriver(mockStorage)
      compound.setHistoryDriver(mockHistory)
      
      const result = await compound.handleCommand({ 
        type: 'initialize',
        config: {}
      })
      
      expect(result.status).toBe('success')
      expect(mockStorage.handleCommand).toHaveBeenCalledWith({
        type: 'initialize',
        config: {}
      })
      expect(mockHistory.handleCommand).toHaveBeenCalledWith({
        type: 'initialize',
        config: {}
      })
    })
    
    it('should shutdown all sub-drivers in reverse order', async () => {
      const callOrder: string[] = []
      
      const mockStorage: StorageDriver = {
        id: 'storage',
        name: 'storage',
        version: '1.0.0',
        handleChange: vi.fn(),
        handleCommand: vi.fn().mockImplementation(async () => {
          callOrder.push('storage')
          return { status: 'success' as const }
        }),
        isHealthy: vi.fn(),
        loadGroup: vi.fn(),
        getCapabilities: () => ({
          supportsBatching: false,
          supportsTransactions: false,
          supportsStreaming: false,
          persistent: false
        })
      }
      
      const mockHistory: ExtendedDriver<CompoundDriverCommand> = {
        id: 'history',
        name: 'history',
        version: '1.0.0',
        handleChange: vi.fn(),
        handleCommand: vi.fn().mockImplementation(async () => {
          callOrder.push('history')
          return { status: 'success' as const }
        }),
        isHealthy: vi.fn()
      }
      
      compound.setStorageDriver(mockStorage)
      compound.setHistoryDriver(mockHistory)
      
      await compound.handleCommand({ 
        type: 'shutdown',
        force: false
      })
      
      // History should shutdown before storage (reverse order)
      expect(callOrder).toEqual(['history', 'storage'])
    })
  })
  
  describe('isHealthy', () => {
    it('should return true if all sub-drivers are healthy', async () => {
      const mockStorage: StorageDriver = {
        id: 'storage',
        name: 'storage',
        version: '1.0.0',
        handleChange: vi.fn(),
        handleCommand: vi.fn(),
        isHealthy: vi.fn().mockResolvedValue(true),
        loadGroup: vi.fn(),
        getCapabilities: () => ({
          supportsBatching: false,
          supportsTransactions: false,
          supportsStreaming: false,
          persistent: false
        })
      }
      
      const mockHistory: ExtendedDriver<CompoundDriverCommand> = {
        id: 'history',
        name: 'history',
        version: '1.0.0',
        handleChange: vi.fn(),
        handleCommand: vi.fn(),
        isHealthy: vi.fn().mockResolvedValue(true)
      }
      
      compound.setStorageDriver(mockStorage)
      compound.setHistoryDriver(mockHistory)
      
      const healthy = await compound.isHealthy()
      
      expect(healthy).toBe(true)
      expect(mockStorage.isHealthy).toHaveBeenCalled()
      expect(mockHistory.isHealthy).toHaveBeenCalled()
    })
    
    it('should return false if any sub-driver is unhealthy', async () => {
      const mockStorage: StorageDriver = {
        id: 'storage',
        name: 'storage',
        version: '1.0.0',
        handleChange: vi.fn(),
        handleCommand: vi.fn(),
        isHealthy: vi.fn().mockResolvedValue(true),
        loadGroup: vi.fn(),
        getCapabilities: () => ({
          supportsBatching: false,
          supportsTransactions: false,
          supportsStreaming: false,
          persistent: false
        })
      }
      
      const mockHistory: ExtendedDriver<CompoundDriverCommand> = {
        id: 'history',
        name: 'history',
        version: '1.0.0',
        handleChange: vi.fn(),
        handleCommand: vi.fn(),
        isHealthy: vi.fn().mockResolvedValue(false)  // Unhealthy
      }
      
      compound.setStorageDriver(mockStorage)
      compound.setHistoryDriver(mockHistory)
      
      const healthy = await compound.isHealthy()
      
      expect(healthy).toBe(false)
    })
    
    it('should return true if no sub-drivers configured', async () => {
      const healthy = await compound.isHealthy()
      expect(healthy).toBe(true)
    })
  })
  
  describe('asDriver', () => {
    it('should return itself as a Driver interface', () => {
      const driver = compound.asDriver()
      expect(driver).toBe(compound)
    })
  })
  
  describe('asStorageDriver', () => {
    it('should return itself as StorageDriver when storage configured', () => {
      const mockStorage: StorageDriver = {
        id: 'storage',
        name: 'storage',
        version: '1.0.0',
        handleChange: vi.fn(),
        handleCommand: vi.fn(),
        isHealthy: vi.fn(),
        loadGroup: vi.fn(),
        getCapabilities: () => ({
          supportsBatching: false,
          supportsTransactions: false,
          supportsStreaming: false,
          persistent: false
        })
      }
      
      compound.setStorageDriver(mockStorage)
      const storageDriver = compound.asStorageDriver()
      
      expect(storageDriver).toBe(compound)
    })
    
    it('should return undefined when no storage configured', () => {
      const storageDriver = compound.asStorageDriver()
      expect(storageDriver).toBeUndefined()
    })
  })
})