import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createFileStore } from '../src/store.js'

describe('createFileStore', () => {
  let tempDir
  let store

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'bassline-store-test-'))
    store = createFileStore(tempDir)
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  describe('reading files', () => {
    it('reads JSON file', async () => {
      await writeFile(join(tempDir, 'data.json'), '{"name":"test","value":42}')

      const result = await store.get({ path: '/data.json' })

      expect(result.headers.type).toBe('json')
      expect(result.body).toEqual({ name: 'test', value: 42 })
    })

    it('reads text file', async () => {
      await writeFile(join(tempDir, 'readme.txt'), 'Hello World')

      const result = await store.get({ path: '/readme.txt' })

      expect(result.headers.type).toBe('text')
      expect(result.body).toBe('Hello World')
    })

    it('reads file with invalid JSON as text', async () => {
      await writeFile(join(tempDir, 'broken.json'), '{ invalid json }')

      const result = await store.get({ path: '/broken.json' })

      expect(result.headers.type).toBe('text')
      expect(result.body).toBe('{ invalid json }')
    })

    it('returns not-found for missing file', async () => {
      const result = await store.get({ path: '/nonexistent.txt' })

      expect(result.headers.condition).toBe('not-found')
      expect(result.body).toBe(null)
    })

    it('reads nested file', async () => {
      await mkdir(join(tempDir, 'deep', 'nested'), { recursive: true })
      await writeFile(join(tempDir, 'deep', 'nested', 'file.json'), '{"deep":true}')

      const result = await store.get({ path: '/deep/nested/file.json' })

      expect(result.body).toEqual({ deep: true })
    })
  })

  describe('reading directories', () => {
    it('lists directory contents', async () => {
      await writeFile(join(tempDir, 'a.txt'), 'a')
      await writeFile(join(tempDir, 'b.txt'), 'b')
      await mkdir(join(tempDir, 'subdir'))

      const result = await store.get({ path: '/' })

      expect(result.headers.type).toBe('directory')
      expect(result.body).toContain('a.txt')
      expect(result.body).toContain('b.txt')
      expect(result.body).toContain('subdir')
    })

    it('lists empty directory', async () => {
      await mkdir(join(tempDir, 'empty'))

      const result = await store.get({ path: '/empty' })

      expect(result.headers.type).toBe('directory')
      expect(result.body).toEqual([])
    })

    it('handles null path as root', async () => {
      await writeFile(join(tempDir, 'file.txt'), 'content')

      const result = await store.get({ path: null })

      expect(result.headers.type).toBe('directory')
    })
  })

  describe('writing files', () => {
    it('writes JSON object', async () => {
      const result = await store.put({ path: '/output.json' }, { data: 'value' })

      expect(result.body).toEqual({ data: 'value' })

      // Verify file contents
      const read = await store.get({ path: '/output.json' })
      expect(read.body).toEqual({ data: 'value' })
    })

    it('writes string as-is', async () => {
      await store.put({ path: '/raw.txt' }, 'raw string content')

      const result = await store.get({ path: '/raw.txt' })
      expect(result.body).toBe('raw string content')
    })

    it('creates intermediate directories', async () => {
      await store.put({ path: '/a/b/c/deep.json' }, { nested: true })

      const result = await store.get({ path: '/a/b/c/deep.json' })
      expect(result.body).toEqual({ nested: true })
    })

    it('overwrites existing file', async () => {
      await store.put({ path: '/file.json' }, { version: 1 })
      await store.put({ path: '/file.json' }, { version: 2 })

      const result = await store.get({ path: '/file.json' })
      expect(result.body.version).toBe(2)
    })

    it('formats JSON with indentation', async () => {
      await store.put({ path: '/pretty.json' }, { a: 1, b: 2 })

      const { readFile } = await import('node:fs/promises')
      const content = await readFile(join(tempDir, 'pretty.json'), 'utf-8')

      expect(content).toContain('\n') // Has newlines (pretty printed)
    })
  })

  describe('edge cases', () => {
    it('handles empty path', async () => {
      const result = await store.get({ path: '' })
      expect(result.headers.type).toBe('directory')
    })

    it('handles path without leading slash', async () => {
      await writeFile(join(tempDir, 'test.txt'), 'content')

      const result = await store.get({ path: 'test.txt' })
      expect(result.body).toBe('content')
    })

    it('handles special characters in filename', async () => {
      await store.put({ path: '/file with spaces.json' }, { special: true })

      const result = await store.get({ path: '/file with spaces.json' })
      expect(result.body).toEqual({ special: true })
    })

    it('writes null value', async () => {
      await store.put({ path: '/null.json' }, null)

      const result = await store.get({ path: '/null.json' })
      expect(result.body).toBe(null)
    })

    it('writes array', async () => {
      await store.put({ path: '/array.json' }, [1, 2, 3])

      const result = await store.get({ path: '/array.json' })
      expect(result.body).toEqual([1, 2, 3])
    })

    it('writes number', async () => {
      await store.put({ path: '/number.json' }, 42)

      const result = await store.get({ path: '/number.json' })
      expect(result.body).toBe(42)
    })

    it('writes boolean', async () => {
      await store.put({ path: '/bool.json' }, true)

      const result = await store.get({ path: '/bool.json' })
      expect(result.body).toBe(true)
    })
  })

  describe('concurrent access', () => {
    it('handles concurrent writes to different files', async () => {
      const writes = []
      for (let i = 0; i < 10; i++) {
        writes.push(store.put({ path: `/file${i}.json` }, { index: i }))
      }

      await Promise.all(writes)

      // Verify all files exist
      for (let i = 0; i < 10; i++) {
        const result = await store.get({ path: `/file${i}.json` })
        expect(result.body.index).toBe(i)
      }
    })

    it('handles concurrent writes to same file (last wins)', async () => {
      const writes = []
      for (let i = 0; i < 5; i++) {
        writes.push(store.put({ path: '/shared.json' }, { value: i }))
      }

      await Promise.all(writes)

      const result = await store.get({ path: '/shared.json' })
      expect(typeof result.body.value).toBe('number')
    })

    it('handles concurrent read and write', async () => {
      await store.put({ path: '/data.json' }, { initial: true })

      const operations = [
        store.get({ path: '/data.json' }),
        store.put({ path: '/data.json' }, { updated: true }),
        store.get({ path: '/data.json' }),
      ]

      const results = await Promise.all(operations)

      // All operations should complete without error
      expect(results.every(r => r.body !== undefined || r.headers.condition)).toBe(true)
    })
  })

  describe('error handling', () => {
    it('handles permission errors gracefully', async () => {
      // Create a read-only directory scenario would require OS-specific setup
      // Instead test that errors return condition
      const badStore = createFileStore('/nonexistent/path/that/cannot/exist')

      const result = await badStore.put({ path: '/test.json' }, { data: true })

      expect(result.headers.condition).toBe('error')
      expect(result.headers.message).toBeDefined()
    })
  })
})
