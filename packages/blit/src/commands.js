/**
 * Unified `bl` command for blit boot scripts.
 *
 * All resource access goes through a single command with typed headers:
 *
 *   bl get {path /cells/counter/value}
 *   bl put {path /cells/counter/value type js/num} 42
 *   bl put {path /store/config type tcl/dict} {theme dark debug true}
 *   bl put {path /sql/query} {SELECT * FROM users}
 *
 * Response is a TCL dict with headers and body:
 *   {headers {type js/num} body 42}
 */

import { parseList, tclDictToObject, formatTclResponse } from '@bassline/tcl'

/**
 * Parse body based on type header.
 * @param {string} type - Content type from headers
 * @param {string} body - Raw body string
 * @returns {any} - Parsed value
 */
const parseBody = (type, body) => {
  if (!type || type === 'text/plain' || type === 'js/str') {
    return body
  }

  switch (type) {
    case 'tcl/dict':
      return tclDictToObject(body)
    case 'tcl/list':
      return parseList(body)
    case 'js/num':
      return parseFloat(body)
    case 'json':
    case 'js/obj':
      return JSON.parse(body)
    case 'js/arr':
      return JSON.parse(body)
    case 'js/bool':
      return body === 'true' || body === '1'
    case 'js/null':
      return null
    default:
      return body
  }
}

/**
 * Create blit-specific TCL commands.
 * @param {object} conn - SQLite connection (for direct access if needed)
 * @param {object} kit - The blit's kit (all access goes through this)
 */
export function createBlitCommands(conn, kit) {
  return {
    /**
     * bl get {headers}
     * bl put {headers} body
     * @param args
     */
    bl: async args => {
      const [method, headersStr, ...rest] = args

      if (!method || !headersStr) {
        throw new Error('usage: bl get|put {headers} ?body?')
      }

      // Parse headers from TCL dict
      const headers = tclDictToObject(headersStr)

      if (method === 'get') {
        const result = await kit.get(headers)
        return formatTclResponse(result)
      }

      if (method === 'put') {
        const bodyStr = rest.join(' ')
        const body = parseBody(headers.type, bodyStr)
        const result = await kit.put(headers, body)
        return formatTclResponse(result)
      }

      throw new Error(`bl: unknown method "${method}"`)
    },
  }
}
