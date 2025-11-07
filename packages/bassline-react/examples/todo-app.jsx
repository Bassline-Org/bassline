/**
 * Minimal Todo App - Demonstrates Bassline React Integration
 *
 * Shows:
 * - GraphProvider setup
 * - useQuery for reactive lists
 * - Direct graph mutations
 * - Pattern matching with variables
 * - Reified rules integration
 */
import { useState } from 'react';
import { RuntimeProvider, useRuntime, useQuery } from '../src/index.js';
import { Runtime } from '@bassline/parser/interactive';

// Initialize runtime (browser-compatible)
const runtime = new Runtime();
const graph = runtime.graph;
runtime.eval(`
  rule mark-done
    where {
      ?todo completed true ?ctx
    }
    produce { ?todo status done ?ctx }
  `)

export default function App() {
  return (
    <RuntimeProvider runtime={runtime}>
      <div style={{ maxWidth: '600px', margin: '40px auto', fontFamily: 'system-ui' }}>
        <h1>Bassline Todo App</h1>
        <AddTodo />
        <TodoList />
        <Stats />
      </div>
    </RuntimeProvider>
  );
}

function AddTodo() {
  const rt = useRuntime();
  const [text, setText] = useState('');

  const handleAdd = () => {
    if (!text.trim()) return;
    const id = `todo:${Date.now()}`;
    rt.eval(`
        insert {
          ${id} {
            type todo
            text ${text}
          }
        }
      `)
    setText('');
  };

  return (
    <div style={{ marginBottom: '20px' }}>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        placeholder="What needs to be done?"
        style={{ padding: '8px', width: '400px', fontSize: '16px' }}
      />
      <button onClick={handleAdd} style={{ padding: '8px 16px', marginLeft: '8px' }}>
        Add
      </button>
    </div>
  );
}

function TodoList() {
  // Query for active todos (not tombstoned)
  const rt = useRuntime();

  const todos = useQuery({
    patterns: [
      ["?id", "type", "todo", "*"],
      ["?id", "text", "?text", "*"]
    ],
    nac: [
      ["?id", "type", "todo", "tombstone"]
    ]
  });

  if (todos.length === 0) {
    return <p style={{ color: '#999' }}>No todos yet. Add one above!</p>;
  }

  return (
    <ul style={{ listStyle: 'none', padding: 0 }}>
      {todos.map((binding) => (
        <TodoItem key={binding.get('?id')} id={binding.get('?id')} />
      ))}
    </ul>
  );
}

function TodoItem({ id }) {
  const rt = useRuntime();
  const graph = rt.graph;
  const attrs = useQuery([[id, "?attr", "?value", "*"]]);

  // Build attribute map
  const attrMap = new Map();
  attrs.forEach(binding => {
    attrMap.set(binding.get("?attr"), binding.get("?value"));
  });

  const text = attrMap.get("text") ?? "";
  const completed = attrMap.get("completed") ?? false;
  const status = attrMap.get("status"); // Set by rule!

  const handleToggle = () => {
    if (!completed) {
      graph.add(id, 'completed', !completed, null);
    }
  };

  const handleDelete = () => {
    graph.add(id, 'type', 'todo', 'tombstone');
  };

  return (
    <li style={{
      padding: '12px',
      marginBottom: '8px',
      border: '1px solid #ddd',
      borderRadius: '4px',
      display: 'flex',
      alignItems: 'center',
      backgroundColor: status === 'done' ? '#e8f5e9' : 'white'
    }}>
      <input
        type="checkbox"
        checked={completed}
        onChange={handleToggle}
        style={{ marginRight: '12px' }}
      />
      <span style={{
        flex: 1,
        textDecoration: completed ? 'line-through' : 'none',
        color: completed ? '#999' : 'black'
      }}>
        {text}
      </span>
      {status === 'done' && (
        <span style={{ marginRight: '12px', color: '#4caf50', fontSize: '12px' }}>
          ✓ DONE
        </span>
      )}
      <button onClick={handleDelete} style={{ padding: '4px 8px', color: '#f44336' }}>
        Delete
      </button>
    </li>
  );
}

function Stats() {
  // Multiple queries - all reactive!
  const allTodos = useQuery([["?id", "type", "todo", "*"]]);

  const completedTodos = useQuery([
    ["?id", "type", "todo", "*"],
    ["?id", "completed", true, "*"]
  ]);

  // Query with NAC - todos NOT deleted
  const activeTodos = useQuery({
    patterns: [["?id", "type", "todo", "*"]],
    nac: [["?id", "type", "todo", "tombstone"]]
  });

  return (
    <div style={{
      marginTop: '20px',
      padding: '12px',
      backgroundColor: '#f5f5f5',
      borderRadius: '4px',
      fontSize: '14px'
    }}>
      <strong>Stats:</strong>{' '}
      {activeTodos.length} active / {completedTodos.length} completed / {allTodos.length} total
    </div>
  );
}
