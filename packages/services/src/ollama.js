import { resource, routes } from '@bassline/core'

/**
 * Create Ollama service resource
 *
 * Routes:
 * GET  /           → service info with operations and config
 * GET  /models     → list installed models
 * PUT  /generate   → text generation (prompt → completion)
 * PUT  /chat       → chat completion (messages → response)
 * @param {object} options
 * @param {string} [options.baseUrl] - Ollama server URL (defaults to http://localhost:11434)
 * @param {string} [options.model] - Default model
 */
export function createOllama(options = {}) {
  const { baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434', model = 'mistral' } = options

  return routes({
    '': resource({
      get: async () => ({
        headers: { type: '/types/service' },
        body: {
          name: 'ollama',
          description: 'Local LLM via Ollama',
          baseUrl,
          model,
          operations: [
            { name: 'models', method: 'GET', path: '/models' },
            { name: 'generate', method: 'PUT', path: '/generate' },
            { name: 'chat', method: 'PUT', path: '/chat' },
          ],
        },
      }),
    }),

    models: resource({
      get: async () => {
        const response = await fetch(`${baseUrl}/api/tags`)
        const data = await response.json()
        return {
          headers: { type: '/types/model-list' },
          body: data.models || [],
        }
      },
    }),

    generate: resource({
      put: async (h, body) => {
        const { prompt, system, options: genOptions } = body

        const response = await fetch(`${baseUrl}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: body.model || model,
            prompt,
            system,
            stream: false,
            options: genOptions,
          }),
        })

        const result = await response.json()
        return {
          headers: { type: '/types/ollama-response' },
          body: {
            text: result.response,
            model: result.model,
            done: result.done,
          },
        }
      },
    }),

    chat: resource({
      put: async (h, body) => {
        const { messages, system, tools, options: chatOptions } = body

        const requestBody = {
          model: body.model || model,
          messages: system ? [{ role: 'system', content: system }, ...messages] : messages,
          stream: false,
          options: chatOptions,
        }

        // Add tools if provided (for function calling)
        if (tools && tools.length > 0) {
          requestBody.tools = tools
        }

        // Debug: store what we're sending in kit if available
        if (h.kit) {
          await h.kit.put(
            { path: '/store/_debug/ollama_chat_request' },
            {
              ts: Date.now(),
              hasTools: !!tools,
              toolCount: tools?.length || 0,
              requestBody,
            }
          )
        }

        const response = await fetch(`${baseUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        })

        const result = await response.json()

        // Debug: store raw response
        if (h.kit) {
          await h.kit.put(
            { path: '/store/_debug/ollama_chat_response' },
            {
              ts: Date.now(),
              rawResult: result,
            }
          )
        }

        // Build response, including tool_calls if present
        const responseBody = {
          text: result.message?.content,
          role: result.message?.role,
          model: result.model,
          done: result.done,
        }

        // Include tool_calls if the model wants to call functions
        if (result.message?.tool_calls) {
          responseBody.tool_calls = result.message.tool_calls
        }

        return {
          headers: { type: '/types/ollama-response' },
          body: responseBody,
        }
      },
    }),

    // Simple prompt → response endpoint for TCL
    ask: resource({
      put: async (h, body) => {
        const { prompt, system } = body

        const messages = system
          ? [
              { role: 'system', content: system },
              { role: 'user', content: prompt },
            ]
          : [{ role: 'user', content: prompt }]

        const response = await fetch(`${baseUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: body.model || model,
            messages,
            stream: false,
          }),
        })

        const result = await response.json()
        return {
          headers: { type: '/types/ollama-response' },
          body: result.message?.content || '',
        }
      },
    }),
  })
}

export default createOllama
