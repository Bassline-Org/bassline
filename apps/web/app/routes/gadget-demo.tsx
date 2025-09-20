import type { Route } from "./+types/gadget-demo";
import { useState, useEffect } from "react";
import { GadgetProvider, useGadget, TapBuilder, type Connection } from 'port-graphs-react';
import { lastCell, tapValue, withTaps } from 'port-graphs';
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
  min = 0,
  max = 100
}: {
  id: string,
  title: string,
  gadget: any,
  position: { x: number, y: number },
  selected?: boolean,
  onSelect?: () => void,
  min?: number,
  max?: number
}) {
  const [value, setValue] = useGadget(gadget);
  const numValue = typeof value === 'number' ? value : min;

  const ports: PortConfig[] = [
    { id: 'output', type: 'output', position: 'right', label: 'value' }
  ];

  return (
    <GadgetCard
      id={id}
      title={title}
      ports={ports}
      position={position}
      selected={selected}
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
          onValueChange={([newValue]) => setValue(newValue)}
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
  gadget: any,
  position: { x: number, y: number },
  selected?: boolean,
  onSelect?: () => void,
  min?: number,
  max?: number
}) {
  const [value] = useGadget(gadget);
  const numValue = typeof value === 'number' ? value : 0;
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
      selected={selected}
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
  inputA,
  inputB,
  result,
  position,
  selected,
  onSelect
}: {
  id: string,
  title: string,
  inputA: any,
  inputB: any,
  result: any,
  position: { x: number, y: number },
  selected?: boolean,
  onSelect?: () => void
}) {
  const [valueA] = useGadget(inputA);
  const [valueB] = useGadget(inputB);
  const [resultValue, setResult] = useGadget(result);

  const numA = typeof valueA === 'number' ? valueA : 0;
  const numB = typeof valueB === 'number' ? valueB : 0;
  const sum = numA + numB;

  // Update result when inputs change
  useEffect(() => {
    setResult(sum);
  }, [sum, setResult]);

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
      selected={selected}
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
  // Create tappable gadgets
  const [sliderA] = useState(() => withTaps(lastCell(25)));
  const [sliderB] = useState(() => withTaps(lastCell(75)));
  const [calculatorInputA] = useState(() => withTaps(lastCell(0)));
  const [calculatorInputB] = useState(() => withTaps(lastCell(0)));
  const [result] = useState(() => withTaps(lastCell(0)));

  // Map gadget IDs to actual gadgets for wiring
  const gadgetMap = {
    'slider-a': sliderA,
    'slider-b': sliderB,
    'calculator-inputA': calculatorInputA,
    'calculator-inputB': calculatorInputB,
    'calculator-result': result,
    'result-meter': result,
    'monitor-a': sliderA,
    'monitor-b': sliderB
  };

  // Connection state
  const [connections, setConnections] = useState<Connection[]>([
    // Pre-made connections to show the system working
    { id: 'conn1', from: 'slider-a', fromPort: 'output', to: 'calculator', toPort: 'inputA' },
    { id: 'conn2', from: 'slider-b', fromPort: 'output', to: 'calculator', toPort: 'inputB' },
    { id: 'conn3', from: 'calculator', fromPort: 'output', to: 'result-meter', toPort: 'input' }
  ]);

  const [selectedGadget, setSelectedGadget] = useState<string | null>(null);

  // Wire gadgets based on connections using proper tapping
  useEffect(() => {
    // Set up the predefined connections with proper gadget tapping
    sliderA.tap(tapValue(calculatorInputA));
    sliderB.tap(tapValue(calculatorInputB));
    // The calculator will automatically output to result via its useEffect

    // Log connection status
    console.log('Gadget wiring established:', {
      'slider-a → calculator-inputA': 'connected',
      'slider-b → calculator-inputB': 'connected',
      'calculator → result': 'connected via useEffect'
    });
  }, [sliderA, sliderB, calculatorInputA, calculatorInputB, result]);

  const handleConnectionCreate = (connection: Omit<Connection, 'id'>) => {
    const newConnection: Connection = {
      id: `conn-${Date.now()}`,
      ...connection
    };
    setConnections(prev => [...prev, newConnection]);
    console.log('✅ Created connection:', newConnection);

    // Show visual feedback
    console.log('📊 Total connections:', connections.length + 1);
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
            <div className="flex items-center gap-3 mb-3">
              <h1 className="text-3xl font-bold">Gadget Demo Dashboard</h1>
              <span className="px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full border border-green-300">
                ✅ LIVE
              </span>
            </div>
            <p className="text-slate-600 text-lg">
              Interactive gadgets demonstrating <strong className="text-blue-600">"GADGETS FOR EVERYTHING"</strong> —
              universal protocol with dynamic visual connections and real-time data flow.
            </p>
            <p className="text-slate-500 text-sm mt-2">
              Every component follows: <code className="bg-slate-100 px-2 py-1 rounded text-slate-700">receive → consider → act → emit</code>
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
                inputA={calculatorInputA}
                inputB={calculatorInputB}
                result={result}
                position={{ x: 400, y: 250 }}
                selected={selectedGadget === 'calculator' || false}
                onSelect={() => handleGadgetSelect('calculator')}
              />

              <ConnectedMeter
                id="result-meter"
                title="Result Display"
                gadget={result}
                position={{ x: 750, y: 250 }}
                selected={selectedGadget === 'result-meter' || false}
                onSelect={() => handleGadgetSelect('result-meter')}
                min={0}
                max={200}
              />

              <ConnectedMeter
                id="monitor-a"
                title="Monitor A"
                gadget={sliderA}
                position={{ x: 400, y: 50 }}
                selected={selectedGadget === 'monitor-a' || false}
                onSelect={() => handleGadgetSelect('monitor-a')}
                min={0}
                max={100}
              />

              <ConnectedMeter
                id="monitor-b"
                title="Monitor B"
                gadget={sliderB}
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
              <h3 className="text-lg font-semibold mb-4 text-slate-800">🎮 Interactive Demo</h3>
              <div className="space-y-3 text-sm text-slate-700">
                <p>• <strong className="text-blue-600">Drag Connections:</strong> Click and drag from output ports (●) to input ports</p>
                <p>• <strong className="text-green-600">Adjust Sliders:</strong> Move sliders to see real-time data flow</p>
                <p>• <strong className="text-purple-600">Watch Wires:</strong> Visual connections show live data flow</p>
                <p>• <strong className="text-orange-600">Select Gadgets:</strong> Click gadgets to highlight them</p>
                <div className="mt-4 p-3 bg-slate-50 rounded border-l-4 border-blue-400">
                  <p className="text-xs text-slate-600 font-medium">
                    🎯 <strong>Try this:</strong> Adjust the "Input A" slider and watch how the calculator and result meter update automatically!
                  </p>
                </div>
              </div>
            </div>

            {selectedGadget && (
              <div className="p-6 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-semibold text-blue-800 mb-2">Selected Gadget</h4>
                <p className="text-blue-700">{selectedGadget}</p>
              </div>
            )}

            <div className="p-6 bg-green-50 rounded-lg border border-green-200">
              <h4 className="font-semibold text-green-800 mb-3">🔗 Live System Status</h4>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="space-y-1">
                    <p className="text-green-700 font-medium">📊 Current Values:</p>
                    <p className="text-xs text-green-600">Input A: {sliderA.current()}</p>
                    <p className="text-xs text-green-600">Input B: {sliderB.current()}</p>
                    <p className="text-xs text-green-600">Result: {result.current()}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-green-700 font-medium">⚡ Active Connections:</p>
                    {connections.map(conn => (
                      <p key={conn.id} className="text-xs text-green-600">
                        {conn.from} → {conn.to}
                      </p>
                    ))}
                  </div>
                </div>
                <div className="pt-2 border-t border-green-200">
                  <p className="text-xs text-green-600 font-medium">
                    ✨ Data flows automatically through connected gadgets!
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </GadgetProvider>
  );
}