#!/usr/bin/env npx tsx

/**
 * Test the new tap-based React integration
 */

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { useGadget, useTap } from './src/index';
import { maxCell, lastCell, withTaps } from 'port-graphs';
import { createGadget, changed } from 'port-graphs';

console.log('Testing tap-based React integration...\n');

// Test 1: useGadget returns Tappable
console.log('=== Test 1: useGadget returns Tappable ===');
{
  const { result } = renderHook(() => useGadget(maxCell, 0));
  const [, , gadget] = result.current;

  if (typeof gadget.tap === 'function') {
    console.log('✅ Gadget has tap method');
  } else {
    console.log('❌ Gadget missing tap method');
  }

  // Test tapping works
  let tappedValue: any = null;
  const cleanup = gadget.tap((effect) => {
    tappedValue = effect;
  });

  act(() => {
    gadget.receive(10);
  });

  if (tappedValue && 'changed' in tappedValue && tappedValue.changed === 10) {
    console.log('✅ Tap received effect correctly');
  } else {
    console.log('❌ Tap did not receive effect');
  }

  cleanup();
}

// Test 2: useTap hook
console.log('\n=== Test 2: useTap Hook ===');
{
  const source = withTaps(maxCell(0));
  const target = withTaps(lastCell(0));

  let effectReceived = false;

  const { rerender, unmount } = renderHook(
    ({ source }) => {
      useTap(source, (effect) => {
        effectReceived = true;
        if (effect && 'changed' in effect) {
          target.receive(effect.changed);
        }
      });
    },
    { initialProps: { source } }
  );

  // Trigger effect
  source.receive(20);

  if (effectReceived) {
    console.log('✅ useTap received effect');
  } else {
    console.log('❌ useTap did not receive effect');
  }

  if (target.current() === 20) {
    console.log('✅ Target received value through tap');
  } else {
    console.log('❌ Target did not receive value');
  }

  unmount();
}

// Test 3: Direct connections between gadgets
console.log('\n=== Test 3: Direct Gadget Connections ===');
{
  const { result: source } = renderHook(() =>
    useGadget(createGadget(
      (_state, data: number) => ({ action: 'emit', context: data }),
      { emit: (gadget, data) => { gadget.update(data); return changed(data); } }
    ), 0)
  );

  const { result: target } = renderHook(() => useGadget(maxCell, 0));

  const [, sendSource, sourceGadget] = source.current;
  const [targetValue, , targetGadget] = target.current;

  // Connect source to target
  renderHook(() => {
    useTap(sourceGadget, (effect: any) => {
      if (effect && 'changed' in effect) {
        targetGadget.receive(effect.changed);
      }
    });
  });

  // Send data through source
  act(() => {
    sendSource(50);
  });

  // Check if target received it
  const { result: updatedTarget } = renderHook(() => useGadget(maxCell, targetGadget.current()));
  const [newTargetValue] = updatedTarget.current;

  if (newTargetValue === 50) {
    console.log('✅ Direct connection works');
  } else {
    console.log('❌ Direct connection failed');
  }
}

// Test 4: Cleanup on unmount
console.log('\n=== Test 4: Cleanup on Unmount ===');
{
  const source = withTaps(maxCell(0));
  let effectCount = 0;

  const { unmount } = renderHook(() => {
    useTap(source, () => {
      effectCount++;
    });
  });

  source.receive(1);
  if (effectCount === 1) {
    console.log('✅ Tap active before unmount');
  }

  unmount();
  source.receive(2);

  if (effectCount === 1) {
    console.log('✅ Tap cleaned up on unmount');
  } else {
    console.log('❌ Tap not cleaned up');
  }
}

console.log('\n✅ All tests completed!');