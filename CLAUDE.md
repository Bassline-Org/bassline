# Bassline

A system for partial information programming.

Programs in Bassline work from incomplete messages. They build local understanding from what they have, act on new information, and continue.

Anything outside your local perspective is encountered through communication. When that communication yields information that matters, we observe it as a resource. We do not need a complete account of what it is, where it is, or how it produces what we receive.

## The Model

Bassline is built on two concepts:

1. **Messages** -- a message is a fragment of partial information. A plain object with string keys. It can be empty, partially filled, or nested inside other messages. Messages carry no privileged meaning beyond what participants give them.

2. **Communication** -- the local capability to receive and contribute information. In the current implementation, this is exposed as `[reader, writer]` pairs backed by channels. The important thing is the ability to exchange and observe information, not the specific interface shape.

Identity, location, provenance, timing, order, and sameness are not taken as settled facts. They are judgments made from partial information.

## Structure

The source lives in `packages/core/book.org`, a literate document that tangles to:

```
packages/core/src/
  messages.js        -- message normalization, update, isEmpty
  channel.js         -- Channel classes, factories, combinators
  channel-example.js -- user-level combinators (debounce, dedup, max)
  client.js          -- readFrames, writeFrames, connect
  server.js          -- serve (channel of connections)
  utils.js           -- type predicates, misc
```

Supporting scripts (not tangled from org):
```
  run-server.js      -- test server
  run-client.js      -- test client
```

## Running

```bash
pnpm install

# run the channel example
node packages/core/book/channel-example.js

# run the server/client test
node packages/core/book/run-server.js &
node packages/core/book/run-client.js
```

## License

AGPLv3
