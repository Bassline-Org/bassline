import type { Route } from "./+types/notebook-demo";
import { useEffect, useState } from 'react';
import { GadgetProvider, useGadgetMap, useRelations, Wire } from 'port-graphs-react';
import {
  withTaps,
  maxCell,
  unionCell,
  sliderGadget,
  lastCell,
  extract,
  transform,
  combiner,
  fn,
  type Gadget,
  type Tappable,
  type CellSpec,
  type SliderSpec,
  type SetCell,
} from 'port-graphs';
import { Notebook, NotebookSection, GadgetDisplay } from '../notebook';

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "Notebook Demo - Bassline" },
    { name: "description", content: "Demonstrating gadget pattern compositions" },
  ];
}

// Pattern 1: Bidirectional Sync (simplified with relations)
function BidirectionalSyncDemo() {
  const [gadgets] = useState(() => ({
    a: withTaps(maxCell(10)),
    b: withTaps(maxCell(10))
  }));

  // Use relations for clean bidirectional wiring
  useRelations([
    () => extract(gadgets.a, 'changed', gadgets.b),
    () => extract(gadgets.b, 'changed', gadgets.a)
  ]);

  return <BidirectionalDisplay gadgets={gadgets} />;
}

function BidirectionalDisplay({ gadgets }: {
  gadgets: {
    a: Gadget<CellSpec<number>> & Tappable<CellSpec<number>>;
    b: Gadget<CellSpec<number>> & Tappable<CellSpec<number>>;
  }
}) {
  const g = useGadgetMap(gadgets);

  return (
    <div className="p-4 space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">Primary (max cell): {g.a.state}</label>
        <input
          type="number"
          value={g.a.state}
          onChange={(e) => g.a.send(Number(e.target.value))}
          className="border rounded px-2 py-1 w-full"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-2">Secondary (max cell): {g.b.state}</label>
        <input
          type="number"
          value={g.b.state}
          onChange={(e) => g.b.send(Number(e.target.value))}
          className="border rounded px-2 py-1 w-full"
        />
      </div>
      <div className="text-sm text-gray-600">
        Both cells are maxCells synced bidirectionally - they'll always show the maximum value entered in either.
      </div>
    </div>
  );
}

// Pattern 2: Many-to-One Aggregation (using combiner)
const aggregatorGadgets = {
  input1: withTaps(sliderGadget(10, 0, 100, 1)),
  input2: withTaps(sliderGadget(20, 0, 100, 1)),
  input3: withTaps(sliderGadget(30, 0, 100, 1)),
  sum: withTaps(fn(
    ({ a, b, c }: { a: number; b: number; c: number }) => a + b + c,
    ['a', 'b', 'c']
  )({ a: 10, b: 20, c: 30 }))
}
function AggregatorDemo() {
  const gadgets = useGadgetMap(aggregatorGadgets);

  // Use combiner to wire sliders to the sum function
  useRelations([
    () => combiner(gadgets.sum.gadget)
      .wire('a', gadgets.input1.gadget)
      .wire('b', gadgets.input2.gadget)
      .wire('c', gadgets.input3.gadget)
      .build()
  ]);

  return <AggregatorDisplay gadgets={aggregatorGadgets} />;
}

function AggregatorDisplay({ gadgets }: {
  gadgets: typeof aggregatorGadgets
}) {
  const g = useGadgetMap(gadgets);

  return (
    <div className="p-4 space-y-3">
      <div>
        <label className="block text-sm mb-1">Input 1: {g.input1.state.value}</label>
        <input
          type="range"
          min={g.input1.state.min}
          max={g.input1.state.max}
          value={g.input1.state.value}
          onChange={(e) => g.input1.send({ set: Number(e.target.value) })}
          className="w-full"
        />
      </div>
      <div>
        <label className="block text-sm mb-1">Input 2: {g.input2.state.value}</label>
        <input
          type="range"
          min={g.input2.state.min}
          max={g.input2.state.max}
          value={g.input2.state.value}
          onChange={(e) => g.input2.send({ set: Number(e.target.value) })}
          className="w-full"
        />
      </div>
      <div>
        <label className="block text-sm mb-1">Input 3: {g.input3.state.value}</label>
        <input
          type="range"
          min={g.input3.state.min}
          max={g.input3.state.max}
          value={g.input3.state.value}
          onChange={(e) => g.input3.send({ set: Number(e.target.value) })}
          className="w-full"
        />
      </div>
      <div className="p-4 bg-blue-50 rounded">
        <strong>Sum: {g.sum.state.result}</strong>
      </div>
    </div>
  );
}

