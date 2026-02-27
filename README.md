# Bassline

A programming environment where everything is a resource.

A resource is a small computational thing that communicates via messages. Messages are either gets (asking for information) or puts (giving information). That's the whole protocol.

## Resources

In JavaScript, resources are exposed as functions. A `put` key in the message distinguishes the two kinds:

```javascript
counter({ put: 5 }) // put — giving it a value
counter({}) // get — asking for the value → 5
```

We define resource types using classes, but that's an API choice. The resource is the thing that handles the message — the function is just the interface, the class is just the implementation.

## Platforms and modules

Loosely inspired by Newspeak's module system, nothing in Bassline imports from packages. Instead, everything is a function that receives the platform:

```javascript
// a module
export default function (platform) {
  class MyThing extends platform.classes.Resource {
    get() {
      return this.value
    }
    put(v) {
      this.value = v
    }
  }
  platform.define({ MyThing })
}

// a deploy script — same shape
function setup(platform) {
  platform.root({ put: platform.create.Slot({ value: 0 }), at: 'counter' })
}
```

The platform provides everything a function needs. Swap the platform and the code sees a different world without knowing. A gated platform with fewer classes or a narrower root is a capability boundary.

## Packages

```
packages/core/       Platform, resources, projections (HTTP, FUSE)
packages/eth/        Ethereum JSON-RPC as a resource tree
packages/fs/         Standalone Rust FUSE bridge

apps/visual/         Visual inspector UI
```

## Running

```bash
pnpm install
pnpm test
```

## License

AGPLv3
