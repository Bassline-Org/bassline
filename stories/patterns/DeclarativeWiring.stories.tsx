import type { Meta, StoryObj } from '@storybook/react';
import { useGadget, createReactFamily, GadgetContext, ProvideGadget, useCurrentGadget, useExplicitGadget, Tap } from 'port-graphs-react';
import { lastCell, tapValue, withTaps } from 'port-graphs';

// Create some gadgets to work with
const sourceGadget = withTaps(lastCell(0));
const displayGadget = withTaps(lastCell(''));
const loggerGadget = withTaps(lastCell([]));

// Create a family for dynamic gadgets
const nodeFamily = createReactFamily(() => lastCell(0));

// Simple component that uses declarative wiring
function DeclarativeCounter() {
  const [value, send] = useGadget(sourceGadget);

  return (
    <GadgetContext gadget={sourceGadget}>
      <div style={{ padding: '20px' }}>
        <h3>Source Counter</h3>
        <button
          onClick={() => send(value + 1)}
          style={{
            padding: '10px 20px',
            background: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Count: {value}
        </button>

        {/* Declarative wiring - tap to display gadget */}
        <Tap handler={tapValue(displayGadget)} />

        {/* Custom tap handler */}
        <Tap handler={(effect) => {
          if (effect?.changed !== undefined) {
            console.log('Counter changed to:', effect.changed);
          }
        }} />
      </div>
    </GadgetContext>
  );
}

// Display component that shows the value
function Display() {
  const [value] = useGadget(displayGadget);

  return (
    <div style={{
      padding: '20px',
      background: '#f0f0f0',
      borderRadius: '8px'
    }}>
      <h3>Display</h3>
      <div style={{
        fontSize: '24px',
        fontWeight: 'bold',
        color: '#333'
      }}>
        Current Value: {value}
      </div>
    </div>
  );
}

// Component using named gadgets
function LoggerComponent() {
  const [logs] = useGadget(loggerGadget);

  return (
    <div style={{
      padding: '20px',
      background: '#f9f9f9',
      borderRadius: '8px',
      marginTop: '20px'
    }}>
      <h3>Logger (from named gadget)</h3>
      <div style={{
        maxHeight: '200px',
        overflow: 'auto',
        fontFamily: 'monospace',
        fontSize: '14px'
      }}>
        {(logs as any[]).map((log, i) => (
          <div key={i}>{log}</div>
        ))}
      </div>
    </div>
  );
}

// Component that sets up complex wiring
function WiredNode({ id, targetId }: { id: string; targetId: string }) {
  const [value, send, source] = useGadget(nodeFamily, id);
  const target = useGadget(nodeFamily, targetId)[2];

  return (
    <GadgetContext gadget={source}>
      <div style={{
        padding: '15px',
        background: '#e3f2fd',
        borderRadius: '8px',
        marginBottom: '10px'
      }}>
        <h4>Node {id}</h4>
        <input
          type="number"
          value={value as string}
          onChange={(e) => send(Number(e.target.value))}
          style={{
            padding: '5px',
            width: '100%',
            boxSizing: 'border-box'
          }}
        />

        {/* Wire to target node */}
        <Tap handler={tapValue(target)} />

        {/* Also log to named logger */}
        <Tap handler={(effect) => {
          if (effect?.changed !== undefined) {
            const logger = loggerGadget; // In real app, would use useExplicitGadget('logger')
            logger.receive([...logger.current(), `Node ${id}: ${effect.changed}`]);
          }
        }} />

        <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
          Wired to: Node {targetId}
        </div>
      </div>
    </GadgetContext>
  );
}

// Main demo component
function DeclarativeWiringDemo() {
  return (
    <ProvideGadget name="logger" gadget={loggerGadget}>
      <div style={{ padding: '20px' }}>
        <h2>Declarative Wiring with Tap Components</h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div>
            <DeclarativeCounter />

            <div style={{ marginTop: '20px' }}>
              <h3>Wired Nodes</h3>
              <WiredNode id="A" targetId="B" />
              <WiredNode id="B" targetId="C" />
              <WiredNode id="C" targetId="A" />
            </div>
          </div>

          <div>
            <Display />
            <LoggerComponent />
          </div>
        </div>

        <p style={{ marginTop: '20px', color: '#666', fontSize: '14px' }}>
          The Tap component declaratively sets up gadget connections.
          Wiring is visible in JSX and cleaned up automatically.
        </p>
      </div>
    </ProvideGadget>
  );
}

const meta = {
  title: 'Patterns/Declarative Wiring',
  component: DeclarativeWiringDemo,
  parameters: {
    docs: {
      description: {
        component: `
# Declarative Wiring Pattern

The Tap component allows you to declaratively express gadget connections in JSX.

## Key Concepts

- **\`<Tap />\`** - Sets up a tap from the current gadget
- **GadgetContext** - Provides current gadget to child components
- **ProvideGadget** - Registers named gadgets
- **No manual effect cleanup** - React handles it automatically

## Benefits

1. **Visible wiring** - Connections are clear in the JSX
2. **Composable** - Build complex wiring from simple Tap components
3. **React-idiomatic** - Uses context and effects naturally
4. **Clean** - No imperative wiring code

## Examples

\`\`\`jsx
// Simple tap
<GadgetContext gadget={source}>
  <Tap handler={tapValue(target)} />
</GadgetContext>

// Custom handler
<Tap handler={(effect) => {
  if (effect.changed > threshold) {
    alert.receive(effect.changed);
  }
}} />
\`\`\`
        `
      }
    }
  }
} satisfies Meta<typeof DeclarativeWiringDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <DeclarativeWiringDemo />
};