const counter = withTaps(maxCell(0));

// Pattern 3: Shared Gadget
function SharedCounterDemo() {
  return (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="border rounded p-4">
          <h4 className="text-sm font-medium mb-2">View A</h4>
          <GadgetDisplay
            gadget={counter}
            formatter={(state) => <div className="text-2xl font-bold text-center">{state}</div>}
          />
        </div>
        <div className="border rounded p-4">
          <h4 className="text-sm font-medium mb-2">View B</h4>
          <GadgetDisplay
            gadget={counter}
            formatter={(state) => <div className="text-2xl font-bold text-center text-blue-600">{state}</div>}
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => counter.receive(counter.current() + 1)}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Increment
        </button>
        <button
          onClick={() => counter.receive(counter.current() + 10)}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
        >
          +10
        </button>
        <button
          onClick={() => counter.receive(0)}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
        >
          Reset
        </button>
      </div>
      <div className="text-sm text-gray-600">
        Both views share the same gadget - no lifecycle management needed.
      </div>
    </div>
  );
}

// Pattern 4: Complex Multi-Directional (simplified with relations)
function ComplexEcosystemDemo() {
  const gadgets = useGadgetMap({
    controller: withTaps(sliderGadget(50, 0, 100, 5)),
    accumulator: withTaps(unionCell<number>(new Set([50]))),
    max: withTaps(maxCell(50)),
    count: withTaps(lastCell(1))
  });

  // Clean wiring with useRelations
  useRelations([
    // Controller updates accumulator with single-value sets
    () => transform(
      gadgets.controller.gadget,
      'changed',
      (state) => new Set([state]),
      gadgets.accumulator.gadget
    ),
    // Controller updates max
    () => transform(
      gadgets.controller.gadget,
      'changed',
      (state) => state,
      gadgets.max.gadget
    ),
    // Controller increments count
    () => transform(
      gadgets.controller.gadget,
      'changed',
      (_change) => gadgets.count.state + 1,
      gadgets.count.gadget
    ),
    // Accumulator affects max
    () => transform(
      gadgets.accumulator.gadget,
      'changed',
      (set) => set.size > 0 ? Math.max(...Array.from(set)) : 0,
      gadgets.max.gadget
    )
  ]);

  return <ComplexDisplay gadgets={gadgets} />;
}

function ComplexDisplay({ gadgets }: {
  gadgets: {
    controller: Gadget<SliderSpec> & Tappable<SliderSpec>;
    accumulator: Gadget<SetCell<number>> & Tappable<SetCell<number>>;
    max: Gadget<CellSpec<number>> & Tappable<CellSpec<number>>;
    count: Gadget<CellSpec<number>> & Tappable<CellSpec<number>>;
  }
}) {
  const g = useGadgetMap(gadgets);

  return (
    <div className="p-4 space-y-4">
      <div>
        <label className="block text-sm mb-2">Controller: {g.controller.state.value}</label>
        <input
          type="range"
          min={g.controller.state.min}
          max={g.controller.state.max}
          step={g.controller.state.step}
          value={g.controller.state.value}
          onChange={(e) => g.controller.send({ set: Number(e.target.value) })}
          className="w-full"
        />
      </div>
      <div className="p-4 space-y-2 bg-gray-50 rounded">
        <div className="text-sm">
          <strong>Values seen:</strong>{' '}
          {g.accumulator.state.size > 0 ? Array.from(g.accumulator.state).join(', ') : 'none'}
        </div>
        <div className="text-sm">
          <strong>Max value:</strong> {g.max.state}
        </div>
        <div className="text-sm">
          <strong>Update count:</strong> {g.count.state}
        </div>
      </div>
    </div>
  );
}

