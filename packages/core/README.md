# @bassline/core

A system for partial information programming.

Programs in Bassline work from incomplete messages. They build local understanding from what they have, act on new information, and continue. Anything outside your local perspective is encountered through communication. When that communication yields information that matters, we observe it as a resource.

## Messages

A message is a fragment of partial information. A plain object with string keys. It can be empty, partially filled, or nested inside other messages. Messages carry no privileged meaning beyond what participants give them.

```javascript
import { message, update, isEmpty } from './src/messages.js'

message({ temperature: 72 })  // pass through
message(undefined)             // {}
message(42)                    // { body: 42 }

update(msg, m => ({ seen: true }))          // { temperature: 72, seen: true }
update(m => ({ seen: true }))(msg)          // same, curried for pipelines
```

## Communication

Communication is the local capability to receive and contribute information. In this implementation, it is exposed as `[reader, writer]` pairs backed by channels.

```javascript
import { channel, merge } from './src/channel.js'

const [reader, writer] = channel()

writer.send({ temperature: 72 })
writer.send({ temperature: 68 })
writer.close()

await reader
  .filter(msg => msg.temperature < 70)
  .sink(console.log)
// { temperature: 68 }
```

Combinators (map, filter, scan, tee, take, merge, tap, thru) transform readers into new readers. Pipelines compose naturally.

## Transports

A transport adapts an external medium into local communication. Anything that can produce or consume bytes can be wrapped as a `[reader, writer]` pair.

```javascript
import { connect } from './src/client.js'
import { serve } from './src/server.js'

// server: channel of connections
const [connections, server] = serve({ path: '/tmp/my.sock' })
await connections.sink(([read, write]) => {
  read.map(handle).sink(write.send)
})

// client: channel over the network
const [read, write] = connect({ path: '/tmp/my.sock' })
```

## Source

The source is a literate document: `book.org`. It tangles to `src/`.

## License

AGPL-3.0
