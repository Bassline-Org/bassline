# Bassline

A system for partial information programming.

Programs in Bassline work from incomplete messages. They build local understanding from what they have, act on new information, and continue.

Anything outside your local perspective is encountered through communication. When that communication yields information that matters, we observe it as a resource. We do not need a complete account of what it is, where it is, or how it produces what we receive.

## Source

The core is a literate document: [`packages/core/book/v2.org`](packages/core/book/v2.org)

```
packages/
  core/       messages, channels, transports, deployment
  eth/        Ethereum JSON-RPC as a resource tree
  fs/         FUSE bridge
```

## Running

```bash
pnpm install
node packages/core/book/channel-example.js
```

## License

AGPLv3
