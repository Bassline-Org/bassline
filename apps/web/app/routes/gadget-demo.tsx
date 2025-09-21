import type { Route } from "./+types/gadget-demo";
import { useState, useEffect } from "react";
import { GadgetProvider, useGadget, TapBuilder, type Connection } from 'port-graphs-react';
import { lastCell, tapValue, tapTo, tapDebug, withTaps } from 'port-graphs';
import { adder } from 'port-graphs/functions';
import { sliderGadget, meterGadget } from 'port-graphs/ui';
import { Slider } from '~/components/ui/slider';
import { Progress } from '~/components/ui/progress';
import { Badge } from '~/components/ui/badge';
import { GadgetCard, type PortConfig } from '~/components/GadgetCard';

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "Gadget Demo - Bassline" },
    { name: "description", content: "Interactive gadget dashboard" },
  ];
}

// Connection-enabled Gadget Components
function ConnectedSlider({
  id,
  title,
  gadget,
  position,
  selected,
  onSelect,
  onChange,
  min = 0,
  max = 100,
  initial = 50
}: {
  id: string,
  title: string,
  gadget?: any,
  position: { x: number, y: number },
  selected?: boolean,
  onSelect?: () => void,
  onChange?: (value: number) => void,
  min?: number,
  max?: number,
  initial?: number
}) {
  // Use provided gadget or create default
  const [state, send, g] = useGadget(
    gadget || withTaps(sliderGadget(initial, min, max, 1))
  );

  // Optional onChange creates tap
  useEffect(() => {
    if (onChange && g) {
      return g.tap((effect: any) => {
        if (effect?.changed !== undefined) {
          onChange(effect.changed);
        }
      });
    }
    return undefined;
  }, [onChange, g]);

  const numValue = (state && typeof state === 'object' && 'value' in state && typeof (state as any).value === 'number') ? (state as any).value : min;

  const ports: PortConfig[] = [
    { id: 'output', type: 'output', position: 'right', label: 'value' }
  ];

  return (
    <GadgetCard
      id={id}
      title={title}
      ports={ports}
      position={position}
      selected={selected ?? false}
      onSelect={onSelect}
      className="w-64"
    >
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Value:</span>
          <Badge variant="outline" className="font-mono">
            {numValue.toFixed(1)}
          </Badge>
        </div>
        <Slider
          value={[numValue]}
          onValueChange={([newValue]) => send({ type: 'set', value: newValue })}
          min={min}
          max={max}
          step={1}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{min}</span>
          <span>{max}</span>
        </div>
      </div>
    </GadgetCard>
  );
}

function ConnectedMeter({
  id,
  title,
  gadget,
  position,
  selected,
  onSelect,
  min = 0,
  max = 100
}: {
  id: string,
  title: string,
  gadget?: any,
  position: { x: number, y: number },
  selected?: boolean,
  onSelect?: () => void,
  min?: number,
  max?: number
}) {
  // Use provided gadget or create default
  const [state] = useGadget(
    gadget || withTaps(meterGadget(min, max))
  );
  const numValue = (state && typeof state === 'object' && 'value' in state && typeof (state as any).value === 'number') ? (state as any).value : 0;
  const percentage = Math.max(0, Math.min(100, ((numValue - min) / (max - min)) * 100));

  const ports: PortConfig[] = [
    { id: 'input', type: 'input', position: 'left', label: 'value' }
  ];

  return (
    <GadgetCard
      id={id}
      title={title}
      ports={ports}
      position={position}
      selected={selected ?? false}
      onSelect={onSelect}
      className="w-64"
    >
      <div className="space-y-4">
        <div className="text-center">
          <div className="text-2xl font-bold font-mono">
            {numValue.toFixed(1)}
          </div>
          <div className="text-xs text-muted-foreground">
            {min} - {max}
          </div>
        </div>
        <Progress value={percentage} className="w-full" />
        <div className="flex justify-center">
          <Badge variant={percentage > 75 ? "destructive" : percentage > 50 ? "secondary" : "default"}>
            {percentage.toFixed(0)}%
          </Badge>
        </div>
      </div>
    </GadgetCard>
  );
}

