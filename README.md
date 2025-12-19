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

That's the whole interface. Resources compose through routing, which takes about 35 lines total. See [packages/core/src/resource.js](./packages/core/src/resource.js).

## Basslines

A bassline is a resource that does two things: it describes what's available, and it routes to those things.

```javascript
const app = routes({
  '': resource({
    get: async () => ({
      headers: { type: '/types/bassline' },
      body: {
        name: 'my-app',
        resources: {
          '/cells': { description: 'State' },
          '/data': { description: 'Documents' },
        },
      },
    }),
  }),
  cells: cellsResource,
  data: dataResource,
})
```

When you GET a bassline, it tells you what exists. When you PUT or GET through it, it handles the actual routing. Description and behavior live together.

This makes resources act like packages. They declare their contents and manage access to them. A bassline can contain other basslines, giving you nested namespaces.

Paths are always relative. `/cells/counter` in one bassline is different from `/cells/counter` in another. Resources never need to know their absolute location. You get isolation and composability from this naturally.

Because the bassline handles routing, it controls what actually happens. It can filter requests, transform responses, delegate to other resources, or deny access entirely. The description is what's advertised. The routing is what's enforced.

See [packages/core/docs/Bassline-Schema.md](./packages/core/docs/Bassline-Schema.md) for the schema.

## The Kit Pattern

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

This works across network boundaries because transports are resources too. When crossing the wire, the transport passes a link that routes back through itself. Resources stay portable.

## Resource Kinds

Patterns for thinking about resources based on how they behave.

Cells accumulate partial information through merging. Writes don't replace, they merge. Good for distributed state where ordering can't be coordinated.

Propagators connect cells. When inputs change, they recompute and write outputs. Reactive dataflow.

Oracles answer questions. Read-only. Databases, function registries, evaluators.

Scouts discover things autonomously and report what they find. Monitors, crawlers, peer discovery.

See [packages/core/docs/Resource-Kinds.md](./packages/core/docs/Resource-Kinds.md) for details.

## Packages

```
packages/core/       Resource primitives, cells, propagators, plumber, functions, timers
packages/node/       Node.js: HTTP server, WebSocket server, file store
packages/remote/     WebSocket client for connecting to remote basslines
packages/database/   SQLite
packages/services/   AI integration (Claude)
packages/trust/      Capability-based trust
packages/tcl/        Tcl scripting

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
