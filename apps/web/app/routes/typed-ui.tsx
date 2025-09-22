import type { Route } from "./+types/typed-ui";
import {
  GadgetProvider,
  Slider,
  Meter,
  Toggle,
  useGadget,
  useGadgetEffect
} from 'port-graphs-react';
import {
  sliderGadget,
  meterGadget,
  toggleGadget,
  withTaps,
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
const slider3 = sliderGadget(75, 0, 200, 1);
const meter1 = meterGadget(0, 100);
const meter2 = meterGadget(0, 200);
const toggle1 = toggleGadget(false);

// Create the adder gadget with initial values
const calc = withTaps(adder({ a: slider1.current().value, b: slider2.current().value }));

function TypedUIDemoInner() {

  const [calcState] = useGadget(calc);

  useGadgetEffect(slider1, ({ changed }) => {
    if (changed) {
      meter1.receive({ display: changed });
      calc.receive({ a: changed });
    }
  }, [meter1, calc]);

  useGadgetEffect(slider2, ({ changed }) => {
    if (changed) {
      calc.receive({ b: changed });
    }
  }, [calc]);

  useGadgetEffect(calc, ({ changed }) => {
    if (changed && 'result' in changed) {
      meter2.receive({ display: changed.result });
      slider3.receive({ set: changed.result });
    }
  }, [meter2]);

  return (
    <div className="min-h-screen bg-white p-8">
      <h1 className="text-2xl font-bold mb-4">Typed UI Components</h1>
      <p className="text-gray-600 mb-8">
        Using the actual typed components from port-graphs-react.
      </p>

      <div className="grid grid-cols-2 gap-8 max-w-4xl">
        <div>
          <h3 className="font-semibold mb-2">Slider 1</h3>
          <Slider gadget={slider1} />
          <Slider gadget={slider3} showValue showLabels />
        </div>

        <div>
          <h3 className="font-semibold mb-2">Meter 1 (connected to Slider 1)</h3>
          <Meter gadget={meter1} showPercentage />
          <Meter gadget={meter1} variant="circle" />
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
              {calcState?.a} + {calcState?.b} = {calcState?.result}
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