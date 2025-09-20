/**
 * Demo gadget components for the interactive dashboard
 */

import React from 'react';
import { useGadget } from 'port-graphs-react';
import { maxCell, createBoundaryGadget } from 'port-graphs';
import { Slider } from '~/components/ui/slider';
import { Badge } from '~/components/ui/badge';
import { Progress } from '~/components/ui/progress';
import { GadgetCard, type PortConfig } from './GadgetCard';

// Slider Gadget Component
interface SliderGadgetProps {
  id: string;
  title: string;
  gadget: any;
  min?: number;
  max?: number;
  step?: number;
  position: { x: number; y: number };
  selected?: boolean;
  onSelect?: () => void;
}

export function SliderGadget({
  id,
  title,
  gadget,
  min = 0,
  max = 100,
  step = 1,
  position,
  selected,
  onSelect
}: SliderGadgetProps) {
  const [value, setValue] = useGadget(gadget);

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
      className="w-48"
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Value:</span>
          <Badge variant="outline" className="font-mono">
            {typeof value === 'number' ? value.toFixed(1) : value}
          </Badge>
        </div>
        <Slider
          value={[typeof value === 'number' ? value : min]}
          onValueChange={([newValue]) => setValue(newValue)}
          min={min}
          max={max}
          step={step}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{min}</span>
          <span>{max}</span>
        </div>
      </div>
    </GadgetCard>
  );
}

// Meter Gadget Component
interface MeterGadgetProps {
  id: string;
  title: string;
  gadget: any;
  min?: number;
  max?: number;
  position: { x: number; y: number };
  selected?: boolean;
  onSelect?: () => void;
}

export function MeterGadget({
  id,
  title,
  gadget,
  min = 0,
  max = 100,
  position,
  selected,
  onSelect
}: MeterGadgetProps) {
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
      className="w-48"
    >
      <div className="space-y-3">
        <div className="text-center">
          <div className="text-2xl font-mono font-bold">
            {numValue.toFixed(1)}
          </div>
          <div className="text-xs text-muted-foreground">
            {min} - {max}
          </div>
        </div>
        <Progress value={percentage} className="w-full" />
        <div className="flex justify-center">
          <Badge
            variant={percentage > 75 ? "destructive" : percentage > 50 ? "secondary" : "default"}
          >
            {percentage.toFixed(0)}%
          </Badge>
        </div>
      </div>
    </GadgetCard>
  );
}

// Boundary Gadget Component (shows min/current/max with constraints)
interface BoundaryGadgetProps {
  id: string;
  title: string;
  gadget: any;
  position: { x: number; y: number };
  selected?: boolean;
  violated?: boolean;
  onSelect?: () => void;
}

export function BoundaryGadgetComponent({
  id,
  title,
  gadget,
  position,
  selected,
  violated,
  onSelect
}: BoundaryGadgetProps) {
  const [state, setState] = useGadget(gadget);
  const { min, current, max } = state || { min: 0, current: 50, max: 100 };

  const ports: PortConfig[] = [
    { id: 'min-input', type: 'input', position: 'left', label: 'min' },
    { id: 'current-input', type: 'input', position: 'top', label: 'current' },
    { id: 'max-input', type: 'input', position: 'right', label: 'max' },
    { id: 'output', type: 'output', position: 'bottom', label: 'values' }
  ];

  return (
    <GadgetCard
      id={id}
      title={title}
      ports={ports}
      position={position}
      selected={selected}
      violated={violated}
      onSelect={onSelect}
      className="w-56"
    >
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-xs text-muted-foreground">Min</div>
            <div className="font-mono text-sm">{min}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Current</div>
            <div className="font-mono text-lg font-bold">{current}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Max</div>
            <div className="font-mono text-sm">{max}</div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">Min</div>
          <Slider
            value={[min]}
            onValueChange={([value]) => setState({ min: value })}
            min={0}
            max={200}
            step={1}
          />
        </div>

        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">Current</div>
          <Slider
            value={[current]}
            onValueChange={([value]) => setState({ current: value })}
            min={0}
            max={200}
            step={1}
          />
        </div>

        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">Max</div>
          <Slider
            value={[max]}
            onValueChange={([value]) => setState({ max: value })}
            min={0}
            max={200}
            step={1}
          />
        </div>

        {violated && (
          <div className="text-xs text-red-600 font-medium">
            Constraint violated!
          </div>
        )}
      </div>
    </GadgetCard>
  );
}

// Calculator Gadget (takes two inputs, shows result)
interface CalculatorGadgetProps {
  id: string;
  title: string;
  gadget: any;
  operation: string;
  position: { x: number; y: number };
  selected?: boolean;
  onSelect?: () => void;
}

export function CalculatorGadget({
  id,
  title,
  gadget,
  operation,
  position,
  selected,
  onSelect
}: CalculatorGadgetProps) {
  const [state] = useGadget(gadget);
  const result = (state as any)?.result ?? 0;

  const ports: PortConfig[] = [
    { id: 'a', type: 'input', position: 'left', label: 'a' },
    { id: 'b', type: 'input', position: 'top', label: 'b' },
    { id: 'result', type: 'output', position: 'right', label: 'result' }
  ];

  return (
    <GadgetCard
      id={id}
      title={title}
      ports={ports}
      position={position}
      selected={selected}
      onSelect={onSelect}
      className="w-40"
    >
      <div className="space-y-3 text-center">
        <div className="text-lg font-mono">
          {operation}
        </div>
        <div className="text-xl font-bold font-mono">
          = {result.toFixed(1)}
        </div>
      </div>
    </GadgetCard>
  );
}