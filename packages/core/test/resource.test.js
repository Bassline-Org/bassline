import { describe, it, expect } from 'vitest'
import { resource, routes, bind, splitPath, notFound } from '../src/resource.js'
import { createMockKit } from './helpers.js'

describe('splitPath', () => {
  it('splits path into segment and remaining', () => {
    expect(splitPath('/foo/bar/baz')).toEqual(['foo', '/bar/baz'])
    expect(splitPath('/foo/bar')).toEqual(['foo', '/bar'])
    expect(splitPath('/foo')).toEqual(['foo', '/'])
  })

  it('handles root path', () => {
    expect(splitPath('/')).toEqual([undefined, '/'])
    expect(splitPath('')).toEqual([undefined, '/'])
  })

  it('handles null/undefined', () => {
    expect(splitPath(null)).toEqual([undefined, '/'])
    expect(splitPath(undefined)).toEqual([undefined, '/'])
  })

  it('normalizes trailing slashes', () => {
    expect(splitPath('/foo/')).toEqual(['foo', '/'])
    // Note: trailing slashes on remaining path are stripped by filter(Boolean)
    expect(splitPath('/foo/bar/')).toEqual(['foo', '/bar'])
  })

  it('handles multiple consecutive slashes', () => {
    expect(splitPath('/foo//bar')).toEqual(['foo', '/bar'])
  })
})

describe('resource', () => {
  it('creates resource with get and put', () => {
    const r = resource({
      get: async () => ({ headers: {}, body: 'get' }),
      put: async () => ({ headers: {}, body: 'put' }),
    })

    expect(r).toHaveProperty('get')
    expect(r).toHaveProperty('put')
  })

  it('defaults to notFound for missing handlers', async () => {
    const r = resource({})
    const result = await r.get({})
    expect(result.headers.condition).toBe('not-found')
  })

  it('wraps handlers with try-catch', async () => {
    const r = resource({
      get: async () => {
        throw new Error('test error')
      },
    })

    const result = await r.get({})
    expect(result.headers.condition).toBe('error')
    expect(result.headers.message).toBe('test error')
    expect(result.body).toBe(null)
  })

  it('signals conditions via kit when available', async () => {
    const kit = createMockKit()
    const r = resource({
      get: async () => {
        throw new Error('test error')
      },
    })

    await r.get({ kit, path: '/test' })

    const calls = kit.calls()
    expect(calls.length).toBe(1)
    expect(calls[0].headers.path).toBe('/condition')
    expect(calls[0].body.error).toBe('test error')
  })

  it('gracefully handles missing kit', async () => {
    const r = resource({
      get: async () => {
        throw new Error('test error')
      },
    })

    // Should not throw even without kit
    const result = await r.get({})
    expect(result.headers.condition).toBe('error')
  })
})

describe('routes', () => {
  it('dispatches to named routes', async () => {
    const app = routes({
      foo: resource({
        get: async () => ({ headers: {}, body: 'foo' }),
      }),
      bar: resource({
        get: async () => ({ headers: {}, body: 'bar' }),
      }),
    })

    const fooResult = await app.get({ path: '/foo' })
    expect(fooResult.body).toBe('foo')

    const barResult = await app.get({ path: '/bar' })
    expect(barResult.body).toBe('bar')
  })

  it('dispatches to root with empty string key', async () => {
    const app = routes({
      '': resource({
        get: async () => ({ headers: {}, body: 'root' }),
      }),
    })

    const result = await app.get({ path: '/' })
    expect(result.body).toBe('root')
  })

  it('falls back to unknown handler', async () => {
    const app = routes({
      unknown: resource({
        get: async h => ({ headers: {}, body: `unknown: ${h.segment}` }),
      }),
    })

    const result = await app.get({ path: '/anything' })
    expect(result.body).toBe('unknown: anything')
  })

  it('returns not-found for unmatched routes', async () => {
    const app = routes({
      foo: resource({
        get: async () => ({ headers: {}, body: 'foo' }),
      }),
    })

    const result = await app.get({ path: '/bar' })
    expect(result.headers.condition).toBe('not-found')
  })

  it('passes remaining path to nested resource', async () => {
    const app = routes({
      foo: resource({
        get: async h => ({ headers: {}, body: h.path }),
      }),
    })

    const result = await app.get({ path: '/foo/bar/baz' })
    expect(result.body).toBe('/bar/baz')
  })

  it('adds segment to headers', async () => {
    const app = routes({
      foo: resource({
        get: async h => ({ headers: {}, body: h.segment }),
      }),
    })

    const result = await app.get({ path: '/foo' })
    expect(result.body).toBe('foo')
  })

  it('nests routes', async () => {
    const app = routes({
      api: routes({
        users: resource({
          get: async () => ({ headers: {}, body: 'users' }),
        }),
      }),
    })

    const result = await app.get({ path: '/api/users' })
    expect(result.body).toBe('users')
  })
})

describe('bind', () => {
  it('captures path segment as param', async () => {
    const app = routes({
      users: bind(
        'id',
        resource({
          get: async h => ({ headers: {}, body: { id: h.params.id } }),
        })
      ),
    })

    const result = await app.get({ path: '/users/123' })
    expect(result.body.id).toBe('123')
  })

  it('accumulates params through nested binds', async () => {
    const app = routes({
      users: bind(
        'userId',
        routes({
          posts: bind(
            'postId',
            resource({
              get: async h => ({
                headers: {},
                body: { userId: h.params.userId, postId: h.params.postId },
              }),
            })
          ),
        })
      ),
    })

    const result = await app.get({ path: '/users/alice/posts/42' })
    expect(result.body.userId).toBe('alice')
    expect(result.body.postId).toBe('42')
  })

  it('preserves existing params', async () => {
    const app = routes({
      users: bind(
        'id',
        resource({
          get: async h => ({
            headers: {},
            body: { id: h.params.id, existing: h.params.existing },
          }),
        })
      ),
    })

    const result = await app.get({ path: '/users/123', params: { existing: 'value' } })
    expect(result.body.existing).toBe('value')
    expect(result.body.id).toBe('123')
  })

  it('advances path after capture', async () => {
    const app = routes({
      users: bind(
        'id',
        resource({
          get: async h => ({ headers: {}, body: { path: h.path } }),
        })
      ),
    })

    const result = await app.get({ path: '/users/123/details' })
    expect(result.body.path).toBe('/details')
  })
})

describe('notFound', () => {
  it('returns condition not-found', async () => {
    const result = await notFound()
    expect(result.headers.condition).toBe('not-found')
    expect(result.body).toBe(null)
  })
})
