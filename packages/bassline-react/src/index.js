/**
 * Bassline React Integration
 *
 * Minimal React bindings for Bassline graph system.
 *
 * @example
 * import { GraphProvider, useGraph, useQuery } from '@bassline/react-graph';
 * import { Runtime } from '@bassline/parser/interactive';
 *
 * const runtime = new Runtime();
 *
 * function App() {
 *   return (
 *     <GraphProvider graph={runtime.graph}>
 *       <TodoList />
 *     </GraphProvider>
 *   );
 * }
 *
 * function TodoList() {
 *   const graph = useGraph();
 *   const todos = useQuery([["?id", "type", "todo", "*"]]);
 *
 *   return (
 *     <ul>
 *       {todos.map(binding => (
 *         <li key={binding.get("?id")}>
 *           {binding.get("?id")}
 *         </li>
 *       ))}
 *     </ul>
 *   );
 * }
 */

export { RuntimeProvider } from "./RuntimeContext.jsx";
export { useRuntime } from "./useRuntime.js";
export { useComputedQuery, useQuery } from "./useQuery.js";
