# Bassline System Explorer

A Smalltalk-style system browser for Bassline. Explore the live state of a Bassline system through its own introspection capabilities.

## Features

- **Resolver Browser** - Lists all registered middleware patterns
- **Mirror Browser** - Live-updating list of all resolved mirrors
- **Inspector** - View capabilities and current value of any mirror
- **Live Updates** - Values update in real-time via SSE
- **Clickable Refs** - Navigate into `$ref` markers in compound structures
- **Edit Values** - Modify writable mirrors directly

## Quick Start

1. Start the Bassline HTTP server:
   ```bash
   node bin/server.js -p 8080 -c counter=0 -c name=alice
   ```

2. Open `index.html` in a browser

3. Click "Connect" (default: http://localhost:8080)

## How It Works

The explorer uses Bassline's built-in introspection:

- `bl:///registry` - Lists all resolver patterns
- `bl:///registry/mirrors` - Lists all resolved mirror URIs (subscribed via SSE)
- `bl:///registry/info?ref=<uri>` - Gets capabilities of a specific mirror
- Standard read/write operations for values

This demonstrates Bassline's reflective nature - the system can observe itself.

## Usage

1. **Browse Resolvers** - Left panel shows all middleware patterns
2. **Browse Mirrors** - Middle panel shows all resolved mirrors, updates live
3. **Inspect** - Click any mirror to see its capabilities and value
4. **Navigate** - Click `$ref` links in values to jump to that mirror
5. **Edit** - For writable mirrors, click "Edit" to modify the value
