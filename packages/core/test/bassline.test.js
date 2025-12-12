import { describe, it, expect } from 'vitest'
import { Bassline } from '../src/bassline.js'
import { routes, resource } from '../src/router.js'

describe('Bassline', () => {
  describe('routing', () => {
    it('matches exact paths', async () => {
      const bl = new Bassline()
      bl.route('/hello', {
        get: () => ({ headers: {}, body: 'world' }),
      })

      const result = await bl.get('bl:///hello')
      expect(result.body).toBe('world')
    })

    it('extracts path parameters', async () => {
      const bl = new Bassline()
      bl.route('/users/:id', {
        get: ({ params }) => ({ headers: {}, body: params.id }),
      })

      const result = await bl.get('bl:///users/123')
      expect(result.body).toBe('123')
    })

    it('extracts multiple parameters', async () => {
      const bl = new Bassline()
      bl.route('/users/:userId/posts/:postId', {
        get: ({ params }) => ({ headers: {}, body: params }),
      })

      const result = await bl.get('bl:///users/alice/posts/42')
      expect(result.body).toEqual({ userId: 'alice', postId: '42' })
    })

    it('returns null for unmatched routes', async () => {
      const bl = new Bassline()
      bl.route('/exists', { get: () => ({ headers: {}, body: 'yes' }) })

      expect(await bl.get('bl:///missing')).toBeNull()
    })

    it('returns null when verb not defined', async () => {
      const bl = new Bassline()
      bl.route('/readonly', { get: () => ({ headers: {}, body: 'data' }) })

      expect(await bl.put('bl:///readonly', {}, 'value')).toBeNull()
    })
  })

  describe('route specificity', () => {
    it('matches more specific routes first (more segments)', async () => {
      const bl = new Bassline()

      // Register in "wrong" order
      bl.route('/cells/:name', {
        get: () => ({ headers: {}, body: 'cell' }),
      })
      bl.route('/cells/:name/value', {
        get: () => ({ headers: {}, body: 'value' }),
      })

      expect((await bl.get('bl:///cells/counter')).body).toBe('cell')
      expect((await bl.get('bl:///cells/counter/value')).body).toBe('value')
    })

    it('matches more specific routes first (more literals)', async () => {
      const bl = new Bassline()

      bl.route('/:a/:b', {
        get: () => ({ headers: {}, body: 'generic' }),
      })
      bl.route('/cells/:name', {
        get: () => ({ headers: {}, body: 'cells' }),
      })

      expect((await bl.get('bl:///cells/counter')).body).toBe('cells')
      expect((await bl.get('bl:///foo/bar')).body).toBe('generic')
    })
  })

  describe('wildcard patterns', () => {
    it('matches wildcard patterns', async () => {
      const bl = new Bassline()

      bl.route('/files/:path*', {
        get: ({ params }) => ({ headers: {}, body: params.path }),
      })

      expect((await bl.get('bl:///files/a')).body).toBe('a')
      expect((await bl.get('bl:///files/a/b/c')).body).toBe('a/b/c')
      expect((await bl.get('bl:///files/deeply/nested/path/file.txt')).body).toBe(
        'deeply/nested/path/file.txt'
      )
    })

    it('prefers specific routes over wildcards', async () => {
      const bl = new Bassline()

      bl.route('/data/:path*', {
        get: () => ({ headers: {}, body: 'wildcard' }),
      })
      bl.route('/data/special', {
        get: () => ({ headers: {}, body: 'specific' }),
      })

      expect((await bl.get('bl:///data/special')).body).toBe('specific')
      expect((await bl.get('bl:///data/other')).body).toBe('wildcard')
      expect((await bl.get('bl:///data/nested/path')).body).toBe('wildcard')
    })
  })

  describe('context object', () => {
    it('passes headers in context', async () => {
      const bl = new Bassline()
      bl.route('/resource', {
        get: ({ headers }) => ({ headers: {}, body: headers.auth }),
      })

      const result = await bl.get('bl:///resource', { auth: 'token123' })
      expect(result.body).toBe('token123')
    })

    it('passes query params in context', async () => {
      const bl = new Bassline()
      bl.route('/search', {
        get: ({ query }) => ({ headers: {}, body: query.get('q') }),
      })

      const result = await bl.get('bl:///search?q=hello')
      expect(result.body).toBe('hello')
    })

    it('passes body in context for put', async () => {
      const bl = new Bassline()
      let received = null
      bl.route('/resource', {
        put: ({ headers, body }) => {
          received = { headers, body }
          return { headers: {}, body: 'ok' }
        },
      })

      await bl.put('bl:///resource', { auth: 'token' }, { value: 42 })
      expect(received.headers.auth).toBe('token')
      expect(received.body.value).toBe(42)
    })

    it('provides bassline instance in context', async () => {
      const bl = new Bassline()
      bl.route('/a', {
        get: () => ({ headers: {}, body: 'from-a' }),
      })
      bl.route('/b', {
        get: async ({ bl }) => {
          const a = await bl.get('bl:///a')
          return { headers: {}, body: `got: ${a.body}` }
        },
      })

      expect((await bl.get('bl:///b')).body).toBe('got: from-a')
    })
  })
})

