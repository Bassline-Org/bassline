# Bassline

A minimal protocol for reflexive distributed systems.

## Resources

A resource is something you can `get` from or `put` to.

```javascript
{
  get: async (headers) => ({ headers, body }),
  put: async (headers, body) => ({ headers, body })
}
```

Resources compose through routing, and we only interact with resources through local addressing. See [packages/core/src/resource.js](./packages/core/src/resource.js).

Routing can do more than just find things! For example the `/unknown` route is our fallback route, which let's us have load binding of modules & other resources in the system.

## Kits

When a resource needs to reach outside itself, it uses `h.kit`:

```javascript
const worker = resource({
  put: async (h, task) => {
    const config = await h.kit.get({ path: '/config' })
    await h.kit.put({ path: '/results' }, processTask(task, config.body))
    return { headers: {}, body: { done: true } }
  },
})
```

Kit is just a resource passed in through headers. The caller decides what it routes to. Could be local, remote, sandboxed, logged. The resource using it doesn't know or care.

Because of local addressing, kit interactions represent semantic actions, not concrete locations of things, so we can have quite flexible resource interactions.

This can work across network boundaries because our transports are resources too. So when crossing the wire, the transport passes a link that routes back through itself. Local addressing keeps this sane.

## Resource Kinds

Patterns for thinking about resources based on how they behave.

Cells accumulate partial information through merging. Writes don't replace, they merge. Good for distributed state where ordering can't be coordinated.

Propagators connect cells. When inputs change, they recompute and write outputs. Reactive dataflow, and while pure they maintain lattice properties.

Oracles answer questions. Databases, function registries, evaluators are all cases of these.

Scouts discover things autonomously and report what they find. Monitors, crawlers, peer discovery.

See [packages/core/docs/Resource-Kinds.md](./packages/core/docs/Resource-Kinds.md) for more details.

## Packages

```
packages/core/       Resource primitives, cells, propagators, circuit, deployment, timers, and more
packages/blit/       Portable SQLite-backed bassline applications
packages/node/       Node.js: HTTP server, WebSocket server, file store
packages/remote/     WebSocket client for connecting to remote basslines
packages/database/   SQLite
packages/services/   AI integration
packages/trust/      Capability-based trust experiments
packages/tcl/        Our TCL interpreter
apps/cli/            Daemon and MCP server
apps/tui/            Terminal UI
```

## Running

```bash
pnpm install
pnpm test
```

## License

AGPLv3
