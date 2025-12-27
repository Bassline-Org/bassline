import { resource, bind } from './resource.js'
import { circuit } from './circuit.js'

/**
 * Create a minimal orchestrator that manages deployments across multiple nodes.
 *
 * Each node is a kit-like object with get/put methods (typically a remote proxy).
 *
 * Ports:
 * PUT  /deploy         → deploy to a node { name, node, app }
 * GET  /nodes          → list all nodes
 * GET  /n/:name/*      → forward to specific node
 * PUT  /n/:name/*      → forward to specific node
 * @param {object} nodes - Map of node name → kit { get, put }
 * @returns {object} An orchestrator circuit
 */
export const createOrchestrator = (nodes = {}) => {
  // Convert nodes object to Map for easier handling
  const nodeMap = new Map(Object.entries(nodes))

  const deployResource = resource({
    put: async (h, spec) => {
      const { name, node: nodeName } = spec
      if (!name) {
        return { headers: { condition: 'invalid' }, body: { error: 'name required' } }
      }
      if (!nodeName) {
        return { headers: { condition: 'invalid' }, body: { error: 'node required' } }
      }

      const node = nodeMap.get(nodeName)
      if (!node) {
        return { headers: { condition: 'not-found' }, body: { error: `node ${nodeName} not found` } }
      }

      // Deploy to the node
      const result = await node.put({ path: '/deployments' }, spec)
      return result
    },
  })

  const nodesResource = resource({
    get: async () => ({
      headers: {},
      body: {
        nodes: [...nodeMap.keys()],
      },
    }),
    put: async (h, spec) => {
      // Add a new node dynamically
      const { name, kit } = spec
      if (!name || !kit) {
        return { headers: { condition: 'invalid' }, body: { error: 'name and kit required' } }
      }
      nodeMap.set(name, kit)
      return { headers: {}, body: { added: name } }
    },
  })

  // Router for /n/:name/* - forwards to node
  const nodeRouter = bind(
    'name',
    resource({
      get: async h => {
        const node = nodeMap.get(h.params.name)
        if (!node) {
          return { headers: { condition: 'not-found' }, body: null }
        }
        return node.get({ path: h.path })
      },
      put: async (h, b) => {
        const node = nodeMap.get(h.params.name)
        if (!node) {
          return { headers: { condition: 'not-found' }, body: null }
        }
        return node.put({ path: h.path }, b)
      },
    })
  )

  return circuit(
    {
      bindings: {},
      ports: {
        deploy: 'deployResource',
        nodes: 'nodesResource',
        n: 'nodeRouter',
      },
    },
    { deployResource, nodesResource, nodeRouter }
  )
}
