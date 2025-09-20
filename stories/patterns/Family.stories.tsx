import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { useGadget, useTap, createReactFamily } from 'port-graphs-react';
import { lastCell, tapValue } from 'port-graphs';


// Component that uses a gadget from the family
function NodeComponent({ id }: { id: string }) {
  const [value, send] = useGadget(nodeFamily, id);

  return (
    <div style={{
      padding: '15px',
      margin: '10px',
      background: '#f5f5f5',
      borderRadius: '8px',
      border: '2px solid #ddd'
    }}>
      <h4 style={{ margin: '0 0 10px 0' }}>Node: {id}</h4>
      <input
        type="text"
        value={value}
        onChange={(e) => send(e.target.value)}
        style={{
          padding: '5px',
          width: '100%',
          boxSizing: 'border-box'
        }}
      />
    </div>
  );
}

// Create a family of node gadgets - static like Recoil atomFamily
const nodeFamily = createReactFamily(() => lastCell(''));

// Dynamic node creation demo
function DynamicNodes() {

  const [nodeIds, setNodeIds] = useState<string[]>(['node-1', 'node-2']);
  const [nextId, setNextId] = useState(3);

  const addNode = () => {
    const newId = `node-${nextId}`;
    setNodeIds([...nodeIds, newId]);
    setNextId(nextId + 1);
  };

  const removeNode = (id: string) => {
    setNodeIds(nodeIds.filter(nid => nid !== id));
  };

  return (
    <div style={{ padding: '20px' }}>
      <h3>Dynamic Node Creation with Family</h3>
      <button
        onClick={addNode}
        style={{
          padding: '10px 20px',
          background: '#4CAF50',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          marginBottom: '20px'
        }}
      >
        Add Node
      </button>

      <div style={{ display: 'flex', flexWrap: 'wrap' }}>
        {nodeIds.map(id => (
          <div key={id} style={{ position: 'relative' }}>
            <NodeComponent id={id} />
            <button
              onClick={() => removeNode(id)}
              style={{
                position: 'absolute',
                top: '15px',
                right: '15px',
                padding: '5px 10px',
                background: '#f44336',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <p style={{ marginTop: '20px', color: '#666', fontSize: '14px' }}>
        Each node is a gadget from the family. They're created lazily when first requested.
      </p>
    </div>
  );
}

// Create families for different types
const sourceFamily = createReactFamily(() => lastCell(0));
const displayFamily = createReactFamily(() => lastCell(''));

// Connected family members
function ConnectedFamily() {

  function SourceNode({ id, targetId }: { id: string; targetId: string }) {
    const [value, send, tappableSource] = useGadget(sourceFamily, id);
    const [, , tappableTarget] = useGadget(displayFamily, targetId);

    // Connect source to target
    useTap(tappableSource, tapValue(tappableTarget), [tappableTarget]);

    return (
      <div style={{
        padding: '15px',
        background: '#e3f2fd',
        borderRadius: '8px',
        marginBottom: '10px'
      }}>
        <h4 style={{ margin: '0 0 10px 0' }}>Source: {id}</h4>
        <input
          type="number"
          value={value}
          onChange={(e) => send(Number(e.target.value))}
          style={{
            padding: '5px',
            width: '100%',
            boxSizing: 'border-box'
          }}
        />
        <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
          Connected to: {targetId}
        </div>
      </div>
    );
  }

  function DisplayNode({ id }: { id: string }) {
    const [value] = useGadget(displayFamily, id);

    return (
      <div style={{
        padding: '15px',
        background: '#f3e5f5',
        borderRadius: '8px'
      }}>
        <h4 style={{ margin: '0 0 10px 0' }}>Display: {id}</h4>
        <div style={{
          padding: '10px',
          background: 'white',
          borderRadius: '4px',
          fontSize: '18px',
          fontWeight: 'bold',
          textAlign: 'center'
        }}>
          {value}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      <h3>Connected Family Members</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div>
          <h4>Sources</h4>
          <SourceNode id="src-1" targetId="display-1" />
          <SourceNode id="src-2" targetId="display-2" />
          <SourceNode id="src-3" targetId="display-1" />
        </div>
        <div>
          <h4>Displays</h4>
          <DisplayNode id="display-1" />
          <DisplayNode id="display-2" />
        </div>
      </div>
      <p style={{ marginTop: '20px', color: '#666', fontSize: '14px' }}>
        Multiple sources can connect to the same display. Last write wins with lastCell.
      </p>
    </div>
  );
}

const meta = {
  title: 'Patterns/Family',
  component: DynamicNodes,
  parameters: {
    docs: {
      description: {
        component: `
# Gadget Family Pattern

The family pattern allows for dynamic gadget creation while keeping everything within the universal protocol.

## How It Works

A family is just a regular gadget that:
1. Stores a map of other gadgets
2. Creates gadgets lazily when requested
3. Returns existing gadgets on subsequent requests

## Key Benefits

- **Lazy Creation**: Gadgets are only created when needed
- **Dynamic Keys**: Support for runtime-determined gadget IDs
- **Type Safe**: Full TypeScript support with inference
- **Memory Efficient**: Only create what you use

## Use Cases

- Dynamic node creation in visual editors
- Per-user state management
- Entity-based game state
- Form field management
        `
      }
    }
  }
} satisfies Meta<typeof DynamicNodes>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DynamicCreation: Story = {
  render: () => <DynamicNodes />
};

export const ConnectedMembers: Story = {
  render: () => <ConnectedFamily />
};