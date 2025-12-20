import { resource } from '../src/resource.js'

/**
 * Create a mock kit that records all calls
 * @param {object} responses - Map of path patterns to responses
 * @returns {object} Kit with get/put and inspection methods
 */
export function createMockKit(responses = {}) {
  const calls = []

  const findResponse = (method, path) => {
    for (const [pattern, response] of Object.entries(responses)) {
      if (path === pattern || path.startsWith(pattern)) {
        return typeof response === 'function' ? response : response
      }
    }
    return { headers: {}, body: null }
  }

  const kit = resource({
    get: async h => {
      calls.push({ method: 'get', headers: h })
      return findResponse('get', h.path)
    },
    put: async (h, b) => {
      calls.push({ method: 'put', headers: h, body: b })
      return findResponse('put', h.path)
    },
  })

  // Attach inspection methods
  kit.calls = () => calls
  kit.reset = () => {
    calls.length = 0
  }
  kit.getCalls = method => calls.filter(c => c.method === method)
  kit.getCall = index => calls[index]
  kit.lastCall = () => calls[calls.length - 1]

  return kit
}

/**
 * Create request headers with defaults
 * @param overrides
 */
export function headers(overrides = {}) {
  return {
    path: '/',
    params: {},
    ...overrides,
  }
}

/**
 * Create request headers with mock kit
 * @param overrides
 * @param kitResponses
 */
export function headersWithKit(overrides = {}, kitResponses = {}) {
  return {
    path: '/',
    params: {},
    kit: createMockKit(kitResponses),
    ...overrides,
  }
}

/**
 * Assert response has expected condition
 * @param response
 * @param expectedCondition
 * @param expectedMessage
 */
export function assertCondition(response, expectedCondition, expectedMessage) {
  if (response.headers.condition !== expectedCondition) {
    throw new Error(`Expected condition '${expectedCondition}' but got '${response.headers.condition}'`)
  }
  if (expectedMessage && response.headers.message !== expectedMessage) {
    throw new Error(`Expected message '${expectedMessage}' but got '${response.headers.message}'`)
  }
}

/**
 * Assert response is successful (no condition)
 * @param response
 */
export function assertSuccess(response) {
  if (response.headers.condition) {
    throw new Error(`Expected success but got condition '${response.headers.condition}': ${response.headers.message}`)
  }
}

/**
 * Assert response body matches expected
 * @param response
 * @param expected
 */
export function assertBody(response, expected) {
  const actual = JSON.stringify(response.body)
  const exp = JSON.stringify(expected)
  if (actual !== exp) {
    throw new Error(`Expected body ${exp} but got ${actual}`)
  }
}
