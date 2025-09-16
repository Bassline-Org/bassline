/**
 * Gadget Demo - Interactive demonstration of port-graphs with React
 *
 * This demo shows how gadgets can be used to create moldable tools where:
 * - UI interactions update gadget state
 * - Gadget state drives UI rendering
 * - Multiple components can share gadget state
 * - Gadgets can modify other gadgets
 */

import { useEffect } from 'react';
import { useGadget, PubSubProvider, useRegistry } from 'port-graphs-react';
import { maxCell, minCell, lastCell, lastMap } from 'port-graphs/cells';
import { adder, multiplier } from 'port-graphs/functions';
import { createGadget } from 'port-graphs';
import { Button } from '~/components/ui/button';
import { Slider } from '~/components/ui/slider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Badge } from '~/components/ui/badge';

export function meta() {
  return [
    { title: "Gadget Demo - Port Graphs React" },
    { name: "description", content: "Interactive demonstration of gadgets with React" },
  ];
}

// ============================================================================
// Component 1: Slider feeding into MaxCell
// ============================================================================
function MaxCellSlider() {
  const [maxValue, sendMax] = useGadget(
    maxCell,
    50
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>MaxCell Slider</CardTitle>
        <CardDescription>
          The maxCell only updates to higher values. Try moving the slider back!
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Input Value</Label>
          <Slider
            value={[maxValue]}
            onValueChange={([value]) => value && sendMax(value)}
            max={100}
            step={1}
            className="mt-2"
          />
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Current Max:</span>
          <Badge variant="secondary" className="text-lg px-3 py-1">
            {maxValue}
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => sendMax(25)}>
            Try 25
          </Button>
          <Button size="sm" variant="outline" onClick={() => sendMax(75)}>
            Try 75
          </Button>
          <Button size="sm" variant="outline" onClick={() => sendMax(100)}>
            Max out!
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Component 2: Adder with two inputs
// ============================================================================
function AdderComponent() {
  const [adderState, send] = useGadget(
    () => adder({ a: 0, b: 0 }),
    { a: 0, b: 0 }
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Function Gadget: Adder</CardTitle>
        <CardDescription>
          A function gadget that computes when both inputs are provided
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="input-a">Input A</Label>
            <Input
              id="input-a"
              type="number"
              value={adderState.a}
              onChange={(e) => send({ a: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label htmlFor="input-b">Input B</Label>
            <Input
              id="input-b"
              type="number"
              value={adderState.b}
              onChange={(e) => send({ b: Number(e.target.value) })}
            />
          </div>
        </div>

        <div className="text-center p-4 bg-muted rounded-lg">
          <div className="text-sm text-muted-foreground mb-1">Result</div>
          <div className="text-3xl font-bold">
            {adderState.result !== undefined ? adderState.result : '?'}
          </div>
          <div className="text-xs text-muted-foreground mt-2">
            {adderState.a} + {adderState.b} = {adderState.result ?? '?'}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Component 3: Chained Functions (a + b) * c
// ============================================================================
function ChainedFunctions() {
  // Create an adder gadget
  const [adderState, sendToAdder] = useGadget(
    () => adder({ a: 0, b: 0 }),
    { a: 0, b: 0 }
  );

  // Create a multiplier gadget that gets input from adder
  const [multiplierState, sendToMultiplier] = useGadget(
    () => multiplier({ a: 0, b: 1 }),
    { a: 0, b: 1 }
  );

  // Simple direct connection - when adder produces result, send to multiplier
  useEffect(() => {
    if (adderState.result !== undefined) {
      sendToMultiplier({ a: adderState.result });
    }
  }, [adderState.result, sendToMultiplier]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Chained Functions: (a + b) × c</CardTitle>
        <CardDescription>
          Two function gadgets wired together - the adder's output feeds into the multiplier
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="chain-a">a</Label>
            <Input
              id="chain-a"
              type="number"
              value={adderState.a}
              onChange={(e) => sendToAdder({ a: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label htmlFor="chain-b">b</Label>
            <Input
              id="chain-b"
              type="number"
              value={adderState.b}
              onChange={(e) => sendToAdder({ b: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label htmlFor="chain-c">c</Label>
            <Input
              id="chain-c"
              type="number"
              value={multiplierState.b}
              onChange={(e) => sendToMultiplier({ b: Number(e.target.value) })}
            />
          </div>
        </div>

        <div className="flex justify-around items-center p-4 bg-muted rounded-lg">
          <div className="text-center">
            <div className="text-xs text-muted-foreground">a + b</div>
            <div className="text-xl font-semibold">
              {adderState.result ?? '?'}
            </div>
          </div>
          <div className="text-2xl">→</div>
          <div className="text-center">
            <div className="text-xs text-muted-foreground">(a + b) × c</div>
            <div className="text-2xl font-bold text-primary">
              {multiplierState.result ?? '?'}
            </div>
          </div>
        </div>

        <div className="text-xs text-muted-foreground text-center">
          ({adderState.a} + {adderState.b}) × {multiplierState.b} = {multiplierState.result ?? '?'}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Component 4: MinMax Range Tracker
// ============================================================================
function MinMaxTracker() {
  // Simple current value cell - just stores latest value
  const [current, sendCurrent] = useGadget(
    () => createGadget<number, number>(
      (_current, incoming) => ({ action: 'update', context: { value: incoming } }),
      { 'update': (gadget, { value }) => { gadget.update(value); return { changed: value }; } }
    )(50),
    50
  );

  const [minValue, sendMin] = useGadget(() => minCell(50), 50);
  const [maxValue, sendMax] = useGadget(() => maxCell(50), 50);

  const handleValueChange = (value: number) => {
    sendCurrent(value);
    sendMin(value);
    sendMax(value);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Min/Max Range Tracker</CardTitle>
        <CardDescription>
          Two cells tracking the minimum and maximum values seen
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Input Value: {current}</Label>
          <Slider
            value={[current ?? 50]}
            onValueChange={([value]) => handleValueChange(value ?? 50)}
            max={100}
            step={1}
            className="mt-2"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-4 border rounded-lg">
            <div className="text-sm text-muted-foreground mb-1">Minimum Seen</div>
            <div className="text-2xl font-bold text-blue-600">{minValue}</div>
          </div>
          <div className="text-center p-4 border rounded-lg">
            <div className="text-sm text-muted-foreground mb-1">Maximum Seen</div>
            <div className="text-2xl font-bold text-orange-600">{maxValue}</div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => handleValueChange(0)}>
            Try 0
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleValueChange(25)}>
            Try 25
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleValueChange(75)}>
            Try 75
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleValueChange(100)}>
            Try 100
          </Button>
        </div>

        <div className="text-center p-2 bg-muted rounded">
          <span className="text-sm">Range: [{minValue} - {maxValue}]</span>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Component 5: Form Validator Gadget
// ============================================================================
function FormValidatorGadget() {
  // Create a validation gadget
  const [formState, sendForm] = useGadget(
    () => createGadget<any, any>(
      (current, updates) => {
        const merged = { ...current, ...updates };
        const errors = [];

        if (!merged.email?.includes('@')) {
          errors.push('Invalid email');
        }
        if (merged.password?.length < 8) {
          errors.push('Password must be at least 8 characters');
        }
        if (merged.password !== merged.confirmPassword) {
          errors.push('Passwords do not match');
        }

        return { action: 'validate', context: { merged, errors } };
      },
      {
        validate: (gadget, { merged, errors }) => {
          gadget.update({ ...merged, errors, valid: errors.length === 0 });
          return { changed: { valid: errors.length === 0, errors } };
        }
      }
    )({ email: '', password: '', confirmPassword: '', errors: [], valid: false }),
    { email: '', password: '', confirmPassword: '', errors: [], valid: false }
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Form Validator Gadget</CardTitle>
        <CardDescription>
          A gadget that validates form input in real-time
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={formState.email || ''}
            onChange={(e) => sendForm({ email: e.target.value })}
            placeholder="user@example.com"
          />
        </div>

        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={formState.password || ''}
            onChange={(e) => sendForm({ password: e.target.value })}
            placeholder="At least 8 characters"
          />
        </div>

        <div>
          <Label htmlFor="confirm">Confirm Password</Label>
          <Input
            id="confirm"
            type="password"
            value={formState.confirmPassword || ''}
            onChange={(e) => sendForm({ confirmPassword: e.target.value })}
            placeholder="Must match password"
          />
        </div>

        {formState.errors?.length > 0 && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="text-sm font-medium text-red-800 mb-1">Validation Errors:</div>
            <ul className="text-sm text-red-600 list-disc list-inside">
              {formState.errors.map((error: string, i: number) => (
                <li key={i}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        {formState.valid && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="text-sm font-medium text-green-800">✓ Form is valid!</div>
          </div>
        )}

        <Button
          className="w-full"
          disabled={!formState.valid}
        >
          Submit
        </Button>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Component 6: PubSub Visual Coordination
// ============================================================================

// Color Controller - publishes RGB color object
function ColorController() {
  const [color, sendColor, colorGadget] = useGadget(
    () => lastMap({ red: 128, green: 128, blue: 128 }),
    { red: 128, green: 128, blue: 128 }
  );
  const { addTopics } = useRegistry(colorGadget, 'color-controller');
  useEffect(() => {
    addTopics('color');
  }, [addTopics]);

  const rgbColor = `rgb(${color['red']}, ${color['green']}, ${color['blue']})`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Color Controller</CardTitle>
        <CardDescription>
          Publishes RGB color object to 'color' topic
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className="w-full h-20 rounded-lg border-2 border-slate-200"
          style={{ backgroundColor: rgbColor }}
        />

        <div className="space-y-3">
          <div>
            <div className="flex justify-between">
              <Label>Red ({color['red']})</Label>
              <span className="text-xs text-muted-foreground">topic: color</span>
            </div>
            <Slider
              value={[color['red'] ?? 128]}
              onValueChange={([value]) => sendColor({ red: value })}
              max={255}
              className="mt-1"
            />
          </div>

          <div>
            <div className="flex justify-between">
              <Label>Green ({color['green']})</Label>
              <span className="text-xs text-muted-foreground">topic: color</span>
            </div>
            <Slider
              value={[color['green'] ?? 128]}
              onValueChange={([value]) => sendColor({ green: value })}
              max={255}
              className="mt-1"
            />
          </div>

          <div>
            <div className="flex justify-between">
              <Label>Blue ({color['blue']})</Label>
              <span className="text-xs text-muted-foreground">topic: color</span>
            </div>
            <Slider
              value={[color['blue'] ?? 128]}
              onValueChange={([value]) => sendColor({ blue: value })}
              max={255}
              className="mt-1"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Size Controller - publishes size value
function SizeController() {
  const [size, sendSize, sizeGadget] = useGadget(
    () => lastCell(50),
    50
  );

  const { addTopics } = useRegistry(sizeGadget, 'size-controller');
  useEffect(() => {
    addTopics('size');
  }, [addTopics]);

  // For now, just local state - pubsub integration can be added when needed

  return (
    <Card>
      <CardHeader>
        <CardTitle>Size Controller</CardTitle>
        <CardDescription>
          Publishes to the size topic
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-center">
          <div
            className="bg-slate-500 rounded-lg transition-all duration-200"
            style={{
              width: `${size}px`,
              height: `${size}px`,
              maxWidth: '100%'
            }}
          />
        </div>

        <div>
          <div className="flex justify-between">
            <Label>Size ({size}px)</Label>
            <span className="text-xs text-muted-foreground">topic: size</span>
          </div>
          <Slider
            value={[size]}
            onValueChange={([value]) => sendSize(value)}
            min={20}
            max={100}
            className="mt-1"
          />
        </div>
      </CardContent>
    </Card>
  );
}

// Visual Element that subscribes to color and size
function VisualElement({
  id,
  colorTransform = (color: { red: number; green: number; blue: number }) => color,
  sizeTransform = (size: number) => size
}: {
  id: string;
  colorTransform?: (color: { red: number; green: number; blue: number }) => { red: number; green: number; blue: number };
  sizeTransform?: (size: number) => number;
}) {
  // For demo purposes, just use local state with transforms
  const [color, , colorGadget] = useGadget(
    lastMap,
    { red: 128, green: 128, blue: 128 }
  );

  const [size, , sizeGadget] = useGadget(
    lastCell,
    50
  );

  const colorRegistry = useRegistry(colorGadget, `visual-element-${id}-color`);
  const sizeRegistry = useRegistry(sizeGadget, `visual-element-${id}-size`);

  useEffect(() => {
    colorRegistry.subscribe('color');
    sizeRegistry.subscribe('size');
  }, [colorRegistry, sizeRegistry]);

  const transformed = colorTransform(color as { red: number; green: number; blue: number });
  const rgbColor = `rgb(${Math.round(transformed.red)}, ${Math.round(transformed.green)}, ${Math.round(transformed.blue)})`;
  const transformedSize = sizeTransform(size);

  return (
    <div className="flex flex-col items-center space-y-2">
      <div
        className="rounded-lg transition-all duration-200 shadow-md"
        style={{
          backgroundColor: rgbColor,
          width: `${transformedSize}px`,
          height: `${transformedSize}px`
        }}
      />
      <span className="text-xs text-muted-foreground">{id}</span>
    </div>
  );
}

// Container for visual coordination demo
function VisualCoordination() {
  return (
    <Card className="lg:col-span-3">
      <CardHeader>
        <CardTitle>🎨 PubSub Visual Coordination</CardTitle>
        <CardDescription>
          Components coordinate visual properties through the pubsub system.
          Change the controllers above to see the elements react!
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          <div>
            <h4 className="text-sm font-medium mb-3">Direct Subscribers</h4>
            <div className="space-y-4">
              <VisualElement id="element-1" />
              <VisualElement id="element-2" />
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium mb-3">Complementary Colors</h4>
            <div className="space-y-4">
              <VisualElement
                id="complement-1"
                colorTransform={(color) => ({ red: 255 - color.red, green: 255 - color.green, blue: 255 - color.blue })}
              />
              <VisualElement
                id="complement-2"
                colorTransform={(color) => ({ red: 255 - color.red, green: color.blue, blue: color.green })}
              />
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium mb-3">Size Cascade</h4>
            <div className="space-y-4">
              <VisualElement
                id="cascade-1"
                sizeTransform={(size) => size * 0.8}
              />
              <VisualElement
                id="cascade-2"
                sizeTransform={(size) => size * 0.6}
              />
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium mb-3">Mixed Transforms</h4>
            <div className="space-y-4">
              <VisualElement
                id="mixed-1"
                colorTransform={(color) => ({ red: color.green, green: color.blue, blue: color.red })} // rotate RGB
                sizeTransform={(size) => 100 - size} // inverse size
              />
              <VisualElement
                id="mixed-2"
                colorTransform={() => ({ red: 128, green: 128, blue: 128 })} // constant color
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Demo Component
// ============================================================================
export default function GadgetDemo() {
  return (
    <PubSubProvider>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="container mx-auto py-8 px-4">
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">Gadget Demo</h1>
            <p className="text-lg text-muted-foreground">
              Interactive demonstration of port-graphs with React. These components show how
              gadgets create moldable tools with bidirectional data flow.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <MaxCellSlider />
            <AdderComponent />
            <ChainedFunctions />
            <MinMaxTracker />
            <FormValidatorGadget />
            <ColorController />
            <SizeController />
          </div>

          {/* Visual Coordination Demo - Full width */}
          <div className="mt-6">
            <VisualCoordination />
          </div>

          <div className="mt-12 p-6 bg-white rounded-lg shadow-sm border">
            <h2 className="text-xl font-semibold mb-3">Key Concepts Demonstrated</h2>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <h3 className="font-medium mb-1">🔄 Bidirectional Flow</h3>
                <p className="text-muted-foreground">
                  UI controls update gadget state, gadget state drives UI rendering
                </p>
              </div>
              <div>
                <h3 className="font-medium mb-1">📦 Cell Patterns</h3>
                <p className="text-muted-foreground">
                  MaxCell, MinCell - monotonic state accumulation with ACI merge
                </p>
              </div>
              <div>
                <h3 className="font-medium mb-1">⚡ Function Patterns</h3>
                <p className="text-muted-foreground">
                  Adder, Multiplier - compute when all arguments present
                </p>
              </div>
              <div>
                <h3 className="font-medium mb-1">🔗 Gadget Wiring</h3>
                <p className="text-muted-foreground">
                  Gadgets can be connected - output of one feeds input of another
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PubSubProvider>
  );
}