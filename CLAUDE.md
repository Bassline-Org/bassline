# Bassline

A system for partial information programming.

Programs in Bassline work from incomplete messages. They build local understanding from what they have, act on new information, and continue.

Anything outside your local perspective is encountered through communication. When that communication yields information that matters, we observe it as a resource. We do not need a complete account of what it is, where it is, or how it produces what we receive.

## The Model

Bassline rests on two primitives:

1. **Messages** — a fragment of partial information. A plain object with string keys. Carries no privileged meaning beyond what participants give it. Messages can carry capabilities (closures alongside data) provided those capabilities are fully opaque — see [packages/core/book/v2.org](packages/core/book/v2.org) for the contract.

2. **Communication** — the local capability to receive and contribute information. In this codebase exposed as `port` (`send`/`recv`/`close`), but the _capability_ matters, not the interface shape.

Identity, location, provenance, timing, order, and sameness are not privileged by the kernel. They are local judgments made from partial information.

**The kernel rejects privilege, not existence.** Identity, schemas, consensus, lifecycle, etc. can exist as opt-in constructs (built in std or by users) — they just aren't built into the model in a way that forces every program to participate.

## Read this first

**Before touching code, read [packages/core/book/v2.org](packages/core/book/v2.org).** It is the authored source for the kernel and the model — including the constraints capabilities must satisfy. Most std choices look unmotivated without v2.org and obvious with it.

For broader philosophy, drafts live in `~/org/bassline/`, especially `origin.org` ("Non-local ontology considered harmful").

## Structure

**Active, on-philosophy:**

- [packages/core](packages/core) — the kernel. The literate document [book/v2.org](packages/core/book/v2.org) tangles to a single file: [src/bassline.js](packages/core/src/bassline.js) (`port`, `propagator`, `cell`, `consume`, `net`, `message`, `offer`/`accept`/`hasCap`). Plus transports ([src/transports/](packages/core/src/transports/)), framing ([src/frame/jsonl.js](packages/core/src/frame/jsonl.js)), and servers ([src/serve/](packages/core/src/serve/)).

- [packages/std](packages/std) — standard library on top of the kernel. Not part of the kernel's claim, but actively developed:
  - [src/caps.js](packages/std/src/caps.js) — `createCap` + standard caps (reply/reject/cancel/close/send/ping)
  - [src/cache.js](packages/std/src/cache.js) — `capCache` and `session` (closure↔data converter; _not_ a peer protocol)
  - [src/ns.js](packages/std/src/ns.js) — local namespace + router
  - [src/shape.js](packages/std/src/shape.js) — `conforms`, `invariants`, predicate combinators
  - [src/data/](packages/std/src/data/) — recognition predicates (scalar, collection, interval, semver, uri, …); versioned cells live in [data/semver.js](packages/std/src/data/semver.js)
  - [src/roles/](packages/std/src/roles/) — consumer-held interpretations (Request, PortLike, Ping); aggregate export via [roles/index.js](packages/std/src/roles/index.js)

**Experimental / WIP — do not use as canonical:**

- All of [apps/](apps/) (`brain`, `daemon`, `diagram`, `visual`)
- [packages/brain](packages/brain), [packages/crypto](packages/crypto), [packages/fs](packages/fs), [packages/ontology](packages/ontology), [packages/react](packages/react)

Treat these as scratch unless explicitly asked to work in one.

## Working in this codebase

- **The kernel source of truth is [v2.org](packages/core/book/v2.org), not [bassline.js](packages/core/src/bassline.js).** The `.js` is tangled from the `.org`. To change kernel code, edit the org file and re-tangle (`org-babel-tangle` in emacs). Do not edit the tangled `.js` directly.
- The kernel is small and load-bearing. Don't add to it without strong reason.
- Std modules are downstream of v2.org's definitions; critique a std choice only after checking whether you're critiquing the choice or the axioms.
- Don't import mental models from other systems. `session` is not a wire protocol; ports are not actors; caps are not RPC. The kernel's vocabulary is the vocabulary.
- Caps reified to travel use `via` and `capabilities` as reserved spellings _within session's dialect only_. The kernel reserves no wire keys.
- Lifecycle does not propagate. `close` is always a local decision; senders are not notified.
- `EOF` is a local convenience symbol, never wire data.

## Running

```bash
pnpm install

# example: scratch session round-trip
node packages/std/scratch/server.js &
node packages/std/scratch/client.js
```

## License

AGPLv3
