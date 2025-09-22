import type { Route } from "./+types/typed-ui";
import { useEffect } from "react";
import {
  GadgetProvider,
  Slider,
  Meter,
  Toggle,
  useGadget
} from 'port-graphs-react';
import {
  sliderGadget,
  meterGadget,
  toggleGadget,
  withTaps
} from 'port-graphs';
import { adder } from 'port-graphs/functions';

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "Typed UI Demo" },
    { name: "description", content: "Type-safe gadget components" },
  ];
}

// Create gadgets outside the component
const slider1 = sliderGadget(50, 0, 100, 1);
const slider2 = sliderGadget(25, 0, 100, 1);
const meter1 = meterGadget(0, 100);
const meter2 = meterGadget(0, 200);
const toggle1 = toggleGadget(false);
// Create the adder gadget with initial values
const calcBase = adder({ a: 0, b: 0 });
const calc = withTaps(calcBase);

function TypedUIDemoInner() {

  // Get state from calc to display - type inference issue with function gadgets
  // The state includes both the arguments (a, b) and the result
  type CalcState = { a: number; b: number; result?: number };
  const [calcState] = useGadget(calc) as readonly [CalcState, any, any];
  const a = calcState?.a ?? 0;
  const b = calcState?.b ?? 0;
  const result = calcState?.result ?? 0;

  // Wire them together
  useEffect(() => {
    const cleanups: (() => void)[] = [];

    // Connect slider1 to meter1
    cleanups.push(slider1.tap((effect) => {
      if ('changed' in effect) {
        meter1.receive({ display: effect["changed"] });
      }
    }));

    // Connect sliders to calculator
    cleanups.push(slider1.tap((effect) => {
      if ('changed' in effect) {
        calc.receive({ a: effect["changed"] });
      }
    }));

    cleanups.push(slider2.tap((effect) => {
      if ('changed' in effect) {
        calc.receive({ b: effect["changed"] });
      }
    }));

    // Connect calculator to meter2
    cleanups.push(calc.tap((effect: any) => {
      if (effect?.changed?.result !== undefined) {
        meter2.receive({ display: effect.changed.result });
      }
    }));

    return () => cleanups.forEach(cleanup => cleanup());
  }, [slider1, slider2, meter1, meter2, toggle1, calc]);

  return (
    <div className="min-h-screen bg-white p-8">
      <h1 className="text-2xl font-bold mb-4">Typed UI Components</h1>
      <p className="text-gray-600 mb-8">
        Using the actual typed components from port-graphs-react.
      </p>

      <div className="grid grid-cols-2 gap-8 max-w-4xl">
        <div>
          <h3 className="font-semibold mb-2">Slider 1</h3>
          <Slider gadget={slider1} showValue showLabels />
        </div>

        <div>
          <h3 className="font-semibold mb-2">Meter 1 (connected to Slider 1)</h3>
          <Meter gadget={meter1} showPercentage />
        </div>

        <div>
          <h3 className="font-semibold mb-2">Slider 2</h3>
          <Slider gadget={slider2} showValue showLabels />
        </div>

        <div>
          <h3 className="font-semibold mb-2">Sum Meter (Slider 1 + Slider 2)</h3>
          <Meter gadget={meter2} showPercentage />
        </div>

        <div>
          <h3 className="font-semibold mb-2">Toggle</h3>
          <Toggle gadget={toggle1} />
        </div>

        <div>
          <h3 className="font-semibold mb-2">Calculator</h3>
          <div className="p-4 border rounded">
            <div className="font-mono">
              {a.toFixed(1)} + {b.toFixed(1)} = {result.toFixed(1)}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 p-4 bg-gray-50 rounded max-w-4xl">
        <h3 className="font-bold mb-2">What's happening here:</h3>
        <ul className="list-disc ml-6 space-y-1">
          <li>Slider, Meter, Toggle components get full type inference from TypedGadget</li>
          <li>No props for min/max/step - components read from gadget state</li>
          <li>send() commands are typed - {`send({ set: value })`} not {`send({ type: 'set', value })`}</li>
          <li>Effects are typed when using tap()</li>
        </ul>
      </div>
    </div>
  );
}

export default function TypedUIDemo() {
  return (
    <GadgetProvider>
      <TypedUIDemoInner />
    </GadgetProvider>
  );
}