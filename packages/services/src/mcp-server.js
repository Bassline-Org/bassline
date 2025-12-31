/**
 * Create MCP-style tools that allow Claude to interact with Bassline.
 *
 * Provides a single unified `bl` tool that uses the native Bassline protocol
 * (headers + body) for all resource interactions.
 * @param {object} kit - Bassline kit with get/put methods
 * @returns {Array<object>} Array of tool definitions with handlers
 */
export function createMCPTools(kit) {
  return [
    {
      name: 'bl',
      description: `Interact with Bassline resources using the native protocol.

Use GET {path:"/"} to explore available resources.
Use GET {path:"/guide"} to learn how the system works.

Key paths:
- /cells/* - Lattice-based state (monotonic merge)
- /store/* - Key/value storage
- /fn/* - Stored functions
- /tcl/eval - Evaluate TCL scripts (persistent state)
- /guide - System documentation (readable and writable)

Headers control routing and behavior. Common headers:
- path: Resource path (required)
- type: Content type hint (e.g., "tcl/dict", "js/num")`,
      input_schema: {
        type: 'object',
        properties: {
          method: {
            type: 'string',
            enum: ['get', 'put'],
            description: 'HTTP-like method: get to read, put to write',
          },
          headers: {
            type: 'object',
            description: 'Request headers including path',
            properties: {
              path: { type: 'string', description: 'Resource path (e.g., /cells/counter)' },
              type: { type: 'string', description: 'Content type for body (e.g., tcl/dict, js/num)' },
            },
            required: ['path'],
          },
          body: {
            description: 'Body for PUT requests (string, object, or array)',
          },
        },
        required: ['method', 'headers'],
      },
      handler: async ({ method, headers, body }) => {
        try {
          const result = method === 'get' ? await kit.get(headers) : await kit.put(headers, body)
          return JSON.stringify(result, null, 2)
        } catch (err) {
          return JSON.stringify({ error: err.message })
        }
      },
    },
  ]
}

/**
 * Run an agentic loop where Claude can use tools to interact with Bassline.
 * @param {object} kit - Bassline kit with get/put methods
 * @param {object} claudeService - Claude service with client and model
 * @param {object} options - Loop options
 * @param {string} options.prompt - Initial user prompt
 * @param {string} [options.system] - System prompt
 * @param {number} [options.maxTurns] - Maximum conversation turns
 * @param {string} [options.model] - Override model
 * @returns {Promise<object>} Final Claude response
 */
export async function runAgentLoop(kit, claudeService, options = {}) {
  const { prompt, system, maxTurns = 10, model = claudeService.model } = options

  const tools = createMCPTools(kit)
  const messages = [{ role: 'user', content: prompt }]

  for (let turn = 0; turn < maxTurns; turn++) {
    const response = await claudeService.client.messages.create({
      model,
      max_tokens: 4096,
      system,
      messages,
      tools: tools.map(t => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema,
      })),
    })

    // Add assistant response to history
    messages.push({ role: 'assistant', content: response.content })

    // Check for tool use
    const toolUses = response.content.filter(c => c.type === 'tool_use')
    if (toolUses.length === 0) {
      // No tool use - conversation complete
      return response
    }

    // Execute tools and collect results
    const toolResults = await Promise.all(
      toolUses.map(async tu => {
        const tool = tools.find(t => t.name === tu.name)
        const result = tool ? await tool.handler(tu.input) : `Unknown tool: ${tu.name}`
        return {
          type: 'tool_result',
          tool_use_id: tu.id,
          content: result,
        }
      })
    )

    // Add tool results to history
    messages.push({ role: 'user', content: toolResults })
  }

  throw new Error(`Agent loop exceeded maximum turns (${maxTurns})`)
}
