# Services - Claude API Integration

The services package provides Claude API integration as Bassline resources, enabling LLM-powered features and agentic workflows.

## Creating the Claude Service

```javascript
import { createClaude } from '@bassline/services'

const claude = createClaude({
  apiKey: process.env.ANTHROPIC_API_KEY, // Optional, uses env var by default
  model: 'claude-sonnet-4-20250514', // Optional, default model
})
```

## Simple Completion

For quick text completions:

```javascript
const { body } = await claude.put(
  { path: '/complete' },
  {
    prompt: 'What is the capital of France?',
    system: 'You are a helpful geography assistant.', // Optional
    max_tokens: 1024, // Optional
  }
)

// Result:
// {
//   text: 'The capital of France is Paris.',
//   usage: { input_tokens: 15, output_tokens: 8 },
//   stop_reason: 'end_turn'
// }
```

## Full Messages API

For multi-turn conversations and advanced features:

```javascript
const { body } = await claude.put(
  { path: '/messages' },
  {
    messages: [
      { role: 'user', content: 'Hello!' },
      { role: 'assistant', content: 'Hi there! How can I help?' },
      { role: 'user', content: 'What can you do?' },
    ],
    system: 'You are a helpful assistant.',
    max_tokens: 4096,
    temperature: 0.7, // Optional: 0-1
    stop_sequences: ['END'], // Optional
  }
)

// Result is the full Claude response object
```

## Agentic Loop

Run Claude in a loop where it can interact with Bassline resources:

```javascript
const { body } = await claude.put(
  { path: '/agent', kit: myKit },
  {
    prompt: 'Create a counter cell and increment it 3 times',
    system: 'You can interact with Bassline using the provided tools.',
    maxTurns: 10, // Optional, default 10
  }
)
```

The MCP integration builds on top of blits, meaning the LLM has access to a full computational sandbox to work inside via a single tool. Because the system is built for discovery, context fills slower as the agent learns in parts.

The agent uses a single `bl` tool with the native Bassline protocol:

### bl

Interact with Bassline resources using the native protocol (headers + body).

```javascript
{
  name: 'bl',
  input: {
    method: 'get',  // or 'put'
    headers: { path: '/cells/counter/value' },
    body: null  // for PUT requests
  }
}
```

Key paths to explore:

- `GET {path:"/"}` - Explore available resources
- `GET {path:"/guide"}` - Learn how the system works
- `/cells/*` - Lattice-based state (monotonic merge)
- `/store/*` - Key/value storage
- `/fn/*` - Stored functions
- `/tcl/eval` - Evaluate TCL scripts

Headers control routing and behavior:

- `path` - Resource path (required)
- `type` - Content type hint (e.g., "tcl/dict", "js/num")

### Agent Example

```javascript
import { createClaude } from '@bassline/services'
import { createCells, routes } from '@bassline/core'

const cells = createCells()
const claude = createClaude()

const kit = routes({
  cells: cells,
})

// Agent can now create and manipulate cells
const result = await claude.put(
  { path: '/agent', kit },
  {
    prompt: 'Create a cell called "score" with maxNumber lattice, set it to 100, then read it back',
    system: 'You are managing Bassline resources. Use the bl tool to interact with resources.',
  }
)

// The agent will use the bl tool:
// 1. bl({ method: 'put', headers: { path: '/cells/score' }, body: { lattice: 'maxNumber' } })
// 2. bl({ method: 'put', headers: { path: '/cells/score/value' }, body: 100 })
// 3. bl({ method: 'get', headers: { path: '/cells/score/value' } })
// 4. Return the final result
```

## Patterns

### Conversational Assistant

```javascript
const messages = []

async function chat(userMessage) {
  messages.push({ role: 'user', content: userMessage })

  const { body } = await claude.put(
    { path: '/messages' },
    {
      messages,
      system: 'You are a helpful Bassline assistant.',
      max_tokens: 4096,
    }
  )

  const reply = body.content
    .filter(c => c.type === 'text')
    .map(c => c.text)
    .join('')

  messages.push({ role: 'assistant', content: reply })

  return reply
}

await chat('Hello!')
await chat('How do I create a cell?')
```

### Autonomous Agent

```javascript
async function runTask(task) {
  const result = await claude.put(
    { path: '/agent', kit },
    {
      prompt: task,
      system: `You are an autonomous agent managing a Bassline application.

Available resources:
- /cells/* - Lattice-based state (maxNumber, setUnion, object, lww, boolean)
- /store/* - Key/value storage
- /fn/* - Functions

Complete the task by reading and writing resources as needed.`,
      maxTurns: 20,
    }
  )

  return result
}

await runTask('Initialize the application with a counter at 0 and a config with debug=true')
await runTask('Increment the counter by 5 and add a timestamp to config')
```

### Service Discovery

```javascript
const { body } = await claude.get({ path: '/' })

// {
//   name: 'claude',
//   description: 'Anthropic Claude API integration',
//   model: 'claude-sonnet-4-20250514',
//   operations: [
//     { name: 'messages', method: 'PUT', path: '/messages' },
//     { name: 'complete', method: 'PUT', path: '/complete' },
//     { name: 'agent', method: 'PUT', path: '/agent' }
//   ]
// }
```

### Error Handling

```javascript
const result = await claude.put(
  { path: '/complete' },
  {
    prompt: 'Hello',
  }
)

if (result.headers.condition === 'error') {
  console.error('Claude error:', result.headers.message)
  // Handle rate limits, API errors, etc.
}
```
