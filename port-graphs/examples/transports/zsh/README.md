# ZSH MaxCell Gadget

A MaxCell gadget implemented in pure zsh shell script. Works with ANY client that speaks the gadget protocol.

## The Point

**Gadgets are just a protocol**. This zsh script is a fully functional gadget that can communicate with TypeScript, Python, or any other gadget implementation.

## Running

### Start the zsh gadget server:

```bash
cd zsh
chmod +x maxcell.zsh run-server.sh

# Using socat (install with: brew install socat)
./run-server.sh

# Or using netcat directly
nc -l 3002 -c ./maxcell.zsh
```

### Connect with ANY client:

Use the existing TCP client (TypeScript):
```bash
cd ../tcp
npx tsx client.ts
```

Or connect manually with netcat:
```bash
echo '{"changed":10}' | nc localhost 3002
echo '{"changed":5}' | nc localhost 3002
echo '{"changed":20}' | nc localhost 3002
```

Or even telnet:
```bash
telnet localhost 3002
{"changed":10}
{"changed":20}
```

## The Protocol

The zsh script speaks the exact same protocol as TypeScript gadgets:

**Receive**: `{"changed": 10}`
**Emit**: `{"changed": 10}`

That's it. Any gadget that sends/receives this format can communicate with the zsh gadget.

## How It Works

```zsh
# Parse incoming JSON (using jq or regex)
incoming=$(echo "$line" | jq -r '.changed // empty')

# Consider → Act protocol
if (( incoming > CURRENT_MAX )); then
    CURRENT_MAX=$incoming
    echo "{\"changed\":$CURRENT_MAX}"  # Emit
fi
```

## Key Insight

The zsh gadget doesn't need a special client. It's just another gadget that:
1. Receives JSON messages
2. Processes them (consider → act)
3. Emits JSON effects

The transport (TCP) and serialization (JSON) are the only requirements. The implementation language is irrelevant.