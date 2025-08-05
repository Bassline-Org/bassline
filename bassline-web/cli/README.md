# Bassline CLI

Command-line interface for running and managing Bassline propagation networks.

## Installation

```bash
cd cli
npm install
npm run build
npm link  # Makes 'bassline' command available globally
```

## Commands

### Start a Network Server

Start a propagation network server that exposes an HTTP API:

```bash
bassline start --port 8455 --name my-network
```

The default port is 8455 (BASS in l33tspeak). This starts a server with REST endpoints for interacting with the network:
- `GET /state?groupId=<id>` - Get group state
- `POST /contact` - Add a contact
- `POST /connect` - Create a wire
- `POST /update` - Update contact content

See `openapi.yaml` for the full API specification.

### Run a Network from File

Execute a network definition from a JSON file:

```bash
bassline run network.json --watch --scheduler immediate
```

Options:
- `--watch` - Watch file for changes and reload
- `--scheduler <type>` - Choose scheduler: `immediate` or `batch`

### Connect to a Running Network

Connect to a network server and interact with it:

```bash
bassline connect http://localhost:8455 --interactive
```

In interactive mode, you can use commands like:
- `state [groupId]` - Show group state
- `add <groupId> <content>` - Add contact
- `connect <from> <to>` - Connect contacts
- `update <id> <content>` - Update contact
- `exit` - Disconnect

### Export/Import Network State

Export a network to a file:

```bash
bassline export network.json --group root
```

Import a network from a file:

```bash
bassline import network.json --merge
```

## Network File Format

Network files are JSON with the following structure:

```json
{
  "groups": {
    "root": {
      "id": "root",
      "name": "Root Group",
      "contactIds": ["contact1", "contact2"],
      "wireIds": ["wire1"],
      "subgroupIds": ["subgroup1"],
      "boundaryContactIds": []
    }
  },
  "contacts": {
    "contact1": {
      "id": "contact1",
      "content": "Hello",
      "blendMode": "accept-last",
      "groupId": "root"
    }
  },
  "wires": {
    "wire1": {
      "id": "wire1",
      "fromId": "contact1",
      "toId": "contact2",
      "type": "bidirectional"
    }
  }
}
```

## Use Cases

1. **Headless Execution**: Run propagation networks on servers without a UI
2. **Testing**: Automate network testing with scripted interactions
3. **Integration**: Connect propagation networks to other systems via HTTP API
4. **Development**: Quickly prototype and test network configurations

## Examples

### Simple Calculator Network

```json
{
  "groups": {
    "root": {
      "id": "root",
      "name": "Calculator",
      "contactIds": ["a", "b", "sum"],
      "subgroupIds": ["adder"]
    },
    "adder": {
      "id": "adder",
      "name": "Add",
      "primitiveId": "add",
      "boundaryContactIds": ["adder-a", "adder-b", "adder-sum"]
    }
  },
  "contacts": {
    "a": { "id": "a", "content": 5, "blendMode": "accept-last", "groupId": "root" },
    "b": { "id": "b", "content": 3, "blendMode": "accept-last", "groupId": "root" },
    "sum": { "id": "sum", "content": null, "blendMode": "accept-last", "groupId": "root" }
  },
  "wires": {
    "w1": { "id": "w1", "fromId": "a", "toId": "adder-a", "type": "directed" },
    "w2": { "id": "w2", "fromId": "b", "toId": "adder-b", "type": "directed" },
    "w3": { "id": "w3", "fromId": "adder-sum", "toId": "sum", "type": "directed" }
  }
}
```

Run it:
```bash
bassline run calculator.json
```

The network will compute 5 + 3 = 8 and propagate the result to the `sum` contact.