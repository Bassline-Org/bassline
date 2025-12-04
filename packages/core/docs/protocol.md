# BL/T Protocol Specification v1.0

**BL/T** (Bassline Text) is a line-based text protocol for Bassline interactions.

## Design Goals

- **Shell-friendly** - Works with grep, awk, sed, pipes
- **Human-readable** - Debug with netcat or telnet
- **Minimal parsing** - One message per line, space-delimited
- **Transport-agnostic** - Works over TCP, stdio, WebSocket, etc.

## Message Format

```
OPERATION [arguments...] [@tag]
```

- One message per line (LF or CRLF terminated)
- Space-delimited tokens
- Optional `@tag` suffix for request/response correlation
- Lines starting with `#` are comments (ignored)
- Empty lines are ignored

## Request Operations

### VERSION

Negotiate protocol version and format.

```
VERSION <version> [formats]
```

**Examples:**
```
VERSION BL/1.0
VERSION BL/1.0 T,B
```

**Response:** `VERSION <version>`

### READ

Read the current value of a ref.

```
READ <ref> [@tag]
```

**Examples:**
```
READ <bl:///cell/counter>
READ <bl:///cell/counter> @req1
READ <bl:///fold/sum?sources=bl:///cell/a,bl:///cell/b>
```

**Response:** `OK <value> [@tag]` or `ERROR <code> <message>`

### WRITE

Write a value to a ref.

```
WRITE <ref> <value> [@tag]
```

**Examples:**
```
WRITE <bl:///cell/counter> 42
WRITE <bl:///cell/user> {"name":"alice","age":30}
WRITE <bl:///cell/flag> true @req1
WRITE <bl:///cell/status> active
WRITE <bl:///cell/name> "Alice Smith"
WRITE <bl:///cell/target> <bl:///cell/counter>
```

**Response:** `OK [@tag]` or `ERROR <code> <message>`

### SUBSCRIBE

Subscribe to value changes on a ref.

```
SUBSCRIBE <ref> [@tag]
```

**Examples:**
```
SUBSCRIBE <bl:///cell/counter>
SUBSCRIBE <bl:///cell/counter> @sub1
```

**Response:**
1. `EVENT <stream> <current-value>` (immediate)
2. `STREAM <stream-id> [@tag]`
3. `EVENT <stream> <new-value>` (on each change)

### UNSUBSCRIBE

Unsubscribe from a stream.

```
UNSUBSCRIBE <stream-id> [@tag]
```

**Examples:**
```
UNSUBSCRIBE s1
UNSUBSCRIBE s1 @req1
```

**Response:** `OK [@tag]` or `ERROR <code> <message>`

### INFO

Query capabilities of a ref (mirror introspection).

```
INFO <ref> [@tag]
```

**Examples:**
```
INFO <bl:///cell/counter>
INFO <bl:///fold/sum>
```

**Response:** `OK <capabilities-json> [@tag]`

```
OK {"readable":true,"writable":true,"ordering":"causal"}
OK {"readable":true,"writable":false,"ordering":"none"}
```

## Response Operations

### OK

Success response, optionally with a value.

```
OK [value] [@tag]
```

**Examples:**
```
OK
OK 42
OK {"name":"alice"}
OK 42 @req1
```

### ERROR

Error response with code and message.

```
ERROR <code> <message>
```

**Error Codes:**
| Code | Meaning |
|------|---------|
| 400 | Bad request / malformed |
| 404 | Not found |
| 500 | Internal error |

**Examples:**
```
ERROR 404 not found
ERROR 400 unknown operation
ERROR 500 connection failed
```

### STREAM

Subscription created, returns stream ID.

```
STREAM <stream-id> [@tag]
```

**Examples:**
```
STREAM s1
STREAM s1 @sub1
```

### EVENT

Value update on a subscribed stream.

```
EVENT <stream-id> <value>
```

**Examples:**
```
EVENT s1 42
EVENT s1 {"name":"alice"}
```

## Value Encoding

Values have distinct syntax for each type:

| Type | Encoding | Examples |
|------|----------|----------|
| Ref | Angle brackets | `<bl:///cell/counter>`, `<https://example.com>` |
| Word | Unquoted | `active`, `PENDING`, `my-status` |
| String | Quoted | `"hello"`, `"Alice Smith"` |
| Number | Literal | `42`, `-3.14`, `0` |
| Boolean | Literal | `true`, `false` |
| Null | Literal | `null` |
| Object | JSON | `{"name":"alice"}` |
| Array | JSON | `[1,2,3]` |

**Type Rules:**
- **Refs** are always wrapped in angle brackets `<uri>`
- **Words** are unquoted identifiers (case-insensitive, interned symbols)
- **Strings** are always quoted with double quotes
- **Numbers** match `-?\d+(\.\d+)?`
- **Objects/arrays** use JSON encoding

