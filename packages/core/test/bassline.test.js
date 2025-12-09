import { describe, it, expect } from 'vitest'
import { Bassline } from '../src/bassline.js'
import { routes } from '../src/router.js'

describe('Bassline', () => {
  describe('routing', () => {
    it('matches exact paths', () => {
      const bl = new Bassline()
      bl.route('/hello', {
        get: () => ({ headers: {}, body: 'world' })
      })

      const result = bl.get('bl:///hello')
      expect(result.body).toBe('world')
    })

    it('extracts path parameters', () => {
      const bl = new Bassline()
      bl.route('/users/:id', {
        get: (params) => ({ headers: {}, body: params.id })
      })

      const result = bl.get('bl:///users/123')
      expect(result.body).toBe('123')
    })

    it('extracts multiple parameters', () => {
      const bl = new Bassline()
      bl.route('/users/:userId/posts/:postId', {
        get: (params) => ({ headers: {}, body: params })
      })

      const result = bl.get('bl:///users/alice/posts/42')
      expect(result.body).toEqual({ userId: 'alice', postId: '42' })
    })

    it('returns null for unmatched routes', () => {
      const bl = new Bassline()
      bl.route('/exists', { get: () => ({ headers: {}, body: 'yes' }) })

      expect(bl.get('bl:///missing')).toBeNull()
    })

    it('returns null when verb not defined', () => {
      const bl = new Bassline()
      bl.route('/readonly', { get: () => ({ headers: {}, body: 'data' }) })

      expect(bl.put('bl:///readonly', {}, 'value')).toBeNull()
    })
  })

  describe('route specificity', () => {
    it('matches more specific routes first (more segments)', () => {
      const bl = new Bassline()

      // Register in "wrong" order
      bl.route('/cells/:name', {
        get: () => ({ headers: {}, body: 'cell' })
      })
      bl.route('/cells/:name/value', {
        get: () => ({ headers: {}, body: 'value' })
      })

      expect(bl.get('bl:///cells/counter').body).toBe('cell')
      expect(bl.get('bl:///cells/counter/value').body).toBe('value')
    })

    it('matches more specific routes first (more literals)', () => {
      const bl = new Bassline()

      bl.route('/:a/:b', {
        get: () => ({ headers: {}, body: 'generic' })
      })
      bl.route('/cells/:name', {
        get: () => ({ headers: {}, body: 'cells' })
      })

      expect(bl.get('bl:///cells/counter').body).toBe('cells')
      expect(bl.get('bl:///foo/bar').body).toBe('generic')
    })
  })

  describe('get and put', () => {
    it('passes headers to get handler', () => {
      const bl = new Bassline()
      bl.route('/resource', {
        get: (params, headers) => ({ headers: {}, body: headers.auth })
      })

      const result = bl.get('bl:///resource', { auth: 'token123' })
      expect(result.body).toBe('token123')
    })

    it('passes body and headers to put handler', () => {
      const bl = new Bassline()
      let received = null
      bl.route('/resource', {
        put: (params, headers, body) => {
          received = { headers, body }
          return { headers: {}, body: 'ok' }
        }
      })

      bl.put('bl:///resource', { auth: 'token' }, { value: 42 })
      expect(received.headers.auth).toBe('token')
      expect(received.body.value).toBe(42)
    })

    it('provides bassline instance to handlers', () => {
      const bl = new Bassline()
      bl.route('/a', {
        get: () => ({ headers: {}, body: 'from-a' })
      })
      bl.route('/b', {
        get: (params, headers, bassline) => {
          const a = bassline.get('bl:///a')
          return { headers: {}, body: `got: ${a.body}` }
        }
      })

      expect(bl.get('bl:///b').body).toBe('got: from-a')
    })
  })
})

describe('Router builder', () => {
  it('creates routes with prefix', () => {
    const bl = new Bassline()

    const cellRoutes = routes('/cells/:name', r => {
      r.get('/', () => ({ headers: {}, body: 'cell' }))
      r.get('/value', () => ({ headers: {}, body: 'value' }))
    })

    bl.install(cellRoutes)

    expect(bl.get('bl:///cells/counter').body).toBe('cell')
    expect(bl.get('bl:///cells/counter/value').body).toBe('value')
  })

  it('supports nested scopes', () => {
    const bl = new Bassline()

    const apiRoutes = routes('/api', r => {
      r.scope('/v1', r => {
        r.get('/users', () => ({ headers: {}, body: 'users-v1' }))
      })
      r.scope('/v2', r => {
        r.get('/users', () => ({ headers: {}, body: 'users-v2' }))
      })
    })

    bl.install(apiRoutes)

    expect(bl.get('bl:///api/v1/users').body).toBe('users-v1')
    expect(bl.get('bl:///api/v2/users').body).toBe('users-v2')
  })

  it('supports put routes', () => {
    const bl = new Bassline()
    let stored = null

    const dataRoutes = routes('/data', r => {
      r.put('/:key', (params, headers, body) => {
        stored = { key: params.key, value: body }
        return { headers: {}, body: 'saved' }
      })
    })

    bl.install(dataRoutes)
    bl.put('bl:///data/mykey', {}, 'myvalue')

    expect(stored).toEqual({ key: 'mykey', value: 'myvalue' })
  })

  it('passes params through scopes', () => {
    const bl = new Bassline()

    const nestedRoutes = routes('/users/:userId', r => {
      r.scope('/posts/:postId', r => {
        r.get('/comments', (params) => ({
          headers: {},
          body: params
        }))
      })
    })

    bl.install(nestedRoutes)

    const result = bl.get('bl:///users/alice/posts/42/comments')
    expect(result.body).toEqual({ userId: 'alice', postId: '42' })
  })
})
