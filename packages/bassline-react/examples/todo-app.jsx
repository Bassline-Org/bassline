/**
 * Minimal Todo App - Demonstrates Bassline React Integration
 *
 * Shows:
 * - RuntimeProvider setup
 * - useQuery with pattern language
 * - Pattern language for mutations (runtime.eval)
 * - Object syntax for clean queries
 */
import { useState } from 'react';
import { RuntimeProvider, useRuntime, useQuery } from '../src/index.js';
import { Runtime } from '@bassline/parser/interactive';

// Initialize runtime (browser-compatible)
const runtime = new Runtime();

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
          text "${text}"
        }
      }
    `);
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
  const todos = useQuery(`
    where {
      ?id {
        type todo 
        text ?text 
      }
    }
    not {
      ?id type todo tombstone
    }`);

  if (todos.length === 0) {
    return <p style={{ color: '#999' }}>No todos yet. Add one above!</p>;
  }

  return (
    <ul style={{ listStyle: 'none', padding: 0 }}>
      {todos.map((binding, index) => {
        const id = binding.get('?id');
        const text = binding.get('?text');
        return (
          <TodoItem
            key={`${id}-${index}`}
            id={id}
            text={text}
          />
        );
      })}
    </ul>
  );
}

function TodoItem({ id, text }) {
  const rt = useRuntime();

  const [completedBindings] = useQuery(`where { ${id} completed ?value * }`);
  const completed = completedBindings?.get('?value') ?? false;

  const handleToggle = () => {
    if (!completed) {
      const query = `insert { ${id} { completed true } }`;
      rt.eval(query);
    }
  };

  const handleDelete = () => {
    rt.eval(`insert { ${id} type todo tombstone }`);
  };

  return (
    <li style={{
      padding: '12px',
      marginBottom: '8px',
      border: '1px solid #ddd',
      borderRadius: '4px',
      display: 'flex',
      alignItems: 'center',
      backgroundColor: completed ? '#e8f5e9' : 'white'
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
      {completed && (
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
  // Multiple reactive queries - all using pattern language!
  const allTodos = useQuery('where { ?id type todo * }');
  const completedTodos = useQuery('where { ?id { type todo completed true } }');
  const activeTodos = useQuery('where { ?id type todo * } not { ?id type todo tombstone }');

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
