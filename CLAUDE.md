# Bassline

A system for partial information programming.

Bassline programs work from incomplete messages. They build local understanding from what they have, act on new information, and continue.

Anything outside a local perspective is encountered through communication. When that communication yields information that matters, we observe it as a resource. We do not need a complete account of what it is, where it is, or how it produces what we receive.

## Core Idea

Bassline is message-first.

A message is a fragment of partial information. It is anonymous, sovereign data with string keys and no privileged interpretation. A message may also carry capabilities, but those capabilities are not references to objects. They are opaque, message-relative ways to speak.

Think of caps as captured communication context. Like a closure hides its captured lexical environment, a message hides the local machinery its caps close over. From the outside, you only see the message and the affordances it exposes.

Communication constructs such as ports, propagators, cells, nets, transports, caches, and lambdas are not kernel entities with global identity. They construct messages whose caps close over local machinery. Stable message-handling behavior can be interpreted as entity-like, but entity-ness is not built into the model.

**The kernel rejects privilege, not existence.** Identity, schemas, consensus, lifecycle, peers, sessions, objects, and protocols can exist as opt-in constructs in std or user code. They are not forced into the foundation.

## Read This First

**Before touching kernel or std code, read [packages/core/book/v2.org](packages/core/book/v2.org).** It is the authored source for the kernel and the model, including the constraints capabilities must satisfy. Most std choices look unmotivated without `v2.org` and obvious with it.

## Active Structure

**Active, on-philosophy:**

- [packages/core](packages/core) - the kernel. The literate document [book/v2.org](packages/core/book/v2.org) tangles to [src/bassline.js](packages/core/src/bassline.js). It defines `Msg`/`msg`, `port`, `propagator`, `cell`, `consume`, `net`, `EOF`, predicates, invariants, and the minimal utilities around them. It also contains transports, framing, and servers.

- [packages/std](packages/std) - standard library on top of the kernel. It is downstream of the model, not part of the kernel's claim.
  - [src/cache.js](packages/std/src/cache.js) - `createCache`, `bindRawCaps`, `conversation`, and `dialogue`. This is a closure-to-data bridge for caps crossing a process boundary. It is not a peer protocol.
  - [src/lambda.js](packages/std/src/lambda.js) - message-relative `call`/`resolve`/`reject` protocol. Important showcase for multi-step protocols, progressive binding, and higher-order distributed interaction.
  - [src/shape.js](packages/std/src/shape.js) - small predicate and cap-invocation helpers.
  - [src/data/](packages/std/src/data/) - recognition predicates and data helpers. These are mainly stale, but the general concept will be useful it's just not implemented yet. It's just about the fact that messages can describe many possible interpretations of something, and these can be layered.
  - [scratch/](packages/std/scratch/) - examples and probes (`lambda.js`, `list.js`, `ski.js`, `quorum.js`). Useful for understanding affordances; not canonical API design.

**Experimental / WIP - do not use as canonical:**

- [packages/crypto](packages/crypto)

Treat these as scratch unless explicitly asked to work in one.

## Working In This Codebase

- **The kernel source of truth is [v2.org](packages/core/book/v2.org), not [bassline.js](packages/core/src/bassline.js).** The `.js` file is tangled from the `.org`. To change kernel code, edit the org file and re-tangle with `org-babel-tangle` in Emacs. Do not edit the tangled `.js` directly.
- The kernel is small and load-bearing. You should not add to it without an extremely strong reason.
- Std modules are downstream of `v2.org`'s definitions. When critiquing std, first decide whether the issue is the std choice or the kernel axiom it rests on.
- Do not import mental models from other systems. Ports are not actors. Caps are not RPC. Lambdas are not serialized functions. `dialogue` is not a peer protocol. Bassline vocabulary is the vocabulary.
- Caps are message-relative ways to speak, not references to things. A cap does not assert the existence, identity, or location of a referent.
- Caps reified to travel use `via` and `capabilities` as reserved spellings only within the cache/dialogue dialect. The kernel reserves no wire keys.
- Lifecycle does not propagate. `close` is always a local decision; senders are not notified.
- `EOF` is a local convenience symbol, never wire data.
- Messages may be implemented as JavaScript objects, but they are not objects in the model. Entity-like behavior emerges from stable message handling and closed-over context.

## Running

```bash
pnpm install
pnpm test

# scratch examples
node packages/std/scratch/lambda.js
node packages/std/scratch/list.js
node packages/std/scratch/ski.js
node packages/std/scratch/quorum.js
```

## License

AGPLv3
