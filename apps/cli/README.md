# bl

Project tools for bassline. Manages protocols, resources, and distribution.

## Quick start

```bash
bl new my-project
cd my-project
pnpm install
```

This creates a project with a `bassline.config.json`, a `resources/` directory, and a `package.json` that depends on `@bassline/core`.

## Concepts

### Protocols

A protocol is a named set of selectors that a resource can implement. Selectors describe the shape of messages a resource understands.

```
Slot
  GET: ""           (bare — no parameters)
  PUT: ""

Slots
  GET: "at:", "at:ifAbsentPut:"
  PUT: "at:"

Watchable extends Slot
  GET: "watch:", "unwatch:"
  (inherits GET "" and PUT "" from Slot)
```

Selectors are keyword-based. `"at:ifAbsentPut:"` means the message must contain both an `at` and an `ifAbsentPut` field. The bare selector `""` means a message with no recognized fields. Selectors are normalized — keywords sorted alphabetically with trailing colons.

Core protocols (`Slot`, `Slots`, `Watchable`) ship with `@bassline/core`. Projects can define their own:

```bash
bl protocol new     # interactive — name, extends, selectors
bl protocol edit    # modify an existing protocol
bl protocol delete  # remove (warns about dependents)
bl protocol ls      # show all with resolved inheritance
```

Protocols support single inheritance chains. When protocol B extends A, B's resolved selectors include everything from A plus its own.

### Resources

A resource is a JS module that implements one or more protocols. Each resource has a config entry and a file (or directory) on disk.

```bash
bl resource new     # interactive — name, type, path, implements, distributes
bl resource ls      # list defined resources
```

Resources can be single files or directories:

```
resources/cache.js           # single file, path: "resources/cache.js"
resources/auth/index.js      # directory,   path: "resources/auth/"
```

When a resource implements protocols, the scaffold generator produces handler stubs with the correct parameter destructuring and dispatch guards:

```js
export const cache = resource({
  get(msg) {
    const { at, ifAbsentPut } = msg

    // at:ifAbsentPut:  (Slots)
    if (at !== undefined && ifAbsentPut !== undefined) {
      throw new Error('not yet implemented')
    }

    // at:  (Slots)
    if (at !== undefined) {
      throw new Error('not yet implemented')
    }

    return this.dnu(msg)
  },
  // ...
})
```

Guards are ordered by specificity (more parameters first). If the protocol includes a bare selector `""`, it becomes the final fallback. Otherwise the fallback is `this.dnu(msg)` (does not understand).

### Building

`bl build` packages resources into JSON items that can be distributed.

```bash
bl build            # interactive select if multiple resources exist
bl build cache      # build a specific resource
bl build -o dist/   # custom output directory (default: public/r/)
```

A built item is a self-contained JSON file:

```json
{
  "name": "cache",
  "version": "1.0.0",
  "description": "A cache resource",
  "implements": ["Slots"],
  "protocols": {
    "Cacheable": { "get": ["at:"], "put": ["at:"] }
  },
  "files": [
    { "path": "resources/cache.js", "content": "..." }
  ]
}
```

The `implements` field records which protocols the resource conforms to. The `protocols` field carries protocol _definitions_ that should be installed alongside the resource — this is how new protocols are distributed.

For directory resources, all `.js` files are collected recursively. The `index.js` is tagged as the entry point.

### Distribution

Items are distributed through registries — HTTP servers that host built JSON files.

```bash
# Serve your built items locally
bl serve                    # default port 2017
bl serve --port 3000

# Register a remote namespace
bl registry add @acme https://registry.acme.com
bl registry ls
bl registry remove @acme
```

The serve command hosts everything in `public/r/` as a static registry. `GET /` returns an item listing. `GET /{name}` returns the item JSON.

### Installing items

```bash
bl add @acme/cache          # from a registry
bl add ./path/to/item.json  # from a local file
```

Installation does several things:

1. Writes the item's files to disk
2. Merges any distributed protocols into `bassline.config.json`
3. Adds npm dependencies to `package.json` (if declared)
4. Records the installation for tracking

Conflict detection prevents shadowing core protocols or colliding with protocols from other installed items.

```bash
bl ls                       # list installed items
bl remove @acme/cache       # uninstall (deletes files, cleans up protocols)
```

Removal only deletes protocols that aren't provided by another installed item.

## Config file

Everything lives in `bassline.config.json`:

```json
{
  "name": "my-project",
  "spec": {
    "extends": ["@bassline/core"],
    "protocols": {
      "Cacheable": {
        "description": "A caching protocol",
        "extends": ["Slots"],
        "get": ["ttl:"],
        "put": ["ttl:"]
      }
    }
  },
  "resources": {
    "cache": {
      "path": "resources/cache.js",
      "description": "LRU cache",
      "implements": ["Cacheable", "Slots"],
      "protocols": ["Cacheable"]
    }
  },
  "registries": {
    "@acme": "https://registry.acme.com"
  },
  "installed": {
    "@acme/auth": {
      "version": "1.0.0",
      "files": ["resources/auth/index.js"],
      "protocols": ["Authenticatable"],
      "implements": ["Authenticatable"]
    }
  }
}
```

- **spec.protocols** — protocol definitions owned by this project (both hand-written and installed)
- **resources** — resource templates that can be built and distributed
- **resources.\*.implements** — protocols the resource conforms to (informational + used for scaffold generation)
- **resources.\*.protocols** — protocol definitions to _include_ when building (this is how protocols travel with their implementation)
- **registries** — namespace-to-URL mappings for remote registries
- **installed** — tracks what was installed, for clean removal

## Commands

```
bl new [name]              Create a new project
bl protocol new            Define a new protocol
bl protocol edit           Edit a protocol
bl protocol delete         Delete a protocol
bl protocol ls             List protocols
bl resource new            Define a new resource
bl resource ls             List resources
bl build [name]            Build resources into registry items
bl serve                   Serve built items over HTTP
bl registry add <ns> <url> Add a registry namespace
bl registry ls             List registries
bl registry remove <ns>    Remove a registry
bl add <ref>               Install an item (@ns/name or ./path)
bl remove <ref>            Uninstall an item
bl ls                      List installed items
```
