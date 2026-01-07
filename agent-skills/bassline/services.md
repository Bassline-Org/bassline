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

The agent receives these tools automatically:

| Tool             | Description                    |
| ---------------- | ------------------------------ |
| `bassline_get`   | GET a resource by URI          |
| `bassline_put`   | PUT a value to a resource      |
| `bassline_list`  | List resources at a path       |
| `bassline_links` | Query links to/from a resource |

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
    system:
      'You are managing Bassline resources. Use bassline_put to create cells and set values, bassline_get to read them.',
  }
)

// The agent will:
// 1. PUT /cells/score with { lattice: 'maxNumber' }
// 2. PUT /cells/score/value with 100
// 3. GET /cells/score/value
// 4. Return the final result
```

## Tool Definitions

The MCP-style tools provided to the agent:

### bassline_get

```javascript
{
  name: 'bassline_get',
  input: { uri: 'bl:///cells/counter/value' }
}
// Returns the resource headers and body as JSON
```

### bassline_put

```javascript
{
  name: 'bassline_put',
  input: {
    uri: 'bl:///cells/counter/value',
    body: 42
  }
}
// Returns the result of the PUT operation
```

### bassline_list

```javascript
{
  name: 'bassline_list',
  input: { path: '/cells' }
}
// Returns directory entries at the path
```

### bassline_links

```javascript
{
  name: 'bassline_links',
  input: {
    direction: 'to',  // or 'from'
    uri: 'bl:///users/alice'
  }
}
// Returns related resources
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

### With Custom Tools

For advanced use cases, create your own tool definitions:

```javascript
import { createMCPTools, runAgentLoop } from '@bassline/services'

// Get the standard tools
const standardTools = createMCPTools(basslineInstance)

// Add custom tools
const tools = [
  ...standardTools,
  {
    name: 'send_email',
    description: 'Send an email notification',
    input_schema: {
      type: 'object',
      properties: {
        to: { type: 'string' },
        subject: { type: 'string' },
        body: { type: 'string' },
      },
      required: ['to', 'subject', 'body'],
    },
    handler: async ({ to, subject, body }) => {
      // Your email logic
      return 'Email sent successfully'
    },
  },
]
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

### Streaming (via Messages API)

For streaming responses, use the underlying Anthropic SDK directly or check for streaming support in your version of the service.
