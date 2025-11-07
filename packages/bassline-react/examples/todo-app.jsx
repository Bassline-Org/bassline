/**
 * Minimal Todo App - Demonstrates Bassline React Integration
 *
 * Shows:
 * - RuntimeProvider setup
 * - useQuery with pattern language
 * - Pattern language for mutations (runtime.eval)
 * - Object syntax for clean queries
 */
import { useState } from "react";
import {
  RuntimeProvider,
  useComputedQuery,
  useQuery,
  useRuntime,
} from "../src/index.js";
import { Runtime } from "@bassline/parser/interactive";

// Initialize runtime (browser-compatible)
const runtime = new Runtime();

export default function App() {
  return (
    <RuntimeProvider runtime={runtime}>
      <div
        style={{
          maxWidth: "600px",
          margin: "40px auto",
          fontFamily: "system-ui",
        }}
      >
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
  const [text, setText] = useState("");

  const handleAdd = () => {
    if (!text.trim()) return;
    const id = `todo:${Date.now()}`;
    rt.eval(`
      insert {
        group todos {
          ${id} {
            type todo
            text "${text}"
          }
        }
      }
    `);
    setText("");
  };

  return (
    <div style={{ marginBottom: "20px" }}>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        placeholder="What needs to be done?"
        style={{ padding: "8px", width: "400px", fontSize: "16px" }}
      />
      <button
        onClick={handleAdd}
        style={{ padding: "8px 16px", marginLeft: "8px" }}
      >
        Add
      </button>
    </div>
  );
}

function TodoList() {
  const todos = useComputedQuery([], {
    where: "?id type todo todos",
    onMatch: (binding, setTodos) => {
      const id = binding.get("?id");
      setTodos((prev) => [...prev, id]);
    },
  });

  const deletedTodos = useComputedQuery({}, {
    where: "?id deleted true todos",
    onMatch: (binding, setDeletedTodos) => {
      const id = binding.get("?id");
      setDeletedTodos((prev) => ({ ...prev, [id]: true }));
    },
  });

  if (todos.length === 0) {
    return <p style={{ color: "#999" }}>No todos yet. Add one above!</p>;
  }

  return (
    <ul style={{ listStyle: "none", padding: 0 }}>
      {todos
        .filter((id) => !deletedTodos[id])
        .map((id, index) => {
          return (
            <TodoItem
              key={id}
              id={id}
            />
          );
        })}
    </ul>
  );
}

function TodoItem({ id }) {
  const rt = useRuntime();
  const completed = useComputedQuery(false, {
    where: `${id} completed true todos`,
    onMatch: (binding, setCompleted) => {
      setCompleted(true);
    },
  });
  const text = useComputedQuery("", {
    where: `${id} text ?text todos`,
    onMatch: (binding, setText) => {
      setText(binding.get("?text"));
    },
  });

  const handleToggle = () => {
    if (!completed) {
      const query = `insert { ${id} completed true todos }`;
      rt.eval(query);
    }
  };

  const handleDelete = () => {
    rt.eval(`insert { ${id} deleted true todos }`);
  };

  return (
    <li
      style={{
        padding: "12px",
        marginBottom: "8px",
        border: "1px solid #ddd",
        borderRadius: "4px",
        display: "flex",
        alignItems: "center",
        backgroundColor: completed ? "#e8f5e9" : "white",
      }}
    >
      <input
        type="checkbox"
        checked={completed}
        onChange={handleToggle}
        style={{ marginRight: "12px" }}
      />
      <span
        style={{
          flex: 1,
          textDecoration: completed ? "line-through" : "none",
          color: completed ? "#999" : "black",
        }}
      >
        {text}
      </span>
      {completed && (
        <span
          style={{ marginRight: "12px", color: "#4caf50", fontSize: "12px" }}
        >
          ✓ DONE
        </span>
      )}
      <button
        onClick={handleDelete}
        style={{ padding: "4px 8px", color: "#f44336" }}
      >
        Delete
      </button>
    </li>
  );
}

function Stats() {
  // Multiple reactive queries - all using pattern language!
  const allTodos = useComputedQuery(0, {
    where: "?id type todo todos",
    onMatch: (_, setResult) => setResult((prev) => prev + 1),
  });

  const completedTodos = useComputedQuery(0, {
    where: `?id completed true todos`,
    onMatch: (_, setResult) => setResult((prev) => prev + 1),
  });

  const deletedTodos = useComputedQuery(0, {
    where: `?id deleted true todos`,
    onMatch: (_, setResult) => setResult((prev) => prev + 1),
  });
  const activeTodos = allTodos - completedTodos - deletedTodos;

  return (
    <div
      style={{
        marginTop: "20px",
        padding: "12px",
        backgroundColor: "#f5f5f5",
        borderRadius: "4px",
        fontSize: "14px",
      }}
    >
      <strong>Stats:</strong> {activeTodos} active / {completedTodos}{" "}
      completed / {allTodos} total
    </div>
  );
}
