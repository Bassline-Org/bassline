# @bassline/parser-react

React integration for visualizing Bassline graphs with React Flow.

## Features

- **Real-time updates**: Automatically re-renders when quads are added
- **Zero duplication**: Uses `useSyncExternalStore` to read directly from graph
- **Incremental rendering**: React Flow efficiently diffs changes
- **Query visualization**: Show only quads matching a pattern
- **Context filtering**: Filter visualization by context/group

## Installation

```bash
pnpm add @bassline/parser-react
```

## Usage

### Basic Graph Visualization

```javascript
import { WatchedGraph } from '@bassline/parser/algebra/watch';
import { instrument } from '@bassline/parser/algebra/instrument';
import { GraphVisualization } from '@bassline/parser-react';
import { quad as q, word as w } from '@bassline/parser/types';

const graph = new WatchedGraph();
const events = instrument(graph);

// Add data
graph.add(q(w('alice'), w('age'), 30, w('ctx1')));
graph.add(q(w('alice'), w('friend'), w('bob'), w('ctx1')));
graph.add(q(w('bob'), w('age'), 25, w('ctx1')));

// Render
function App() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <GraphVisualization graph={graph} events={events} />
    </div>
  );
}
```

### Query Result Visualization

```javascript
import { matchGraph, pattern, patternQuad } from '@bassline/parser/algebra/pattern';
import { variable as v, WC } from '@bassline/parser/types';
import { QueryVisualization } from '@bassline/parser-react';

// Define pattern
const agePattern = pattern(
  patternQuad(v('person'), w('age'), v('age'), WC)
);

// Match against graph
const results = matchGraph(graph, agePattern);

// Visualize only matching quads
function App() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <QueryVisualization
        graph={graph}
        events={events}
        queryResults={results}
      />
    </div>
  );
}
```

### Context Filtering

```javascript
// Only show quads from specific context
<GraphVisualization
  graph={graph}
  events={events}
  filterContext="ctx1"
/>
```

## API

### `useGraphQuads(graph, events)`

Hook that subscribes to graph changes using `useSyncExternalStore`.

**Parameters:**
- `graph` - The WatchedGraph instance
- `events` - EventTarget from `instrument(graph)`

**Returns:** Array of current quads from graph

### `quadsToReactFlow(quads)`

Transform quads to React Flow node/edge format.

**Parameters:**
- `quads` - Array of Quad objects

**Returns:** `{ nodes, edges }` in React Flow format

### `<GraphVisualization>`

Component that visualizes the entire graph.

**Props:**
- `graph` - The WatchedGraph instance
- `events` - EventTarget from `instrument(graph)`
- `filterContext` (optional) - Only show quads from this context

### `<QueryVisualization>`

Component that visualizes query results.

**Props:**
- `graph` - The WatchedGraph instance
- `events` - EventTarget from `instrument(graph)`
- `queryResults` - Array of Match objects from `matchGraph()`

## How It Works

1. **`instrument(graph)`** wraps `graph.add()` to emit events
2. **`useGraphQuads`** subscribes to events via `useSyncExternalStore`
3. **On quad addition**, event fires → React re-renders
4. **`quadsToReactFlow`** transforms `graph.quads` to React Flow format
5. **React Flow** efficiently diffs and renders only changed nodes/edges

**Key Insight:** Graph is the source of truth. No state duplication.

## Performance

- **<1000 nodes**: Excellent performance
- **1000-5000 nodes**: Good performance with memoization
- **5000+ nodes**: May need custom optimizations

The system uses dagre for automatic layout and React Flow's built-in optimizations for rendering.

## License

MIT
