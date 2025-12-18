# Bassline JSON Schema v1

A JSON Schema for Bassline descriptions.

Schema ID: `https://bassline.dev/schemas/bassline-v1.json`

## What is a Bassline?

A Bassline is an addressable resource that describes some addressable resources that give the system new capabilities.

All exposed resources are addressable relative to Bassline resource. Making the Bassline act as both a router & package.

The goal here is to describe a minimal shape for compound resources to describe themselves, such that we can establish a common base(line) to build and extend.

## The Schema

A Bassline description is a JSON document with two primary parts:

```json
{
  "resources": { /* required */ },
  "metadata": { /* optional */ }
}
```

### Resources

This section describes the resources exposed by the Bassline, and what operations they support.


**Note: You should always include human readable descriptions when exposing resources!**

```json
{
  "resources": {
    "/cells/:name": {
      "get": { /* get spec */ },
      "put": { /* put spec */ }
    }
  }
}
```

**Rules**

- Paths must start with `/`

- Each resource must have at least `get` or `put` (or both)

- Paths can include parameters by prefixing a path segment with a `:`, such as `:name`.

### GET Operation

For when a resource can answer questions others may find useful.

All fields are optional. 


**But please make sure you add descriptions! :)**

```json
"get": {
  "description": "What this returns",
  "returns": { /* return value shape */ },
  "parameters": { /* query params */ }
}
```

### PUT Operation

For when a resource can make use of information we provide it.

All fields are optional. 


**But seriously, DESCRIPTIONS!**

```json
"put": {
  "description": "What this does",
  "accepts": { /* request body shape */ },
  "parameters": { /* path/query params */ }
}
```

### Metadata

We designate this section for any domain-specific info you want to include in addition to the resources described by the bassline.

- Who wrote this? 
- What version is it? 
- Why should I use it?
- How are you feeling today? (If you feel like expressing yourself)

```json
"metadata": {
  "version": "1.0.0",
  "author": "goose",
  "description": "Bassline of Drum+Bass",
  "capabilities": ["cells", "events"],
  "im-feeling": "groovy"
}
```

## Addressing

Bassline descriptions don't include concrete addresses about where to find things. This is intentional!

A Bassline is about describing what we can do with something, not how we do it.

If you want to expose things like addressing information on how others can reach you or similar peers, you should expose it as a resource within the Bassline.

*Or maybe define Bassline of Addressing ;)*

## Examples

### Bassline of Ethereum

```json
{
  "resources": {
    "/block/:height": {
      "get": {
        "description": "Get data from a particular block",
        "returns": { /* The block spec*/ }
      },
    },
    "/block/:height/txns": {
      "get": {
        "description": "Get the transactions from a particular block",
        "returns": { /* Array of txns spec */ }
      },
    },
    "/balance/:address": {
      "get": {
        "description": "Returns the recent wei balance of an account"
      }
    },
    "/balance/:address/:height": {
      "get": {
        "description": "Returns the wei balance of an account at the block height"
      }
    },
    "/tx/send": {
      "put": {
        "description": "Submit a signed transaction to the network",
        "returns": "Txn hash / Error"
      }
    },
    "/call/:address": {
      "get": {
        "description": "Perform an eth_call to an address"
      }
    },
    "/peers": {
      "get": {
        "description": "Returns all known peers of this node"
      }
    },
    "/sig/:address/verify": {
      "get": {
        "description": "Verify a signature from the address provided"
      }
    }
  },
  "metadata": {
    "version": "1.0.0",
    "description": "Bassline of Ethereum, defines the minimal shape for ethereum rpc interactions through Bassline",
    "see-also": {
      "Bassline of Eth-Tokens": {
        "route": "/tokens",
        "description": "A bassline for ERC-20 specific resource interactions!"
      }
    },
    "how-i-feel": "bassed"
  }
}
```

### Bassline of Cells

```json
{
  "resources": {
    "/cells/:name": {
      "get": {
        "description": "Get cell information",
        "returns": {
          "name": "string",
          "lattice": "string",
          "value": "any"
        }
      },
      "put": {
        "description": "Create or configure cell",
        "accepts": {
          "lattice": "string"
        }
      }
    },
    "/cells/:name/value": {
      "get": {
        "description": "Get current cell value"
      },
      "put": {
        "description": "Merge information into cell",
        "accepts": "any"
      }
    },
    "/info/cells": {
      "get": {
        "description": "Returns the 'Bassline of Cell Info', if you care about that kind of stuff."
      }
    },
  },
  "metadata": {
    "version": "1.0.0",
    "description": "Bassline of Cells, providing monotonic data structures for coordination-free distributed state!",
    "relevantPapers": [{
      "title": "Propagation networks : a flexible and expressive substrate for computation",
      "author": "Alexey Radul",
      "link": "https://dspace.mit.edu/handle/1721.1/54635"
    }]
  }
}
```


### Read-only Config Bassline

```json
{
  "resources": {
    "/theme": {
      "get": {
        "description": "Current theme setting",
        "returns": "string"
      }
    },
    "/features": {
      "get": {
        "description": "Enabled feature flags",
        "returns": "array"
      }
    }
  },
  "metadata": {
    "immutable": true
  }
}
```
