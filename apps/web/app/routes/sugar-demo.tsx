import type { Route } from "./+types/sugar-demo";
import { useEffect } from 'react';
import { useLocalGadget } from '@bassline/react';
import { cells } from '@bassline/core';
import { useDerived } from "@bassline/react";

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "Sugar Hook Demo" },
    { name: "description", content: "Testing new sugar-based React hooks" },
  ];
}

export default function SugarDemo() {
  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold mb-8">Sugar Hook Demo</h1>

        {/* Counter Example - useLocalGadget */}
        <section className="border border-slate-200 rounded-lg p-6 bg-white">
          <h2 className="text-xl font-semibold mb-4">1. useLocalGadget - Counter</h2>
          <Counter />
        </section>

        {/* Derived Sum - useDerive */}
        <section className="border border-slate-200 rounded-lg p-6 bg-white">
          <h2 className="text-xl font-semibold mb-4">2. useDerive - Computed Sum</h2>
          <DerivedSum />
        </section>

        {/* Synced Inputs - Wiring */}
        <section className="border border-slate-200 rounded-lg p-6 bg-white">
          <h2 className="text-xl font-semibold mb-4">3. Wiring - Synced Inputs</h2>
          <SyncedInputs />
        </section>
      </div>
    </div>
  );
}

function Counter() {
  const [count, counter] = useLocalGadget(() => cells.max(0));

  return (
    <div className="space-y-2">
      <div className="text-2xl font-mono">{count}</div>
      <div className="flex gap-2">
        <button
          onClick={() => counter.receive(count + 1)}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Increment
        </button>
        <button
          onClick={() => counter.receive(count - 1)}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
        >
          Decrement
        </button>
        <button
          onClick={() => counter.receive(0)}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          Reset
        </button>
      </div>
      <p className="text-sm text-slate-600">
        Uses max cell - monotonically increasing (can only go up)
      </p>
    </div>
  );
}

function DerivedSum() {
  const [a, cellA] = useLocalGadget(() => cells.max(0));
  const [b, cellB] = useLocalGadget(() => cells.max(0));

  const [sum] = useDerived(
    { a: cellA, b: cellB },
    ({ a, b }) => a + b
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">A</label>
          <input
            type="number"
            value={a}
            onChange={(e) => cellA.receive(+e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">B</label>
          <input
            type="number"
            value={b}
            onChange={(e) => cellB.receive(+e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded"
          />
        </div>
      </div>
      <div className="text-xl font-semibold">
        Sum: {sum}
      </div>
      <p className="text-sm text-slate-600">
        Derived value automatically updates when either source changes
      </p>
    </div>
  );
}

function SyncedInputs() {
  const [value1, cell1] = useLocalGadget(() => cells.ordinal('Hello'));
  const [value2, cell2] = useLocalGadget(() => cells.ordinal('Hello'));

  useEffect(() => {
    const cleanup = cell1.sync(cell2);
    return cleanup;
  }, [cell1, cell2]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Input 1</label>
          <input
            type="text"
            value={value1[1]}
            onChange={(e) => cell1.receive([value1[0] + 1, e.target.value])}
            className="w-full px-3 py-2 border border-slate-300 rounded"
          />
          <p className="text-xs text-slate-500 mt-1">Version: {value1[0]}</p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Input 2</label>
          <input
            type="text"
            value={value2[1]}
            onChange={(e) => cell2.receive([value2[0] + 1, e.target.value])}
            className="w-full px-3 py-2 border border-slate-300 rounded"
          />
          <p className="text-xs text-slate-500 mt-1">Version: {value2[0]}</p>
        </div>
      </div>
      <p className="text-sm text-slate-600">
        These inputs are bidirectionally synced using ordinal cells with causality tracking
      </p>
    </div>
  );
}
