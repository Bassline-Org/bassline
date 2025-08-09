/**
 * Tests for file system gadgets using real propagation networks
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Kernel } from '@bassline/core'
import { UserspaceRuntime } from '@bassline/core/src/kernel/userspace-runtime'
import { PrimitiveLoaderDriver } from '@bassline/core/src/kernel/drivers/primitive-loader-driver'
import { brand } from '@bassline/core'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import * as fileGadgets from '../src/file'

describe('File System Gadgets', () => {
  let kernel: Kernel
  let runtime: UserspaceRuntime
  let primitiveLoader: PrimitiveLoaderDriver
  let testDir: string
  
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
    
    // Create temp directory for tests
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bassline-test-'))
    
    // Load file gadgets
    await primitiveLoader.loadModule({
      type: 'builtin',
      module: async () => fileGadgets,
      namespace: '@io/file'
    })
  })
  
  afterEach(async () => {
    // Clean up temp directory
    try {
      await fs.rm(testDir, { recursive: true, force: true })
    } catch (error) {
      console.warn('Failed to clean up test directory:', error)
    }
  })
  
  describe('fileWrite and fileRead', () => {
    it('should write and read file content through propagation network', async () => {
      const testFile = path.join(testDir, 'test.txt')
      const testContent = 'Hello from Bassline!'
      
      // Create root group
      const rootGroupId = brand.groupId('root')
      await runtime.registerGroup({
        id: rootGroupId,
        name: 'File I/O Test',
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: []
      })
      
      // Create write gadget
      const writeGadgetId = await runtime.createPrimitiveGadget('@io/file/fileWrite', rootGroupId)
      const writeState = await runtime.getState(writeGadgetId)
      
      const writePathInput = Array.from(writeState.contacts.values())
        .find(c => c.name === 'path' && c.boundaryDirection === 'input')
      const writeContentInput = Array.from(writeState.contacts.values())
        .find(c => c.name === 'content' && c.boundaryDirection === 'input')
      const writeSuccessOutput = Array.from(writeState.contacts.values())
        .find(c => c.name === 'success' && c.boundaryDirection === 'output')
      
      // Create read gadget
      const readGadgetId = await runtime.createPrimitiveGadget('@io/file/fileRead', rootGroupId)
      const readState = await runtime.getState(readGadgetId)
      
      const readPathInput = Array.from(readState.contacts.values())
        .find(c => c.name === 'path' && c.boundaryDirection === 'input')
      const readContentOutput = Array.from(readState.contacts.values())
        .find(c => c.name === 'content' && c.boundaryDirection === 'output')
      
      // Wire write success to read path (trigger read after write)
      await runtime.connect(writePathInput!.id, readPathInput!.id)
      
      // Write file
      await runtime.scheduleUpdate(writePathInput!.id, testFile)
      await runtime.scheduleUpdate(writeContentInput!.id, testContent)
      
      // Wait for propagation
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Check write succeeded
      const writeResult = await runtime.getState(writeGadgetId)
      const success = writeResult.contacts.get(writeSuccessOutput!.id)?.content
      expect(success).toBe(true)
      
      // Check read succeeded
      const readResult = await runtime.getState(readGadgetId)
      const readContent = readResult.contacts.get(readContentOutput!.id)?.content
      expect(readContent).toBe(testContent)
      
      // Verify file actually exists
      const actualContent = await fs.readFile(testFile, 'utf-8')
      expect(actualContent).toBe(testContent)
    })
    
    it('should handle file not found errors gracefully', async () => {
      const nonExistentFile = path.join(testDir, 'does-not-exist.txt')
      
      // Create root group
      const rootGroupId = brand.groupId('root')
      await runtime.registerGroup({
        id: rootGroupId,
        name: 'File Error Test',
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: []
      })
      
      // Create read gadget
      const readGadgetId = await runtime.createPrimitiveGadget('@io/file/fileRead', rootGroupId)
      const readState = await runtime.getState(readGadgetId)
      
      const pathInput = Array.from(readState.contacts.values())
        .find(c => c.name === 'path' && c.boundaryDirection === 'input')
      const errorOutput = Array.from(readState.contacts.values())
        .find(c => c.name === 'error' && c.boundaryDirection === 'output')
      
      // Try to read non-existent file
      await runtime.scheduleUpdate(pathInput!.id, nonExistentFile)
      
      // Wait for propagation
      await new Promise(resolve => setTimeout(resolve, 50))
      
      // Check error was captured
      const result = await runtime.getState(readGadgetId)
      const error = result.contacts.get(errorOutput!.id)?.content
      expect(error).toContain('ENOENT')
    })
  })
  
  describe('dirList', () => {
    it('should list directory contents', async () => {
      // Create some test files
      await fs.writeFile(path.join(testDir, 'file1.txt'), 'content1')
      await fs.writeFile(path.join(testDir, 'file2.txt'), 'content2')
      await fs.mkdir(path.join(testDir, 'subdir'))
      await fs.writeFile(path.join(testDir, 'subdir', 'file3.txt'), 'content3')
      
      // Create root group
      const rootGroupId = brand.groupId('root')
      await runtime.registerGroup({
        id: rootGroupId,
        name: 'Dir List Test',
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: []
      })
      
      // Create dirList gadget
      const dirListGadgetId = await runtime.createPrimitiveGadget('@io/file/dirList', rootGroupId)
      const state = await runtime.getState(dirListGadgetId)
      
      const pathInput = Array.from(state.contacts.values())
        .find(c => c.name === 'path' && c.boundaryDirection === 'input')
      const filesOutput = Array.from(state.contacts.values())
        .find(c => c.name === 'files' && c.boundaryDirection === 'output')
      
      // List directory
      await runtime.scheduleUpdate(pathInput!.id, testDir)
      
      // Wait for propagation
      await new Promise(resolve => setTimeout(resolve, 50))
      
      // Check results
      const result = await runtime.getState(dirListGadgetId)
      const files = result.contacts.get(filesOutput!.id)?.content as string[]
      
      expect(files).toContain('file1.txt')
      expect(files).toContain('file2.txt')
      expect(files).toContain('subdir')
      expect(files).toHaveLength(3)
    })
    
    it('should list directory recursively', async () => {
      // Create nested structure
      await fs.writeFile(path.join(testDir, 'file1.txt'), 'content1')
      await fs.mkdir(path.join(testDir, 'subdir'))
      await fs.writeFile(path.join(testDir, 'subdir', 'file2.txt'), 'content2')
      
      // Create root group
      const rootGroupId = brand.groupId('root')
      await runtime.registerGroup({
        id: rootGroupId,
        name: 'Recursive Dir Test',
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: []
      })
      
      // Create dirList gadget
      const dirListGadgetId = await runtime.createPrimitiveGadget('@io/file/dirList', rootGroupId)
      const state = await runtime.getState(dirListGadgetId)
      
      const pathInput = Array.from(state.contacts.values())
        .find(c => c.name === 'path' && c.boundaryDirection === 'input')
      const recursiveInput = Array.from(state.contacts.values())
        .find(c => c.name === 'recursive' && c.boundaryDirection === 'input')
      const filesOutput = Array.from(state.contacts.values())
        .find(c => c.name === 'files' && c.boundaryDirection === 'output')
      
      // List directory recursively
      await runtime.scheduleUpdate(pathInput!.id, testDir)
      await runtime.scheduleUpdate(recursiveInput!.id, true)
      
      // Wait for propagation
      await new Promise(resolve => setTimeout(resolve, 50))
      
      // Check results
      const result = await runtime.getState(dirListGadgetId)
      const files = result.contacts.get(filesOutput!.id)?.content as string[]
      
      // Should contain full paths
      expect(files).toHaveLength(2)
      expect(files.some(f => f.endsWith('file1.txt'))).toBe(true)
      expect(files.some(f => f.endsWith(path.join('subdir', 'file2.txt')))).toBe(true)
    })
  })
  
  describe('fileAppend', () => {
    it('should append content to existing file', async () => {
      const testFile = path.join(testDir, 'append.txt')
      await fs.writeFile(testFile, 'Initial content\n')
      
      // Create root group
      const rootGroupId = brand.groupId('root')
      await runtime.registerGroup({
        id: rootGroupId,
        name: 'File Append Test',
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: []
      })
      
      // Create append gadget
      const appendGadgetId = await runtime.createPrimitiveGadget('@io/file/fileAppend', rootGroupId)
      const state = await runtime.getState(appendGadgetId)
      
      const pathInput = Array.from(state.contacts.values())
        .find(c => c.name === 'path' && c.boundaryDirection === 'input')
      const contentInput = Array.from(state.contacts.values())
        .find(c => c.name === 'content' && c.boundaryDirection === 'input')
      const successOutput = Array.from(state.contacts.values())
        .find(c => c.name === 'success' && c.boundaryDirection === 'output')
      
      // Append to file
      await runtime.scheduleUpdate(pathInput!.id, testFile)
      await runtime.scheduleUpdate(contentInput!.id, 'Appended content\n')
      
      // Wait for propagation
      await new Promise(resolve => setTimeout(resolve, 50))
      
      // Check success
      const result = await runtime.getState(appendGadgetId)
      const success = result.contacts.get(successOutput!.id)?.content
      expect(success).toBe(true)
      
      // Verify file content
      const actualContent = await fs.readFile(testFile, 'utf-8')
      expect(actualContent).toBe('Initial content\nAppended content\n')
    })
  })
})