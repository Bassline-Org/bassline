import Anthropic from '@anthropic-ai/sdk'
import { routes } from '@bassline/core'

/**
 * Create Claude service routes for interacting with the Anthropic API.
 *
 * @param {object} options - Configuration options
 * @param {string} [options.apiKey] - Anthropic API key (defaults to ANTHROPIC_API_KEY env var)
 * @param {string} [options.model='claude-sonnet-4-20250514'] - Default model to use
 * @returns {object} Claude service with routes and client
 */
export function createClaudeService(options = {}) {
  const {
    apiKey = process.env.ANTHROPIC_API_KEY,
    model = 'claude-sonnet-4-20250514'
  } = options

  const client = new Anthropic({ apiKey })

  const claudeRoutes = routes('/services/claude', r => {
    // Service info
    r.get('/', () => ({
      headers: { type: 'bl:///types/service' },
      body: {
        name: 'Claude',
        description: 'Anthropic Claude API',
        model,
        capabilities: ['messages', 'tools', 'complete']
      }
    }))

    // Messages API - full access to Claude messages
    r.put('/messages', async ({ body }) => {
      const {
        messages,
        system,
        tools,
        max_tokens = 4096,
        temperature,
        stop_sequences
      } = body

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
        headers: { type: 'bl:///types/claude-response' },
        body: response
      }
    })

    // Simple completion helper - text in/out
    r.put('/complete', async ({ body }) => {
      const { prompt, system, max_tokens = 4096 } = body

      const params = {
        model: body.model || model,
        max_tokens,
        messages: [{ role: 'user', content: prompt }]
      }

      if (system) params.system = system

      const response = await client.messages.create(params)

      // Extract text from response
      const text = response.content
        .filter(c => c.type === 'text')
        .map(c => c.text)
        .join('')

      return {
        headers: { type: 'bl:///types/completion' },
        body: {
          text,
          usage: response.usage,
          stop_reason: response.stop_reason
        }
      }
    })
  })

  return {
    routes: claudeRoutes,
    /** The Anthropic client for direct access */
    client,
    /** Default model */
    model,
    /**
     * Install Claude routes into a Bassline instance
     * @param {import('@bassline/core').Bassline} bl
     */
    install: (bl) => bl.install(claudeRoutes)
  }
}
