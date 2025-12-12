/**
 * Widget Routes
 *
 * REST-like routes for managing widgets as resources.
 *
 * - GET  /widgets           → list all widgets
 * - GET  /widgets/:name     → get widget info
 * - GET  /widgets/:name/definition → get widget definition
 * - GET  /widgets/:name/props → get widget props schema
 * - PUT  /widgets/:name     → create/update custom widget
 * - PUT  /widgets/:name/delete → delete custom widget
 */

import { resource } from '@bassline/core'

/**
 * Create widget routes.
 * @param {object} options - Configuration
 * @param {object} options.registry - Widget registry
 * @returns {object} Routes object with install method
 */
export function createWidgetRoutes(options) {
  const { registry } = options

  const widgetResource = resource((r) => {
    // List all widgets (primitives + custom)
    r.get('/', () => {
      const allUris = registry.listAll()

      return {
        headers: { type: 'bl:///types/directory' },
        body: {
          entries: allUris.map((uri) => {
            const widget = registry.getSync(uri)
            // Extract name from URI (e.g., 'bl:///widgets/button' → 'button')
            const name = uri.replace(/^bl:\/\/\/widgets\//, '')
            return {
              name,
              type: widget?.type || 'bl:///types/widgets/custom',
              uri,
              primitive: registry.isPrimitive(uri),
            }
          }),
        },
      }
    })

    // Get widget info
    r.get('/:name', ({ params }) => {
      const { name } = params
      const uri = `bl:///widgets/${name}`

      const widget = registry.getSync(uri)
      if (!widget) return null

      return {
        headers: { type: widget.type },
        body: {
          name: widget.name,
          uri,
          primitive: widget.primitive,
          description: widget.description || '',
          props: widget.props || {},
          createdAt: widget.createdAt || null,
          entries: [
            { name: 'definition', uri: `${uri}/definition` },
            { name: 'props', uri: `${uri}/props` },
          ],
        },
      }
    })

    // Get widget definition
    r.get('/:name/definition', ({ params }) => {
      const { name } = params
      const uri = `bl:///widgets/${name}`

      const widget = registry.getSync(uri)
      if (!widget) return null

      if (widget.primitive) {
        return {
          headers: { type: 'bl:///types/widget-definition' },
          body: {
            type: 'primitive',
            name: widget.name,
          },
        }
      }

      return {
        headers: { type: 'bl:///types/widget-definition' },
        body: {
          type: 'composed',
          definition: widget.definition,
        },
      }
    })

    // Get widget props schema
    r.get('/:name/props', ({ params }) => {
      const { name } = params
      const uri = `bl:///widgets/${name}`

      const widget = registry.getSync(uri)
      if (!widget) return null

      return {
        headers: { type: 'bl:///types/props-schema' },
        body: widget.props || {},
      }
    })

    // Create/update custom widget
    r.put('/:name', ({ params, body }) => {
      const { name } = params
      const uri = `bl:///widgets/${name}`

      if (!body?.definition) {
        return {
          headers: { type: 'bl:///types/error' },
          body: { error: 'Missing required field: definition' },
        }
      }

      try {
        const widget = registry.registerCustom(uri, {
          name: body.name || name,
          type: body.type,
          props: body.props,
          definition: body.definition,
          description: body.description,
        })

        return {
          headers: { type: widget.type },
          body: {
            name: widget.name,
            uri,
            primitive: false,
            description: widget.description,
            props: widget.props,
            createdAt: widget.createdAt,
          },
        }
      } catch (err) {
        return {
          headers: { type: 'bl:///types/error' },
          body: { error: err.message },
        }
      }
    })

    // Delete custom widget
    r.put('/:name/delete', ({ params }) => {
      const { name } = params
      const uri = `bl:///widgets/${name}`
      const existed = registry.deleteCustom(uri)

      if (!existed) return null

      return {
        headers: { type: 'bl:///types/resource-removed' },
        body: { uri },
      }
    })
  })

  /**
   * Install widget routes into a Bassline instance
   * @param {import('@bassline/core').Bassline} bl
   * @param {object} [options] - Options
   * @param {string} [options.prefix] - Mount prefix
   */
  function install(bl, { prefix = '/widgets' } = {}) {
    bl.mount(prefix, widgetResource)
  }

  return {
    routes: widgetResource,
    install,
  }
}
