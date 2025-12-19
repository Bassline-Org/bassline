import Anthropic from '@anthropic-ai/sdk'
import { resource, routes } from '@bassline/core'
import { runAgentLoop } from './mcp-server.js'

/**
 * Create Claude service resource
 *
 * Routes:
 *   GET  /           → service info with operations
 *   PUT  /messages   → full Claude messages API
 *   PUT  /complete   → simple text completion
 *   PUT  /agent      → agentic loop with Bassline tools
 *
 * @param {object} options
 * @param {string} [options.apiKey] - Anthropic API key (defaults to ANTHROPIC_API_KEY env)
 * @param {string} [options.model='claude-sonnet-4-20250514'] - Default model
 */
export function createClaude(options = {}) {
  const {
    apiKey = process.env.ANTHROPIC_API_KEY,
    model = 'claude-sonnet-4-20250514'
  } = options

  const client = new Anthropic({ apiKey })

  return routes({
    '': resource({
      get: async () => ({
        headers: { type: '/types/service' },
        body: {
          name: 'claude',
          description: 'Anthropic Claude API integration',
          model,
          operations: [
            { name: 'messages', method: 'PUT', path: '/messages' },
            { name: 'complete', method: 'PUT', path: '/complete' },
            { name: 'agent', method: 'PUT', path: '/agent' }
          ]
        }
      })
    }),

    messages: resource({
      put: async (h, body) => {
        const { messages, system, tools, max_tokens = 4096, temperature, stop_sequences } = body

        const params = {
          model: body.model || model,
          max_tokens,
          messages
        }

        if (system) params.system = system
        if (tools) params.tools = tools
        if (temperature !== undefined) params.temperature = temperature
        if (stop_sequences) params.stop_sequences = stop_sequences

        const response = await client.messages.create(params)

        return {
          headers: { type: '/types/claude-response' },
          body: response
        }
      }
    }),

    complete: resource({
      put: async (h, body) => {
        const { prompt, system, max_tokens = 4096 } = body

        const params = {
          model: body.model || model,
          max_tokens,
          messages: [{ role: 'user', content: prompt }]
        }

        if (system) params.system = system

        const response = await client.messages.create(params)

        const text = response.content
          .filter(c => c.type === 'text')
          .map(c => c.text)
          .join('')

        return {
          headers: { type: '/types/completion' },
          body: { text, usage: response.usage, stop_reason: response.stop_reason }
        }
      }
    }),

    agent: resource({
      put: async (h, body) => {
        if (!h.kit) {
          throw new Error('Agent requires kit for Bassline access')
        }

        const { prompt, system, maxTurns = 10 } = body

        // Create a bl-like interface from kit for the agent loop
        const blInterface = {
          get: async (uri) => h.kit.get({ path: uri.replace(/^bl:\/\//, '') }),
          put: async (uri, headers, reqBody) => h.kit.put({ path: uri.replace(/^bl:\/\//, ''), ...headers }, reqBody)
        }

        const result = await runAgentLoop(
          blInterface,
          { client, model },
          { prompt, system, maxTurns }
        )

        return {
          headers: { type: '/types/agent-result' },
          body: result
        }
      }
    })
  })
}

export default createClaude
