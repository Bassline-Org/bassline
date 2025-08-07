import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useNetworkClient, useContact } from '../useWorkerData'
import * as clientModule from '~/network/client'

// Mock the NetworkClient
const mockClient = {
  getContact: vi.fn(),
  getState: vi.fn(),
  subscribe: vi.fn(),
  scheduleUpdate: vi.fn(),
  addContact: vi.fn(),
  removeContact: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  terminate: vi.fn()
}

// Mock the client module
vi.mock('~/network/client', () => ({
  getNetworkClient: vi.fn(() => mockClient)
}))

describe('useWorkerData hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('useNetworkClient', () => {
    it('should return the network client', () => {
      const { result } = renderHook(() => useNetworkClient())
      
      expect(result.current).toBe(mockClient)
      expect(clientModule.getNetworkClient).toHaveBeenCalledOnce()
    })
  })

  describe('useContact', () => {
    const mockContact = {
      id: 'contact-1',
      content: 'Hello World',
      blendMode: 'accept-last' as const,
      groupId: 'group-1'
    }

    it('should use initial contact if provided', () => {
      const { result } = renderHook(() => useContact('contact-1', mockContact))
      
      expect(result.current.contact).toBe(mockContact)
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBe(null)
    })

    it('should load contact if not provided initially', async () => {
      mockClient.getContact.mockResolvedValue(mockContact)
      
      const { result } = renderHook(() => useContact('contact-1'))
      
      // Initially loading
      expect(result.current.loading).toBe(true)
      expect(result.current.contact).toBe(null)
      
      // Wait for load to complete
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0))
      })
      
      expect(mockClient.getContact).toHaveBeenCalledWith('contact-1')
    })

    it('should subscribe to contact changes', () => {
      const unsubscribe = vi.fn()
      mockClient.subscribe.mockReturnValue(unsubscribe)
      
      const { unmount } = renderHook(() => useContact('contact-1', mockContact))
      
      expect(mockClient.subscribe).toHaveBeenCalledOnce()
      
      // Should unsubscribe on unmount
      unmount()
      expect(unsubscribe).toHaveBeenCalledOnce()
    })

    it('should update contact when change event occurs', () => {
      let subscribeCallback: (changes: any[]) => void
      mockClient.subscribe.mockImplementation((callback) => {
        subscribeCallback = callback
        return vi.fn()
      })
      
      const { result } = renderHook(() => useContact('contact-1', mockContact))
      
      // Simulate a contact update
      const updatedContact = { ...mockContact, content: 'Updated content' }
      act(() => {
        subscribeCallback([{
          type: 'contact-updated',
          data: { contactId: 'contact-1', contact: updatedContact }
        }])
      })
      
      expect(result.current.contact).toEqual(updatedContact)
    })
  })
})