# Token Research

Tokens are lightweight metadata describing the alleged existence of a callable resource, used to authorize interactions with it. A token is fed to something that understands it (a platform, a transport) and resolved into a local callable — `msg => result`.

Tokens are not projections of mirrors. A mirror has access to a real resource and provides reflection over it. A token is dead metadata that lets you *build* a virtual resource locally.

## Key Patterns

### Swiss Numbers

The foundational primitive from the E programming language. A cryptographically random, unguessable value that simultaneously designates a resource and authorizes interaction with it. Knowledge of the number IS the permission.

The platform that created a resource holds a mapping from Swiss number to local callable. Present the number, get access. No ACLs, no identity checks.

Properties:
- Cannot be guessed (256 bits of entropy)
- Cannot be derived (no relationship between different Swiss numbers)
- Revocable (delete the mapping, the number becomes meaningless)

### Macaroon-Style Caveats

Caveats are transparent, readable constraints on what a token authorizes — e.g. `"op": "get-only"`, `"expires": "2026-03-01"`. Anyone holding a token can add caveats (attenuation) but nobody can remove them.

The mechanism is a chained HMAC:

```
sig_0 = HMAC(root_key, identifier)
sig_1 = HMAC(sig_0, caveat_1)
sig_2 = HMAC(sig_1, caveat_2)
```

The token carries: identifier, list of caveats, and only the final signature. Adding a caveat uses the current signature as the HMAC key. Removing a caveat would require the previous signature, which is unrecoverable (HMAC is one-way).

Only the issuing server (which holds the root key) can verify the chain by recomputing from scratch. Intermediaries can extend but cannot verify or shorten.

When the resolver produces a callable from a token, caveats tell it how to wrap that callable. A `get-only` caveat produces a function that rejects put messages. A rate caveat wraps with a limiter. The real resource is unconstrained — caveats constrain the view at resolution time.

### Sturdy Refs vs Live Refs

From E and adopted by Cap'n Proto and OCapN.

- **Sturdy ref**: Serializable, offline token. Can be stored, sent over a wire, embedded in messages. Dead metadata.
- **Live ref**: Active callable. Exists only while both ends are running and communicating.

You "enliven" a sturdy ref by feeding it to something that resolves it into a callable. This maps directly to our model: token in, callable out.

E's sturdy ref format: `location hint + cryptographic identity + Swiss number + optional expiry`

- Location hint: routing help, not authoritative
- Identity: verify you reached the right place (e.g. public key fingerprint)
- Swiss number: the actual capability
- Each field is optional depending on context — a local token might just be a Swiss number

### Connection-Scoped Table IDs

From Cap'n Proto. Once two platforms have an active connection, full tokens are unnecessary overhead. Each side maintains export/import tables — integer IDs scoped to that connection.

Four tables per connection:
- **Questions**: pending outbound calls (my call ID)
- **Answers**: pending inbound calls (their call ID)
- **Exports**: capabilities I've exposed (my export ID)
- **Imports**: capabilities they've exposed (their export ID)

Symmetric: my Exports mirror their Imports, my Questions mirror their Answers.

Capabilities on the wire are just table indices. Full tokens (sturdy refs) are only needed to establish the initial connection or survive restarts.

### Promise Pipelining

Call a method on a result that hasn't come back yet. If you request resource A and immediately want to send a message to whatever A returns, send both messages — the receiving end queues the second until the first resolves. Cuts round trips.

### Third-Party Handoff (OCapN)

When Alice wants to give Bob a capability to something on Carol's machine:

1. Alice deposits the reference with Carol
2. Alice sends Bob a signed certificate with Carol's identity and a gift ID
3. Bob presents the certificate to Carol
4. Carol validates, matches the deposit, returns the live reference to Bob

Bob now has a direct connection to Carol's object. No permanent relay through Alice.

## Token Structure

The minimal viable token drawn from these patterns:

```
{
  locator:     // routing hint — how to reach the target (transport, address)
  swiss:       // unguessable designator — IS the permission
  caveats:     // transparent restrictions — only gets narrower
  expiry:      // temporal validity
  signature:   // HMAC chain proving caveat integrity
}
```

Each field is optional depending on context. A local token may just be a Swiss number. A remote token needs a locator. An attenuated token has caveats and a signature.

## Relevance to Bassline

- Tokens are not identity (bassline rejects absolute identity). They are locally-interpreted metadata.
- Two tokens backed by the same resource module are different capabilities with different constraints.
- The resolver (platform or transport) interprets the token and produces a callable. The callable is `msg => result`, indistinguishable from any local resource.
- Caveats travel with the token, not on the resource. Different holders of tokens to the same resource can have different permissions.
- Swiss numbers map naturally to the platform's resource factory — the platform creates the resource, generates the Swiss number, holds the mapping.

## References

- E programming language: EARLs, Swiss tables, CapTP, sturdy/live refs
- Cap'n Proto: RPC protocol, four tables, promise pipelining, persistent capabilities
- Google Macaroons: HMAC-chained caveats, first/third-party caveats
- Spritely OCapN: modern CapTP standardization, third-party handoff, distributed GC
- UCAN: offline-verifiable delegation chains, subject/command/policy triple
