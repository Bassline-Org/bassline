import { describe, it, expect } from 'vitest'
import { createServices } from '../src/service.js'
import { resource } from '@bassline/core'

describe('createServices', () => {
  describe('service directory', () => {
    it('lists services at root', async () => {
      const services = createServices()
      const result = await services.routes.get({ path: '/' })

      expect(result.headers.type).toBe('/types/service-directory')
      expect(result.body.name).toBe('services')
      expect(result.body.resources).toEqual({})
    })

    it('lists registered services', async () => {
      const services = createServices()

      const mockService = resource({
        get: async () => ({ headers: {}, body: 'test' }),
      })

      services.register('test', mockService)
      services.register('other', mockService)

      const result = await services.routes.get({ path: '/' })

      expect(result.body.resources).toHaveProperty('/test')
      expect(result.body.resources).toHaveProperty('/other')
    })
  })

  describe('registration', () => {
    it('registers service', () => {
      const services = createServices()
      const mockService = resource({
        get: async () => ({ headers: {}, body: 'hello' }),
      })

      services.register('hello', mockService)

      expect(services.get('hello')).toBe(mockService)
    })

    it('lists registered service names', () => {
      const services = createServices()

      services.register('a', resource({}))
      services.register('b', resource({}))
      services.register('c', resource({}))

      expect(services.list()).toEqual(['a', 'b', 'c'])
    })

    it('returns undefined for unregistered service', () => {
      const services = createServices()
      expect(services.get('nonexistent')).toBeUndefined()
    })

    it('overwrites existing registration', () => {
      const services = createServices()

      const first = resource({ get: async () => ({ headers: {}, body: 'first' }) })
      const second = resource({ get: async () => ({ headers: {}, body: 'second' }) })

      services.register('test', first)
      services.register('test', second)

      expect(services.get('test')).toBe(second)
    })
  })

  describe('routing to services', () => {
    it('routes GET to registered service', async () => {
      const services = createServices()

      const mockService = resource({
        get: async h => ({
          headers: { type: '/types/mock' },
          body: { receivedPath: h.path },
        }),
      })

      services.register('mock', mockService)

      const result = await services.routes.get({ path: '/mock' })

      expect(result.headers.type).toBe('/types/mock')
      expect(result.body.receivedPath).toBe('/')
    })

    it('routes PUT to registered service', async () => {
      const services = createServices()

      const mockService = resource({
        put: async (h, body) => ({
          headers: {},
          body: { received: body },
        }),
      })

      services.register('echo', mockService)

      const result = await services.routes.put({ path: '/echo' }, { data: 'test' })

      expect(result.body.received).toEqual({ data: 'test' })
    })

    it('returns not-found for unknown service', async () => {
      const services = createServices()

      const getResult = await services.routes.get({ path: '/unknown' })
      expect(getResult.headers.condition).toBe('not-found')

      const putResult = await services.routes.put({ path: '/unknown' }, {})
      expect(putResult.headers.condition).toBe('not-found')
    })

    it('preserves headers when routing', async () => {
      const services = createServices()
      let receivedHeaders = null

      const mockService = resource({
        get: async h => {
          receivedHeaders = h
          return { headers: {}, body: 'ok' }
        },
      })

      services.register('test', mockService)

      await services.routes.get({
        path: '/test',
        params: { custom: 'param' },
        kit: { fake: 'kit' },
      })

      // Params includes both custom param and bound name
      expect(receivedHeaders.params.custom).toBe('param')
      expect(receivedHeaders.kit).toEqual({ fake: 'kit' })
    })
  })

  describe('service isolation', () => {
    it('services are independent', async () => {
      const services = createServices()

      const callCount = { a: 0, b: 0 }

      const serviceA = resource({
        get: async () => {
          callCount.a++
          return { headers: {}, body: 'a' }
        },
      })

      const serviceB = resource({
        get: async () => {
          callCount.b++
          return { headers: {}, body: 'b' }
        },
      })

      services.register('a', serviceA)
      services.register('b', serviceB)

      await services.routes.get({ path: '/a' })
      await services.routes.get({ path: '/a' })
      await services.routes.get({ path: '/b' })

      expect(callCount.a).toBe(2)
      expect(callCount.b).toBe(1)
    })
  })
})