// Pattern 5: Declarative Wiring with Wire Component
function DeclarativeWiringDemo() {
  const [gadgets] = useState(() => ({
    source: withTaps(sliderGadget(25, 0, 100, 1)),
    doubled: withTaps(lastCell(50)),
    squared: withTaps(lastCell(625)),
    display: withTaps(lastCell(0))
  }));

  const g = useGadgetMap(gadgets);

  return (
    <div className="p-4 space-y-4">
      {/* Declarative wiring using Wire components */}
      <Wire
        from={gadgets.source}
        field="changed"
        transform={(state) => (typeof state === 'object' && 'value' in state ? state.value : state) * 2}
        to={gadgets.doubled}
      />
      <Wire
        from={gadgets.source}
        field="changed"
        transform={(state) => {
          const val = typeof state === 'object' && 'value' in state ? state.value : state;
          return val * val;
        }}
        to={gadgets.squared}
      />
      <Wire
        from={gadgets.doubled}
        to={gadgets.display}
      />

      <div>
        <label className="block text-sm mb-1">Source Value: {g.source.state.value}</label>
        <input
          type="range"
          min={g.source.state.min}
          max={g.source.state.max}
          value={g.source.state.value}
          onChange={(e) => g.source.send({ set: Number(e.target.value) })}
          className="w-full"
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="p-3 bg-gray-50 rounded text-center">
          <div className="text-sm text-gray-600">Doubled</div>
          <div className="text-2xl font-bold">{g.doubled.state}</div>
        </div>
        <div className="p-3 bg-gray-50 rounded text-center">
          <div className="text-sm text-gray-600">Squared</div>
          <div className="text-2xl font-bold">{g.squared.state}</div>
        </div>
        <div className="p-3 bg-blue-50 rounded text-center">
          <div className="text-sm text-gray-600">Display (from doubled)</div>
          <div className="text-2xl font-bold">{g.display.state}</div>
        </div>
      </div>

      <div className="text-sm text-gray-600">
        Wire components declaratively describe the data flow. Changes are automatically propagated through the wiring.
      </div>
    </div>
  );
}

function NotebookDemoInner() {
  return (
    <Notebook
      title="Gadget Pattern Gallery"
      description="Examples of different gadget composition patterns using the simplified notebook system"
    >
      <NotebookSection title="Pattern 1: Bidirectional Sync">
        <BidirectionalSyncDemo />
      </NotebookSection>

      <NotebookSection title="Pattern 2: Many-to-One Aggregation">
        <AggregatorDemo />
      </NotebookSection>

      <NotebookSection title="Pattern 3: Shared Gadget">
        <SharedCounterDemo />
      </NotebookSection>

      <NotebookSection title="Pattern 4: Complex Multi-Directional">
        <ComplexEcosystemDemo />
      </NotebookSection>

      <NotebookSection title="Pattern 5: Declarative Wiring">
        <DeclarativeWiringDemo />
      </NotebookSection>

      <div className="mt-8 p-4 bg-blue-50 rounded">
        <h3 className="font-semibold mb-2">Key Improvements</h3>
        <ul className="list-disc ml-5 space-y-1 text-sm">
          <li><strong>useGadgetMap:</strong> Clean access to multiple gadgets with <code>g.name.state</code> and <code>g.name.send</code></li>
          <li><strong>useRelations:</strong> Automatic cleanup of gadget wiring with builder pattern support</li>
          <li><strong>Wire component:</strong> Declarative JSX syntax for gadget connections</li>
          <li><strong>Combiner builder:</strong> Type-safe wiring with autocomplete for fn gadgets</li>
          <li><strong>No widget abstractions:</strong> Just functions that create gadgets and components that display them</li>
          <li><strong>Pattern focused:</strong> Each example showcases a specific composition pattern</li>
          <li><strong>Type safe:</strong> Full TypeScript inference throughout</li>
        </ul>
      </div>
    </Notebook>
  );
}

export default function NotebookDemo() {
  return (
    <GadgetProvider>
      <NotebookDemoInner />
    </GadgetProvider>
  );
}