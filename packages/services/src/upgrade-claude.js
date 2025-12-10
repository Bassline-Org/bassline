import { createClaudeService } from './claude.js'
import { createServiceRoutes } from './service.js'
import { runAgentLoop } from './mcp-server.js'

/**
 * Install Claude service into a Bassline instance.
 *
 * Registers routes at bl:///services/claude with:
 * - GET /services/claude - Service info
 * - PUT /services/claude/messages - Full messages API
 * - PUT /services/claude/complete - Simple text completion
 *
 * Also attaches bl.agent() helper for agentic loops.
 *
 * @param {import('@bassline/core').Bassline} bl - Bassline instance
 * @param {object} [config] - Configuration options
 * @param {string} [config.apiKey] - Anthropic API key (defaults to env var)
 * @param {string} [config.model] - Default model to use
 */
export default function installClaude(bl, config = {}) {
  const {
    apiKey = process.env.ANTHROPIC_API_KEY,
    model
  } = config

  if (!apiKey) {
    console.warn('No ANTHROPIC_API_KEY - Claude service disabled')
    return
  }

  // Install service registry if not present
  if (!bl._services) {
    const services = createServiceRoutes()
    services.install(bl)
    bl._services = services
  }

  // Create and install Claude service
  const claudeOptions = { apiKey }
  if (model) claudeOptions.model = model

  const claude = createClaudeService(claudeOptions)
  claude.install(bl)

  // Register in service registry
  bl._services.register('claude', claude)

  // Store reference for other modules
  bl._claude = claude

  // Attach agent loop helper to bl instance
  bl.agent = (prompt, options = {}) => runAgentLoop(bl, claude, { prompt, ...options })

  console.log('  Claude service installed at bl:///services/claude')
}
