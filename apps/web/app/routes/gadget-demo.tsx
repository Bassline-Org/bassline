import type { Route } from "./+types/gadget-demo";
import { useState, useEffect } from "react";
import { GadgetProvider, useGadget } from 'port-graphs-react';
import { lastCell } from 'port-graphs';
import { Slider } from '~/components/ui/slider';
import { Progress } from '~/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "Gadget Demo - Bassline" },
    { name: "description", content: "Interactive gadget dashboard" },
  ];
}

// Simple Gadget Components
function SimpleSlider({ title, gadget, min = 0, max = 100 }: { title: string, gadget: any, min?: number, max?: number }) {
  const [value, setValue] = useGadget(gadget);
  const numValue = typeof value === 'number' ? value : min;

  return (
    <Card className="w-64">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
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
      </CardContent>
    </Card>
  );
}

function SimpleMeter({ title, gadget, min = 0, max = 100 }: { title: string, gadget: any, min?: number, max?: number }) {
  const [value] = useGadget(gadget);
  const numValue = typeof value === 'number' ? value : 0;
  const percentage = Math.max(0, Math.min(100, ((numValue - min) / (max - min)) * 100));

  return (
    <Card className="w-64">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
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
      </CardContent>
    </Card>
  );
}

function SimpleCalculator({ title, gadgetA, gadgetB, result }: { title: string, gadgetA: any, gadgetB: any, result: any }) {
  const [valueA] = useGadget(gadgetA);
  const [valueB] = useGadget(gadgetB);
  const [resultValue, setResult] = useGadget(result);

  const numA = typeof valueA === 'number' ? valueA : 0;
  const numB = typeof valueB === 'number' ? valueB : 0;
  const sum = numA + numB;

  // Update result when inputs change
  useEffect(() => {
    setResult(sum);
  }, [sum, setResult]);

  return (
    <Card className="w-64">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
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
      </CardContent>
    </Card>
  );
}

export default function GadgetDemo() {
  // Create simple gadgets
  const [sliderA] = useState(() => lastCell(25));
  const [sliderB] = useState(() => lastCell(75));
  const [result] = useState(() => lastCell(0));

  return (
    <GadgetProvider>
      <div className="min-h-screen bg-slate-50">
        <div className="container mx-auto py-8 px-4">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Gadget Demo Dashboard</h1>
            <p className="text-slate-600">
              Simple interactive gadgets demonstrating the "GADGETS FOR EVERYTHING" philosophy.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <SimpleSlider
              title="Input A"
              gadget={sliderA}
              min={0}
              max={100}
            />

            <SimpleSlider
              title="Input B"
              gadget={sliderB}
              min={0}
              max={100}
            />

            <SimpleCalculator
              title="A + B Calculator"
              gadgetA={sliderA}
              gadgetB={sliderB}
              result={result}
            />

            <SimpleMeter
              title="Result Meter"
              gadget={result}
              min={0}
              max={200}
            />

            <SimpleMeter
              title="Input A Monitor"
              gadget={sliderA}
              min={0}
              max={100}
            />

            <SimpleMeter
              title="Input B Monitor"
              gadget={sliderB}
              min={0}
              max={100}
            />
          </div>

          <div className="mt-8 p-6 bg-white rounded-lg border">
            <h3 className="text-lg font-semibold mb-4">How It Works</h3>
            <div className="grid gap-3 text-sm text-slate-700">
              <p>• <strong>Input A & B:</strong> Interactive sliders that create gadget values</p>
              <p>• <strong>Calculator:</strong> Automatically adds the two input values together</p>
              <p>• <strong>Meters:</strong> Visual displays that show gadget values with progress bars</p>
              <p>• <strong>Live Updates:</strong> All gadgets update in real-time as you change inputs</p>
              <p>• <strong>Gadget Protocol:</strong> Each component follows receive → consider → act → emit</p>
            </div>
          </div>
        </div>
      </div>
    </GadgetProvider>
  );
}