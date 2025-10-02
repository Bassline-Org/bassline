/**
 * useTable - Create a component-local table gadget
 *
 * Use this hook when you need a table (key-value store) that exists within a component.
 * Tables support queries, get/set operations, and observation of additions.
 *
 * @param factory - Function that creates the table (called once on mount)
 * @returns Tuple of [tableData, table] - data for rendering, table for operations
 *
 * @example
 * ```tsx
 * function TodoList() {
 *   const [todos, todosTable] = useTable(() => table.first<Todo>({}))
 *
 *   const addTodo = (text: string) => {
 *     const id = Date.now().toString()
 *     todosTable.set({ [id]: { text, done: false } })
 *   }
 *
 *   return (
 *     <div>
 *       {Object.entries(todos).map(([id, todo]) => (
 *         <div key={id}>
 *           {todo.text}
 *           <button onClick={() => todosTable.set({ [id]: { ...todo, done: !todo.done } })}>
 *             Toggle
 *           </button>
 *         </div>
 *       ))}
 *     </div>
 *   )
 * }
 * ```
 */

import { useMemo, useSyncExternalStore } from 'react';
import type { Implements, SweetTable } from 'port-graphs';
import { Table, Valued } from 'port-graphs/protocols';


type TableLike<T> = SweetTable<T> & Implements<Table<string, T>>

export function useTable<T>(
  factory: () => TableLike<T>
): readonly [Record<string, Record<string, T>>, TableLike<T>] {
  // Create table once on mount
  const table = useMemo(factory, []);

  // Subscribe to changes
  const data = useSyncExternalStore(
    (callback) => {
      // Subscribe to table changes
      // Note: Tables emit { changed, added } effects
      const cleanup = table.tap(() => callback());
      return cleanup;
    },
    () => table.current()
  );

  return [data, table] as const;
}