describe('Router builder', () => {
  it('creates routes with prefix', async () => {
    const bl = new Bassline()

    const cellRoutes = routes('/cells/:name', (r) => {
      r.get('/', () => ({ headers: {}, body: 'cell' }))
      r.get('/value', () => ({ headers: {}, body: 'value' }))
    })

    bl.install(cellRoutes)

    expect((await bl.get('bl:///cells/counter')).body).toBe('cell')
    expect((await bl.get('bl:///cells/counter/value')).body).toBe('value')
  })

  it('supports nested scopes', async () => {
    const bl = new Bassline()

    const apiRoutes = routes('/api', (r) => {
      r.scope('/v1', (r) => {
        r.get('/users', () => ({ headers: {}, body: 'users-v1' }))
      })
      r.scope('/v2', (r) => {
        r.get('/users', () => ({ headers: {}, body: 'users-v2' }))
      })
    })

    bl.install(apiRoutes)

    expect((await bl.get('bl:///api/v1/users')).body).toBe('users-v1')
    expect((await bl.get('bl:///api/v2/users')).body).toBe('users-v2')
  })

  it('supports put routes', async () => {
    const bl = new Bassline()
    let stored = null

    const dataRoutes = routes('/data', (r) => {
      r.put('/:key', ({ params, body }) => {
        stored = { key: params.key, value: body }
        return { headers: {}, body: 'saved' }
      })
    })

    bl.install(dataRoutes)
    await bl.put('bl:///data/mykey', {}, 'myvalue')

    expect(stored).toEqual({ key: 'mykey', value: 'myvalue' })
  })

  it('passes params through scopes', async () => {
    const bl = new Bassline()

    const nestedRoutes = routes('/users/:userId', (r) => {
      r.scope('/posts/:postId', (r) => {
        r.get('/comments', ({ params }) => ({
          headers: {},
          body: params,
        }))
      })
    })

    bl.install(nestedRoutes)

    const result = await bl.get('bl:///users/alice/posts/42/comments')
    expect(result.body).toEqual({ userId: 'alice', postId: '42' })
  })
})