function ConnectedCalculator({
  id,
  title,
  gadget,
  position,
  selected,
  onSelect,
  onResult
}: {
  id: string,
  title: string,
  gadget?: any,
  position: { x: number, y: number },
  selected?: boolean,
  onSelect?: () => void,
  onResult?: (result: number) => void
}) {
  // Use provided gadget or create default
  const [state, send, calc] = useGadget(
    gadget || withTaps(adder({}))
  );

  // Optional onResult creates tap
  useEffect(() => {
    if (onResult && calc) {
      return calc.tap((effect: any) => {
        if (effect?.changed?.result !== undefined) {
          onResult(effect.changed.result);
        }
      });
    }
    return undefined;
  }, [onResult, calc]);
  const numA = (state && typeof state === 'object' && 'a' in state && typeof (state as any).a === 'number') ? (state as any).a : 0;
  const numB = (state && typeof state === 'object' && 'b' in state && typeof (state as any).b === 'number') ? (state as any).b : 0;
  const sum = (state && typeof state === 'object' && 'result' in state && typeof (state as any).result === 'number') ? (state as any).result : 0;

  const ports: PortConfig[] = [
    { id: 'inputA', type: 'input', position: 'left', label: 'A' },
    { id: 'inputB', type: 'input', position: 'top', label: 'B' },
    { id: 'output', type: 'output', position: 'right', label: 'result' }
  ];

  return (
    <GadgetCard
      id={id}
      title={title}
      ports={ports}
      position={position}
      selected={selected ?? false}
      onSelect={onSelect}
      className="w-64"
    >
      <div className="space-y-4">
        <div className="text-center space-y-2">
          <div className="flex justify-center items-center space-x-2 font-mono">
            <span>{numA.toFixed(1)}</span>
            <span>+</span>
            <span>{numB.toFixed(1)}</span>
          </div>
          <div className="text-xl font-bold font-mono border-t pt-2">
            = {sum.toFixed(1)}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div>Input A: {numA.toFixed(1)}</div>
          <div>Input B: {numB.toFixed(1)}</div>
        </div>
      </div>
    </GadgetCard>
  );
}