**Words vs Strings:**
```
active          → Word (interned, case-insensitive)
"active"        → String (literal text)
ACTIVE          → Word (same as 'active')
```

**Refs in JSON:**

When refs appear inside JSON objects or arrays, use the `$ref` marker:
```json
{"target": {"$ref": "bl:///cell/counter"}}
```

When words appear inside JSON, use the `$word` marker:
```json
{"status": {"$word": "ACTIVE"}}
```

## Tags

Tags enable request/response correlation for pipelining.

```
READ <bl:///cell/a> @req1
READ <bl:///cell/b> @req2
WRITE <bl:///cell/c> 100 @req3
```

Responses echo the tag:

```
OK 10 @req1
OK 20 @req2
OK @req3
```

Tags must:
- Start with `@`
- Contain no spaces
- Be unique per session (client responsibility)

## Ordering Modes

Mirrors declare their ordering requirements via INFO:

| Mode | Meaning | Examples |
|------|---------|----------|
| `none` | Order-independent (semi-lattice) | Folds, CRDTs |
| `causal` | Cause before effect | Cells |
| `total` | Strict sequential | Transactions |

**Implications:**
- `ordering: none` - Requests can be processed in any order
- `ordering: causal` - Writes must be seen before subsequent reads
- `ordering: total` - Strict request ordering required

This enables clients to parallelize requests to `ordering: none` mirrors.

## Session Example

```
> VERSION BL/1.0
< VERSION BL/1.0

> WRITE <bl:///cell/counter> 0
< OK

> READ <bl:///cell/counter>
< OK 0

> WRITE <bl:///cell/counter> 42
< OK

> READ <bl:///cell/counter>
< OK 42

> WRITE <bl:///cell/status> active
< OK

> READ <bl:///cell/status>
< OK ACTIVE

> WRITE <bl:///cell/name> "Alice"
< OK

> READ <bl:///cell/name>
< OK "Alice"

> WRITE <bl:///cell/target> <bl:///cell/counter>
< OK

> READ <bl:///cell/target>
< OK <bl:///cell/counter>

> INFO <bl:///cell/counter>
< OK {"readable":true,"writable":true,"ordering":"causal"}

> SUBSCRIBE <bl:///cell/counter> @sub1
< EVENT s1 42
< STREAM s1 @sub1

# (another client writes)
< EVENT s1 100

> UNSUBSCRIBE s1
< OK
```

## ABNF Grammar

```abnf
message     = request / response

request     = version-req / read-req / write-req /
              subscribe-req / unsubscribe-req / info-req

response    = version-resp / ok-resp / error-resp /
              stream-resp / event-resp

version-req = "VERSION" SP version [SP formats] [tag]
version-resp = "VERSION" SP version

read-req    = "READ" SP bracketed-ref [tag]
write-req   = "WRITE" SP bracketed-ref SP value [tag]
subscribe-req = "SUBSCRIBE" SP bracketed-ref [tag]
unsubscribe-req = "UNSUBSCRIBE" SP stream-id [tag]
info-req    = "INFO" SP bracketed-ref [tag]

ok-resp     = "OK" [SP value] [tag]
error-resp  = "ERROR" SP code SP message
stream-resp = "STREAM" SP stream-id [tag]
event-resp  = "EVENT" SP stream-id SP value

; Refs are wrapped in angle brackets
bracketed-ref = "<" uri ">"
uri         = 1*VCHAR

; Values: ref, word, string, number, boolean, null, object, array
value       = ref-value / word / quoted-string / number / boolean / null / json-object / json-array
ref-value   = "<" uri ">"
word        = 1*(ALPHA / DIGIT / "-" / "_")
quoted-string = DQUOTE *char DQUOTE
number      = ["-"] 1*DIGIT ["." 1*DIGIT]
boolean     = "true" / "false"
null        = "null"
json-object = "{" *VCHAR "}"
json-array  = "[" *VCHAR "]"

stream-id   = "s" 1*DIGIT
tag         = SP "@" 1*VCHAR
version     = "BL/" 1*DIGIT "." 1*DIGIT
formats     = format *("," format)
format      = "T" / "B" / "J"
code        = 3DIGIT
message     = *VCHAR

SP          = %x20
VCHAR       = %x21-7E
DIGIT       = %x30-39
ALPHA       = %x41-5A / %x61-7A
DQUOTE      = %x22
```

## Transport Binding: TCP

Default port: 9000

```bash
# Start server
node bin/blt-server.js -p 9000

# Connect
nc localhost 9000
```

## Future Extensions

Reserved for future versions:

- `BATCH` - Multiple operations in one message
- `AUTH` - Authentication
- `PING/PONG` - Keep-alive
- Format `B` - Binary encoding (BL/B)
- Format `J` - JSON Lines mode