describe('Mountable resources', () => {
  describe('resource()', () => {
    it('creates a router builder with isResource flag', () => {
      const r = resource((r) => {
        r.get('/', () => ({ headers: {}, body: 'index' }))
      })

      expect(r.isResource).toBe(true)
      expect(r.prefix).toBe('')
    })

    it('defines routes relative to root', () => {
      const r = resource((r) => {
        r.get('/', () => ({ headers: {}, body: 'index' }))
        r.get('/:id', () => ({ headers: {}, body: 'item' }))
      })

      // Patterns should be relative (no prefix baked in)
      // '/' becomes '' (empty) since prefix is '', and mount() handles this
      expect(r.definitions.map((d) => d.pattern)).toEqual(['', '/:id'])
    })

    it('supports scopes within resources', () => {
      const r = resource((r) => {
        r.get('/', () => ({ headers: {}, body: 'index' }))
        r.scope('/:id', (r) => {
          r.get('/details', () => ({ headers: {}, body: 'details' }))
          r.put('/update', () => ({ headers: {}, body: 'updated' }))
        })
      })

      expect(r.definitions.map((d) => d.pattern)).toEqual([
        '', // '/' with empty prefix becomes ''
        '/:id/details',
        '/:id/update',
      ])
    })
  })

  describe('bl.mount()', () => {
    it('mounts a resource at a specific path', async () => {
      const bl = new Bassline()

      const cellResource = resource((r) => {
        r.get('/', () => ({ headers: {}, body: 'list' }))
        r.get('/:name', ({ params }) => ({ headers: {}, body: `cell:${params.name}` }))
      })

      bl.mount('/cells', cellResource)

      expect((await bl.get('bl:///cells')).body).toBe('list')
      expect((await bl.get('bl:///cells/counter')).body).toBe('cell:counter')
    })

    it('allows mounting same resource at multiple paths', async () => {
      const bl = new Bassline()

      const itemResource = resource((r) => {
        r.get('/:id', ({ params }) => ({ headers: {}, body: params.id }))
      })

      bl.mount('/v1/items', itemResource)
      bl.mount('/v2/items', itemResource)

      expect((await bl.get('bl:///v1/items/foo')).body).toBe('foo')
      expect((await bl.get('bl:///v2/items/bar')).body).toBe('bar')
    })

    it('inherits params from mount prefix', async () => {
      const bl = new Bassline()

      const cellResource = resource((r) => {
        r.get('/', ({ params }) => ({ headers: {}, body: params }))
        r.get('/:name', ({ params }) => ({ headers: {}, body: params }))
      })

      bl.mount('/namespaces/:ns/cells', cellResource)

      const listResult = await bl.get('bl:///namespaces/prod/cells')
      expect(listResult.body).toEqual({ ns: 'prod' })

      const itemResult = await bl.get('bl:///namespaces/prod/cells/counter')
      expect(itemResult.body).toEqual({ ns: 'prod', name: 'counter' })
    })

    it('handles nested scopes in mounted resources', async () => {
      const bl = new Bassline()

      const userResource = resource((r) => {
        r.get('/', () => ({ headers: {}, body: 'users' }))
        r.scope('/:userId', (r) => {
          r.get('/', ({ params }) => ({ headers: {}, body: `user:${params.userId}` }))
          r.scope('/posts', (r) => {
            r.get('/:postId', ({ params }) => ({
              headers: {},
              body: { userId: params.userId, postId: params.postId },
            }))
          })
        })
      })

      bl.mount('/api/users', userResource)

      expect((await bl.get('bl:///api/users')).body).toBe('users')
      expect((await bl.get('bl:///api/users/alice')).body).toBe('user:alice')
      expect((await bl.get('bl:///api/users/alice/posts/42')).body).toEqual({
        userId: 'alice',
        postId: '42',
      })
    })

    it('handles root mount', async () => {
      const bl = new Bassline()

      const indexResource = resource((r) => {
        r.get('/', () => ({ headers: {}, body: 'root' }))
        r.get('/about', () => ({ headers: {}, body: 'about' }))
      })

      bl.mount('/', indexResource)

      expect((await bl.get('bl:///')).body).toBe('root')
      expect((await bl.get('bl:///about')).body).toBe('about')
    })

    it('supports both get and put handlers', async () => {
      const bl = new Bassline()
      let stored = null

      const dataResource = resource((r) => {
        r.get('/:key', ({ params }) => ({
          headers: {},
          body: stored?.[params.key] ?? null,
        }))
        r.put('/:key', ({ params, body }) => {
          stored = stored || {}
          stored[params.key] = body
          return { headers: {}, body: 'saved' }
        })
      })

      bl.mount('/data', dataResource)

      await bl.put('bl:///data/foo', {}, 'bar')
      expect((await bl.get('bl:///data/foo')).body).toBe('bar')
    })
  })

  describe('bl.install() with resources', () => {
    it('mounts resource at root when using install()', async () => {
      const bl = new Bassline()

      const indexResource = resource((r) => {
        r.get('/', () => ({ headers: {}, body: 'index' }))
        r.get('/status', () => ({ headers: {}, body: 'ok' }))
      })

      bl.install(indexResource)

      expect((await bl.get('bl:///')).body).toBe('index')
      expect((await bl.get('bl:///status')).body).toBe('ok')
    })

    it('still works with traditional routes()', async () => {
      const bl = new Bassline()

      const cellRoutes = routes('/cells', (r) => {
        r.get('/', () => ({ headers: {}, body: 'cells' }))
      })

      bl.install(cellRoutes)

      expect((await bl.get('bl:///cells')).body).toBe('cells')
    })
  })
})
