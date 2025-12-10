/**
 * Create MCP-style tools that allow Claude to query Bassline.
 *
 * These tools can be passed to Claude's tool_use feature,
 * enabling bidirectional integration where Claude can
 * read and write Bassline resources.
 *
 * @param {import('@bassline/core').Bassline} bl - Bassline instance
 * @returns {Array<object>} Array of tool definitions with handlers
 */
export function createMCPTools(bl) {
  return [
    {
      name: 'bassline_get',
      description: 'Get a resource from Bassline by URI. Returns the resource headers and body.',
      input_schema: {
        type: 'object',
        properties: {
          uri: {
            type: 'string',
            description: 'Resource URI (e.g., bl:///cells/counter, bl:///data/users)'
          }
        },
        required: ['uri']
      },
      handler: async ({ uri }) => {
        try {
          const result = await bl.get(uri)
          return result ? JSON.stringify(result, null, 2) : 'Resource not found'
        } catch (err) {
          return `Error: ${err.message}`
        }
      }
    },
    {
      name: 'bassline_put',
      description: 'Put/update a resource in Bassline. Returns the result of the operation.',
      input_schema: {
        type: 'object',
        properties: {
          uri: {
            type: 'string',
            description: 'Resource URI'
          },
          body: {
            description: 'Resource body (can be any JSON value)'
          }
        },
        required: ['uri', 'body']
      },
      handler: async ({ uri, body }) => {
        try {
          const result = await bl.put(uri, {}, body)
          return result ? JSON.stringify(result, null, 2) : 'Failed to put resource'
        } catch (err) {
          return `Error: ${err.message}`
        }
      }
    },
    {
      name: 'bassline_list',
      description: 'List resources at a path. Returns directory entries.',
      input_schema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path to list (e.g., /cells, /data, /services)'
          }
        },
        required: ['path']
      },
      handler: async ({ path }) => {
        try {
          const uri = `bl:///${path.replace(/^\//, '')}`
          const result = await bl.get(uri)
          if (!result) return 'Not found'
          const entries = result.body?.entries || result.body
          return JSON.stringify(entries, null, 2)
        } catch (err) {
          return `Error: ${err.message}`
        }
      }
    },
    {
      name: 'bassline_links',
      description: 'Query links to or from a resource. Returns related resources.',
      input_schema: {
        type: 'object',
        properties: {
          direction: {
            type: 'string',
            enum: ['to', 'from'],
            description: 'Link direction: "to" for backlinks, "from" for forward refs'
          },
          uri: {
            type: 'string',
            description: 'Resource URI to query links for'
          }
        },
        required: ['direction', 'uri']
      },
      handler: async ({ direction, uri }) => {
        try {
          const path = uri.replace('bl:///', '')
          const linksUri = `bl:///links/${direction}/${path}`
          const result = await bl.get(linksUri)
          return result ? JSON.stringify(result.body, null, 2) : 'No links found'
        } catch (err) {
          return `Error: ${err.message}`
        }
      }
    }
  ]
}

/**
 * Run an agentic loop where Claude can use tools to interact with Bassline.
 *
 * @param {import('@bassline/core').Bassline} bl - Bassline instance
 * @param {object} claudeService - Claude service from createClaudeService
 * @param {object} options - Loop options
 * @param {string} options.prompt - Initial user prompt
 * @param {string} [options.system] - System prompt
 * @param {number} [options.maxTurns=10] - Maximum conversation turns
 * @param {string} [options.model] - Override model
 * @returns {Promise<object>} Final Claude response
 */
export async function runAgentLoop(bl, claudeService, options = {}) {
  const {
    prompt,
    system,
    maxTurns = 10,
    model = claudeService.model
  } = options

  const tools = createMCPTools(bl)
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
        input_schema: t.input_schema
      }))
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
    const toolResults = await Promise.all(toolUses.map(async tu => {
      const tool = tools.find(t => t.name === tu.name)
      const result = tool
        ? await tool.handler(tu.input)
        : `Unknown tool: ${tu.name}`
      return {
        type: 'tool_result',
        tool_use_id: tu.id,
        content: result
      }
    }))

    // Add tool results to history
    messages.push({ role: 'user', content: toolResults })
  }

  throw new Error(`Agent loop exceeded maximum turns (${maxTurns})`)
}
