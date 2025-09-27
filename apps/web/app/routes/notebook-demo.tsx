import type { Route } from "./+types/notebook-demo";
import { useEffect, useState } from 'react';
import { GadgetProvider, useGadgetMap } from 'port-graphs-react';
import {
  withTaps,
  maxCell,
  unionCell,
  sliderGadget,
  lastCell,
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

// Pattern 1: Bidirectional Sync
function createBidirectionalSync() {
  const a = withTaps(maxCell(10));
  const b = withTaps(maxCell(10));

  // Wire them bidirectionally
  const c1 = a.tap(({ changed }) => {
    if (changed !== undefined) b.receive(changed);
  });
  const c2 = b.tap(({ changed }) => {
    if (changed !== undefined) a.receive(changed);
  });

  return {
    gadgets: { a, b },
    cleanup: () => { c1(); c2(); }
  };
}

function BidirectionalSyncDemo() {
  const [ecosystem, setEcosystem] = useState<{
    gadgets: {
      a: Gadget<CellSpec<number>> & Tappable<CellSpec<number>>;
      b: Gadget<CellSpec<number>> & Tappable<CellSpec<number>>;
    };
    cleanup: () => void;
  } | null>(null);

  useEffect(() => {
    const eco = createBidirectionalSync();
    setEcosystem(eco);
    return eco.cleanup;
  }, []);

  if (!ecosystem) return <div>Loading...</div>;

  return <BidirectionalDisplay gadgets={ecosystem.gadgets} />;
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

// Pattern 2: Many-to-One Aggregation
function createSumAggregator() {
  const input1 = withTaps(sliderGadget(10, 0, 100, 1));
  const input2 = withTaps(sliderGadget(20, 0, 100, 1));
  const input3 = withTaps(sliderGadget(30, 0, 100, 1));
  const sum = withTaps(lastCell(60)); // Use lastCell for the sum

  // Helper to recalculate sum
  const updateSum = () => {
    const total =
      input1.current().value +
      input2.current().value +
      input3.current().value;
    sum.receive(total);
  };

  // Wire all inputs to update the sum
  const c1 = input1.tap(() => updateSum());
  const c2 = input2.tap(() => updateSum());
  const c3 = input3.tap(() => updateSum());

  return {
    gadgets: { input1, input2, input3, sum },
    cleanup: () => { c1(); c2(); c3(); }
  };
}

function AggregatorDemo() {
  const [ecosystem, setEcosystem] = useState<{
    gadgets: {
      input1: Gadget<SliderSpec> & Tappable<SliderSpec>;
      input2: Gadget<SliderSpec> & Tappable<SliderSpec>;
      input3: Gadget<SliderSpec> & Tappable<SliderSpec>;
      sum: Gadget<CellSpec<number>> & Tappable<CellSpec<number>>;
    };
    cleanup: () => void;
  } | null>(null);

  useEffect(() => {
    const eco = createSumAggregator();
    setEcosystem(eco);
    return eco.cleanup;
  }, []);

  if (!ecosystem) return <div>Loading...</div>;

  return <AggregatorDisplay gadgets={ecosystem.gadgets} />;
}

function AggregatorDisplay({ gadgets }: {
  gadgets: {
    input1: Gadget<SliderSpec> & Tappable<SliderSpec>;
    input2: Gadget<SliderSpec> & Tappable<SliderSpec>;
    input3: Gadget<SliderSpec> & Tappable<SliderSpec>;
    sum: Gadget<CellSpec<number>> & Tappable<CellSpec<number>>;
  }
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
        <strong>Sum: {g.sum.state}</strong>
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

// Pattern 4: Complex Multi-Directional
function createComplexEcosystem() {
  const controller = withTaps(sliderGadget(50, 0, 100, 5));
  const accumulator = withTaps(unionCell<number>(new Set([50])));
  const max = withTaps(maxCell(50));
  const count = withTaps(lastCell(1));

  // Controller updates everything
  const c1 = controller.tap(({ changed }) => {
    if (changed !== undefined) {
      accumulator.receive(new Set([changed]));
      max.receive(changed);
      count.receive(count.current() + 1);
    }
  });

  // Accumulator size affects max
  const c2 = accumulator.tap(({ changed }) => {
    if (changed !== undefined && changed.size > 0) {
      const maxValue = Math.max(...Array.from(changed));
      max.receive(maxValue);
    }
  });

  return {
    gadgets: { controller, accumulator, max, count },
    cleanup: () => { c1(); c2(); }
  };
}

function ComplexEcosystemDemo() {
  const [ecosystem, setEcosystem] = useState<{
    gadgets: {
      controller: Gadget<SliderSpec> & Tappable<SliderSpec>;
      accumulator: Gadget<SetCell<number>> & Tappable<SetCell<number>>;
      max: Gadget<CellSpec<number>> & Tappable<CellSpec<number>>;
      count: Gadget<CellSpec<number>> & Tappable<CellSpec<number>>;
    };
    cleanup: () => void;
  } | null>(null);

  useEffect(() => {
    const eco = createComplexEcosystem();
    setEcosystem(eco);
    return eco.cleanup;
  }, []);

  if (!ecosystem) return <div>Loading...</div>;

  return <ComplexDisplay gadgets={ecosystem.gadgets} />;
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

      <div className="mt-8 p-4 bg-blue-50 rounded">
        <h3 className="font-semibold mb-2">Key Improvements</h3>
        <ul className="list-disc ml-5 space-y-1 text-sm">
          <li><strong>useGadgetMap:</strong> Clean access to multiple gadgets with <code>g.name.state</code> and <code>g.name.send</code></li>
          <li><strong>No widget abstractions:</strong> Just functions that create gadgets and components that display them</li>
          <li><strong>Pattern focused:</strong> Each example showcases a specific composition pattern</li>
          <li><strong>Lifecycle management:</strong> Components handle their own setup/cleanup</li>
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