/**
 * Test NEW context.ts system integration with React
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React, { useMemo } from 'react';
import { quick, withTaps, maxProto, sliderProto } from 'port-graphs';
import { GadgetProvider } from '../GadgetProvider';
import { useGadget } from '../useGadget';

describe('NEW System React Integration', () => {
  it('should work with maxProto gadget', () => {
    function TestComponent() {
      const gadget = useMemo(() => withTaps(quick(maxProto, 0)), []);
      const [state, send] = useGadget(gadget);

      return (
        <div>
          <div data-testid="value">{state}</div>
          <button onClick={() => send(5)}>Set 5</button>
          <button onClick={() => send(10)}>Set 10</button>
        </div>
      );
    }

    const { container } = render(
      <GadgetProvider>
        <TestComponent />
      </GadgetProvider>
    );

    expect(screen.getByTestId('value').textContent).toBe('0');

    fireEvent.click(screen.getByText('Set 5'));
    expect(screen.getByTestId('value').textContent).toBe('5');

    fireEvent.click(screen.getByText('Set 10'));
    expect(screen.getByTestId('value').textContent).toBe('10');

    // MaxCell should ignore lower values
    fireEvent.click(screen.getByText('Set 5'));
    expect(screen.getByTestId('value').textContent).toBe('10');
  });

  it('should work with sliderProto gadget', () => {
    function TestComponent() {
      const gadget = useMemo(
        () => withTaps(quick(sliderProto, { value: 50, min: 0, max: 100, step: 1 })),
        []
      );
      const [state, send] = useGadget(gadget);

      return (
        <div>
          <div data-testid="value">{state.value}</div>
          <button onClick={() => send({ set: 75 })}>Set 75</button>
          <button onClick={() => send({ increment: {} })}>Increment</button>
        </div>
      );
    }

    const { container } = render(
      <GadgetProvider>
        <TestComponent />
      </GadgetProvider>
    );

    expect(screen.getByTestId('value').textContent).toBe('50');

    fireEvent.click(screen.getByText('Set 75'));
    expect(screen.getByTestId('value').textContent).toBe('75');

    fireEvent.click(screen.getByText('Increment'));
    expect(screen.getByTestId('value').textContent).toBe('76');
  });
});
