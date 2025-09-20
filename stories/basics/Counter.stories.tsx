import type { Meta, StoryObj } from '@storybook/react';
import { useGadget, GadgetContext, Tap } from 'port-graphs-react';
import { maxCell, tapValue, tapTransform, withTaps } from 'port-graphs';

// Create gadget outside component - like a Recoil atom
const counterGadget = withTaps(maxCell(0));

// Counter component that uses the gadget
function Counter() {
  const [count, send] = useGadget(counterGadget);

  return (
    <div style={{ padding: '20px' }}>
      <h3>Counter using maxCell</h3>
      <button
        onClick={() => send(count + 1)}
        style={{
          padding: '10px 20px',
          fontSize: '16px',
          background: '#4CAF50',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        Count: {count}
      </button>
      <p style={{ marginTop: '10px', color: '#666' }}>
        Using maxCell - only increases, never decreases
      </p>
    </div>
  );
}

// Gadgets for the connected example
const connectedCounter = withTaps(maxCell(0));
const connectedDisplay = withTaps(maxCell(0));

// Counter with display
function CounterWithDisplay() {
  const counter = connectedCounter;
  const display = connectedDisplay;

  // Counter component
  function CounterPart() {
    const [count, send] = useGadget(counter);
    return (
      <button
        onClick={() => send(count + 1)}
        style={{
          padding: '10px 20px',
          fontSize: '16px',
          background: '#2196F3',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        Click me: {count}
      </button>
    );
  }

  // Display component
  function DisplayPart() {
    const [value] = useGadget(display);
    const [, , tappableCounter] = useGadget(counter);

    return (
      <>
        <GadgetContext gadget={tappableCounter}>
          <Tap handler={tapValue(display)} />
        </GadgetContext>
        <div style={{
          padding: '10px 20px',
          background: '#f0f0f0',
          borderRadius: '4px',
          marginTop: '10px'
        }}>
          Display: {value}
        </div>
      </>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      <h3>Counter with Display (using tap)</h3>
      <CounterPart />
      <DisplayPart />
    </div>
  );
}

// Gadgets for transformation example
const transformCounter = withTaps(maxCell(0));
const doubledGadget = withTaps(maxCell(0));
const squaredGadget = withTaps(maxCell(0));

// Counter with transformation
function CounterWithTransform() {
  const counter = transformCounter;
  const doubled = doubledGadget;
  const squared = squaredGadget;

  function CounterPart() {
    const [count, send] = useGadget(counter);
    return (
      <button
        onClick={() => send(count + 1)}
        style={{
          padding: '10px 20px',
          fontSize: '16px',
          background: '#9C27B0',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        Count: {count}
      </button>
    );
  }

  function TransformedDisplays() {
    const [doubledValue] = useGadget(doubled);
    const [squaredValue] = useGadget(squared);
    const [, , tappableCounter] = useGadget(counter);

    return (
      <>
        <GadgetContext gadget={tappableCounter}>
          <Tap handler={tapTransform(doubled, (x: number) => x * 2)} />
          <Tap handler={tapTransform(squared, (x: number) => x * x)} />
        </GadgetContext>
        <div style={{ marginTop: '10px' }}>
        <div style={{
          padding: '10px',
          background: '#e3f2fd',
          borderRadius: '4px',
          marginBottom: '5px'
        }}>
          Doubled: {doubledValue}
        </div>
        <div style={{
          padding: '10px',
          background: '#f3e5f5',
          borderRadius: '4px'
        }}>
          Squared: {squaredValue}
        </div>
        </div>
      </>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      <h3>Counter with Transformations</h3>
      <CounterPart />
      <TransformedDisplays />
      <p style={{ marginTop: '10px', color: '#666', fontSize: '14px' }}>
        Using tapTransform to create derived values
      </p>
    </div>
  );
}

const meta = {
  title: 'Basics/Counter',
  component: Counter,
  parameters: {
    docs: {
      description: {
        component: `
# Counter Gadget

Basic examples showing how to use gadgets with React components.

## Key Concepts

- **Gadgets are defined outside components** - They're like global state atoms
- **useGadget hook** - Connects a gadget to React state
- **Tap utilities** - Transform and route data between gadgets

## Patterns Demonstrated

1. **Simple counter** - Basic gadget usage
2. **Connected components** - Using taps to connect gadgets
3. **Transformations** - Deriving values with tapTransform
        `
      }
    }
  }
} satisfies Meta<typeof Counter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Simple: Story = {
  render: () => <Counter />
};

export const WithDisplay: Story = {
  render: () => <CounterWithDisplay />
};

export const WithTransformations: Story = {
  render: () => <CounterWithTransform />
};