export default function GadgetDemo() {
  // Create REAL protocol gadgets
  const [sliderA] = useState(() => withTaps(sliderGadget(25, 0, 100, 1)));
  const [sliderB] = useState(() => withTaps(sliderGadget(75, 0, 100, 1)));

  // Adder is a proper function gadget that needs both inputs
  const [calculator] = useState(() => withTaps(adder({})));

  // Meters to display values
  const [resultMeter] = useState(() => withTaps(meterGadget(0, 200)));
  const [monitorA] = useState(() => withTaps(meterGadget(0, 100)));
  const [monitorB] = useState(() => withTaps(meterGadget(0, 100)));

  // Map gadget IDs to actual gadgets for wiring
  const gadgetMap: Record<string, any> = {
    'slider-a': sliderA,
    'slider-b': sliderB,
    'calculator': calculator,
    'result-meter': resultMeter,
    'monitor-a': monitorA,
    'monitor-b': monitorB
  };

  // Connection state
  const [connections, setConnections] = useState<Connection[]>([
    // Pre-made connections to show the system working
    { id: 'conn1', from: 'slider-a', fromPort: 'output', to: 'calculator', toPort: 'inputA' },
    { id: 'conn2', from: 'slider-b', fromPort: 'output', to: 'calculator', toPort: 'inputB' },
    { id: 'conn3', from: 'calculator', fromPort: 'output', to: 'result-meter', toPort: 'input' },
    // Monitor connections
    { id: 'conn4', from: 'slider-a', fromPort: 'output', to: 'monitor-a', toPort: 'input' },
    { id: 'conn5', from: 'slider-b', fromPort: 'output', to: 'monitor-b', toPort: 'input' }
  ]);

  const [selectedGadget, setSelectedGadget] = useState<string | null>(null);

  // Wire gadgets based on visual connections using proper tap utilities
  useEffect(() => {
    const cleanups: (() => void)[] = [];

    // Add debug logging (only once)
    cleanups.push(sliderA.tap(tapDebug('SliderA')));
    cleanups.push(sliderB.tap(tapDebug('SliderB')));
    cleanups.push(calculator.tap(tapDebug('Calculator')));

    // Create taps for each connection using proper utilities
    connections.forEach(conn => {
      if (conn.from === 'slider-a' && conn.to === 'calculator' && conn.toPort === 'inputA') {
        // Use tapTo to send slider value to calculator's 'a' input
        cleanups.push(sliderA.tap(tapTo(calculator, 'a')));
      }

      if (conn.from === 'slider-b' && conn.to === 'calculator' && conn.toPort === 'inputB') {
        // Use tapTo to send slider value to calculator's 'b' input
        cleanups.push(sliderB.tap(tapTo(calculator, 'b')));
      }

      if (conn.from === 'calculator' && conn.to === 'result-meter') {
        // Calculator emits {changed: {result: X, args: {...}}}
        // We need to extract the result value
        cleanups.push(calculator.tap((effect) => {
          if (effect?.changed?.result !== undefined) {
            resultMeter.receive(effect.changed.result);
          }
        }));
      }

      // Direct monitor connections using tapValue
      if (conn.from === 'slider-a' && conn.to === 'monitor-a') {
        cleanups.push(sliderA.tap(tapValue(monitorA)));
      }

      if (conn.from === 'slider-b' && conn.to === 'monitor-b') {
        cleanups.push(sliderB.tap(tapValue(monitorB)));
      }
    });

    // Cleanup function
    return () => {
      cleanups.forEach(cleanup => cleanup());
    };
  }, [connections]); // Re-wire when connections change

  const handleConnectionCreate = (connection: Omit<Connection, 'id'>) => {
    const newConnection: Connection = {
      id: `conn-${Date.now()}`,
      ...connection
    };
    setConnections(prev => [...prev, newConnection]);
  };

  const handleConnectionDelete = (connectionId: string) => {
    setConnections(prev => prev.filter(c => c.id !== connectionId));
  };

  const handleGadgetSelect = (gadgetId: string) => {
    setSelectedGadget(gadgetId);
  };

  return (
    <GadgetProvider>
      <div className="min-h-screen bg-slate-50">
        <div className="container mx-auto py-8 px-4">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-3">Gadget Demo</h1>
            <p className="text-slate-600">
              Universal gadget protocol demonstration. Every component follows: <code className="bg-slate-100 px-2 py-1 rounded text-slate-700">receive → consider → act → emit</code>
            </p>
          </div>

          <div className="relative w-full h-[700px] bg-white rounded-lg border border-slate-200 overflow-hidden">
            <TapBuilder
              connections={connections}
              onConnectionCreate={handleConnectionCreate}
              onConnectionDelete={handleConnectionDelete}
              className="w-full h-full"
            >

              {/* Positioned Gadgets */}
              <ConnectedSlider
                id="slider-a"
                title="Input A"
                gadget={sliderA}
                position={{ x: 50, y: 150 }}
                selected={selectedGadget === 'slider-a' || false}
                onSelect={() => handleGadgetSelect('slider-a')}
                min={0}
                max={100}
              />

              <ConnectedSlider
                id="slider-b"
                title="Input B"
                gadget={sliderB}
                position={{ x: 50, y: 350 }}
                selected={selectedGadget === 'slider-b' || false}
                onSelect={() => handleGadgetSelect('slider-b')}
                min={0}
                max={100}
              />

              <ConnectedCalculator
                id="calculator"
                title="A + B Calculator"
                gadget={calculator}
                position={{ x: 400, y: 250 }}
                selected={selectedGadget === 'calculator' || false}
                onSelect={() => handleGadgetSelect('calculator')}
              />

              <ConnectedMeter
                id="result-meter"
                title="Result Display"
                gadget={resultMeter}
                position={{ x: 750, y: 250 }}
                selected={selectedGadget === 'result-meter' || false}
                onSelect={() => handleGadgetSelect('result-meter')}
                min={0}
                max={200}
              />

              <ConnectedMeter
                id="monitor-a"
                title="Monitor A"
                gadget={monitorA}
                position={{ x: 400, y: 50 }}
                selected={selectedGadget === 'monitor-a' || false}
                onSelect={() => handleGadgetSelect('monitor-a')}
                min={0}
                max={100}
              />

              <ConnectedMeter
                id="monitor-b"
                title="Monitor B"
                gadget={monitorB}
                position={{ x: 400, y: 450 }}
                selected={selectedGadget === 'monitor-b' || false}
                onSelect={() => handleGadgetSelect('monitor-b')}
                min={0}
                max={100}
              />
            </TapBuilder>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 bg-white rounded-lg border border-slate-200">
              <h3 className="text-lg font-semibold mb-4 text-slate-800">Instructions</h3>
              <div className="space-y-2 text-sm text-slate-600">
                <p>• Drag from output ports to input ports to create connections</p>
                <p>• Adjust sliders to see data flow through the network</p>
                <p>• Click gadgets to select them</p>
              </div>
            </div>

            <div className="p-6 bg-slate-50 rounded-lg border border-slate-200">
              <h4 className="font-semibold text-slate-800 mb-3">System State</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <p className="text-slate-700 font-medium">Current Values:</p>
                  <p className="text-xs text-slate-600">Input A: {(sliderA.current() as any)?.value ?? 0}</p>
                  <p className="text-xs text-slate-600">Input B: {(sliderB.current() as any)?.value ?? 0}</p>
                  <p className="text-xs text-slate-600">Result: {(calculator.current() as any)?.result ?? 0}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-slate-700 font-medium">Connections:</p>
                  {connections.slice(0, 5).map(conn => (
                    <p key={conn.id} className="text-xs text-slate-600">
                      {conn.from} → {conn.to}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </GadgetProvider>
  );
}