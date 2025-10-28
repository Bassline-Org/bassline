# Bassline Connection Protocol v0.1.0

A simple connection protocol inspired by the 9P protocol.

Aims to:

- Be transport agnostic
- Be language agnostic
- Allow other programs and environments to interact with bassline systems,
  without implementing bassline themselves.

## Step 1. Establishing the connection `CONNECT`

### Client

The client initiates the connection and sends a message of the form:

```bassline
CONNECT: <aBlock>
```

The block contains the initial data the server will use to initialize the
connection. IE sharing version information, max message sizes, or whatever
contextual information is required.

For example:

    CONNECT [ user: "goose" context: "foo" ]

### Server

Upon receiving this information, the server will parse the block and respond
with one of the following responses:

- `CONNECTION_OK`

  Indicates a successful connection, and the server has a context the client can
  evaluate code in.

- `CONNECTION_ERR <aBlock>`

  Indicates a failure to connect. `aBlock` contains information about why the
  connection failed.

## 2. Evaluating Code

### Client

Once the connection is established, a client may send blocks for evaluation.
Each message must contain a session local nonce, which is used by the server, to
provide results for the requests.

- `DOIT <nonce> <block>`

  `DOIT` implies the server should send the return value of the result of
  evaluating the block, `molded` over the wire.

```bassline
DOIT <nonce> <block>
DOIT 1 [words system] ;; Responds with all the words in the system
DOIT 2 [(allWords: words system) []] ;; Responds with an empty block
```

### Server

Upon receiving these eval requests, the server will evaluate the code in the
created context, and after evaluation, will send the appropriate response data,
or in the event of an error, it will send an error message

```
DIDIT_OK <nonce> <response>
DIDIT_ERR <nonce> <err>
```
