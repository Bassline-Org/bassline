import Anthropic from '@anthropic-ai/sdk'
import { resource } from '@bassline/core'
import { runAgentLoop } from './mcp-server.js'

/**
 * Create Claude service routes for interacting with the Anthropic API.
 *
 * @param {object} options - Configuration options
 * @param {string} [options.apiKey] - Anthropic API key (defaults to ANTHROPIC_API_KEY env var)
 * @param {string} [options.model='claude-sonnet-4-20250514'] - Default model to use
 * @returns {object} Claude service with routes and client
 */
export function createClaudeService(options = {}) {
  const { apiKey = process.env.ANTHROPIC_API_KEY, model = 'claude-sonnet-4-20250514' } = options

  const client = new Anthropic({ apiKey })

  // Store bl reference when installed (for agent route)
  let _bl = null

  const claudeResource = resource((r) => {
    // Service info with structured operations
    r.get('/', () => ({
      headers: { type: 'bl:///types/service' },
      body: {
        name: 'Claude',
        description: 'Anthropic Claude API integration',
        version: '1.0.0',
        model,
        operations: [
          {
            name: 'messages',
            method: 'PUT',
            path: '/services/claude/messages',
            description: 'Send messages to Claude API with full parameter control',
            input: {
              type: 'object',
              properties: {
                messages: { type: 'array', description: 'Conversation messages [{role, content}]' },
                system: { type: 'string', description: 'System prompt' },
                model: { type: 'string', description: 'Model override' },
                tools: { type: 'array', description: 'Tool definitions for function calling' },
                max_tokens: { type: 'number', default: 4096 },
                temperature: { type: 'number', description: '0-1 sampling temperature' },
              },
              required: ['messages'],
            },
            output: { description: 'Full Anthropic API response' },
          },
          {
            name: 'complete',
            method: 'PUT',
            path: '/services/claude/complete',
            description: 'Simple text completion - prompt in, text out',
            input: {
              type: 'object',
              properties: {
                prompt: { type: 'string', description: 'The prompt to complete' },
                system: { type: 'string', description: 'System prompt' },
                max_tokens: { type: 'number', default: 4096 },
              },
              required: ['prompt'],
            },
            output: {
              type: 'object',
              properties: {
                text: { type: 'string', description: 'Generated text' },
                usage: { type: 'object', description: 'Token usage stats' },
                stop_reason: { type: 'string' },
              },
            },
          },
          {
            name: 'agent',
            method: 'PUT',
            path: '/services/claude/agent',
            description: 'Run agentic loop - Claude can use Bassline tools to complete tasks',
            input: {
              type: 'object',
              properties: {
                prompt: { type: 'string', description: 'Task for the agent to perform' },
                system: { type: 'string', description: 'System prompt' },
                maxTurns: { type: 'number', default: 10, description: 'Max tool-use iterations' },
              },
              required: ['prompt'],
            },
            output: { description: 'Final Claude response after tool execution completes' },
          },
        ],
      },
    }))

    // Messages API - full access to Claude messages
    r.put('/messages', async ({ body }) => {
      const { messages, system, tools, max_tokens = 4096, temperature, stop_sequences } = body

      const params = {
        model: body.model || model,
        max_tokens,
        messages,
      }

      if (system) params.system = system
      if (tools) params.tools = tools
      if (temperature !== undefined) params.temperature = temperature
      if (stop_sequences) params.stop_sequences = stop_sequences

      const response = await client.messages.create(params)

      return {
        headers: { type: 'bl:///types/claude-response' },
        body: response,
      }
    })

    // Simple completion helper - text in/out
    r.put('/complete', async ({ body }) => {
      const { prompt, system, max_tokens = 4096 } = body

      const params = {
        model: body.model || model,
        max_tokens,
        messages: [{ role: 'user', content: prompt }],
      }

      if (system) params.system = system

      const response = await client.messages.create(params)

      // Extract text from response
      const text = response.content
        .filter((c) => c.type === 'text')
        .map((c) => c.text)
        .join('')

      return {
        headers: { type: 'bl:///types/completion' },
        body: {
          text,
          usage: response.usage,
          stop_reason: response.stop_reason,
        },
      }
    })

    // Agent mode - run agentic loop with Bassline tools
    r.put('/agent', async ({ body }) => {
      if (!_bl) {
        throw new Error('Claude service not installed - call install(bl) first')
      }

      const { prompt, system, maxTurns = 10 } = body

      const result = await runAgentLoop(
        _bl,
        { client, model },
        {
          prompt,
          system,
          maxTurns,
        }
      )

      return {
        headers: { type: 'bl:///types/agent-result' },
        body: result,
      }
    })
  })

  return {
    routes: claudeResource,
    /** The Anthropic client for direct access */
    client,
    /** Default model */
    model,
    /**
     * Install Claude routes into a Bassline instance
     * @param {import('@bassline/core').Bassline} bl
     * @param {object} [options] - Options
     * @param {string} [options.prefix='/services/claude'] - Mount prefix
     */
    install: (bl, { prefix = '/services/claude' } = {}) => {
      _bl = bl
      bl.mount(prefix, claudeResource)
    },
  }
}
