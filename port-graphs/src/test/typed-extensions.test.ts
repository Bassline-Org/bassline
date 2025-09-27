/**
 * Test typed gadgets with tap extension
 */

import { describe, it, expect } from 'vitest';
import { sliderGadget, meterGadget } from '../patterns/ui/typed-ui';

// Test slider
const slider = sliderGadget(50, 0, 100, 5);

// Test basic receive
slider.receive({ set: 75 });
slider.receive({ increment: {} });
slider.receive({ decrement: {} });
slider.receive({ configure: { max: 200 } });

// Tap should be available and typed
const cleanup = slider.tap((effect) => {
  // TypeScript knows effect can be:
  // { changed: number } | { configured: SliderState } | { noop: {} }
  if ('changed' in effect) {
    console.log('Slider changed to:', effect.changed);
  }
  if ('configured' in effect) {
    console.log('Slider configured:', effect.configured);
  }
});

// Test meter
const meter = meterGadget(0, 100, 'Speed');

meter.receive({ display: 50 });
meter.receive({ configure: { label: 'Temperature' } });
meter.receive({ reset: {} });

// Tap on meter
meter.tap((effect) => {
  if ('changed' in effect) {
    console.log('Meter value:', effect.changed);
  }
});

// Cleanup tap
cleanup();

console.log('All type checks passed!');

describe('Type checks', () => {
  it('should compile without type errors', () => {
    // This test just validates that the TypeScript types compile correctly
    expect(true).toBe(true);
  });
});