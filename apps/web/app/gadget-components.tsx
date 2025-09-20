import { useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useGadget, useCommonGadget } from 'port-graphs-react';
import { maxCell, lastCell } from 'port-graphs';

interface GadgetComponentProps {
  id: string;
}

// Counter gadget - clicks increment
export function CounterGadget({ id }: GadgetComponentProps) {
  const gadgetsTable = useCommonGadget();
  const [count, , counterGadget] = useGadget(maxCell, 0);

  useEffect(() => {
    gadgetsTable.receive({ [id]: counterGadget });
    return () => {
      gadgetsTable.receive({ [id]: undefined });
    };
  }, [id, counterGadget, gadgetsTable]);

  return (
    <div
      onClick={() => counterGadget.receive(count + 1)}
      style={{
        padding: '10px',
        border: '2px solid #4a90e2',
        borderRadius: '5px',
        background: '#e3f2fd',
        cursor: 'pointer',
        userSelect: 'none',
      }}
    >
      <Handle id={`${id}-target`} type="target" position={Position.Left} />
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '10px', color: '#666' }}>Counter</div>
        <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{count}</div>
      </div>
      <Handle id={`${id}-source`} type="source" position={Position.Right} />
    </div>
  );
}

// Timer gadget - auto-increments
export function TimerGadget({ id }: GadgetComponentProps) {
  const gadgetsTable = useCommonGadget();
  const [value, , timerGadget] = useGadget(lastCell, 0);

  useEffect(() => {
    gadgetsTable.receive({ [id]: timerGadget });
    const interval = setInterval(() => {
      timerGadget.receive((timerGadget.current() as number) + 1);
    }, 1000);

    return () => {
      clearInterval(interval);
      gadgetsTable.receive({ [id]: undefined });
    };
  }, [id, timerGadget, gadgetsTable]);

  return (
    <div
      style={{
        padding: '10px',
        border: '2px solid #4caf50',
        borderRadius: '5px',
        background: '#e8f5e9',
        userSelect: 'none',
      }}
    >
      <Handle id={`${id}-target`} type="target" position={Position.Left} />
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '10px', color: '#666' }}>Timer</div>
        <div style={{ fontSize: '18px', fontWeight: 'bold' }}>⏰ {value}</div>
      </div>
      <Handle id={`${id}-source`} type="source" position={Position.Right} />
    </div>
  );
}

// Display gadget - shows whatever it receives
export function DisplayGadget({ id }: GadgetComponentProps) {
  const gadgetsTable = useCommonGadget();
  const [value, , displayGadget] = useGadget(lastCell, '-' as string | number);

  useEffect(() => {
    gadgetsTable.receive({ [id]: displayGadget });
    return () => {
      gadgetsTable.receive({ [id]: undefined });
    };
  }, [id, displayGadget, gadgetsTable]);

  return (
    <div
      style={{
        padding: '10px',
        border: '2px solid #9c27b0',
        borderRadius: '5px',
        background: '#f3e5f5',
        userSelect: 'none',
      }}
    >
      <Handle id={`${id}-target`} type="target" position={Position.Left} />
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '10px', color: '#666' }}>Display</div>
        <div style={{ fontSize: '16px', fontWeight: 'bold', fontFamily: 'monospace' }}>
          {JSON.stringify(value)}
        </div>
      </div>
    </div>
  );
}

// Adder gadget - sums inputs
export function AdderGadget({ id }: GadgetComponentProps) {
  const gadgetsTable = useCommonGadget();
  const [sum, , sumGadget] = useGadget(lastCell, 0);

  // Track inputs locally in the component
  const inputs = new Map<string, number>();

  useEffect(() => {
    // Create a wrapper that tracks inputs
    const adderGadget = {
      ...sumGadget,
      receive: (data: any) => {
        if (typeof data === 'number') {
          sumGadget.receive(data);
        } else if (data && typeof data === 'object' && 'from' in data && 'value' in data) {
          inputs.set(data.from, data.value);
          const newSum = Array.from(inputs.values()).reduce((a, b) => a + b, 0);
          sumGadget.receive(newSum);
        }
      }
    };

    gadgetsTable.receive({ [id]: adderGadget });
    return () => {
      gadgetsTable.receive({ [id]: undefined });
    };
  }, [id, sumGadget, gadgetsTable]);

  return (
    <div
      style={{
        padding: '10px',
        border: '2px solid #ff9800',
        borderRadius: '5px',
        background: '#fff3e0',
        userSelect: 'none',
      }}
    >
      <Handle id={`${id}-target`} type="target" position={Position.Left} />
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '10px', color: '#666' }}>Adder</div>
        <div style={{ fontSize: '18px', fontWeight: 'bold' }}>Σ {sum}</div>
      </div>
      <Handle id={`${id}-source`} type="source" position={Position.Right} />
    </div>
  );
}

// Multiplier gadget
export function MultiplierGadget({ id }: GadgetComponentProps) {
  const gadgetsTable = useCommonGadget();
  const [product, , productGadget] = useGadget(lastCell, 1);

  const inputs = new Map<string, number>();

  useEffect(() => {
    const multiplierGadget = {
      ...productGadget,
      receive: (data: any) => {
        if (typeof data === 'number') {
          productGadget.receive(data);
        } else if (data && typeof data === 'object' && 'from' in data && 'value' in data) {
          inputs.set(data.from, data.value);
          const newProduct = Array.from(inputs.values()).reduce((a, b) => a * b, 1);
          productGadget.receive(newProduct);
        }
      }
    };

    gadgetsTable.receive({ [id]: multiplierGadget });
    return () => {
      gadgetsTable.receive({ [id]: undefined });
    };
  }, [id, productGadget, gadgetsTable]);

  return (
    <div
      style={{
        padding: '10px',
        border: '2px solid #2196f3',
        borderRadius: '5px',
        background: '#e1f5fe',
        userSelect: 'none',
      }}
    >
      <Handle id={`${id}-target`} type="target" position={Position.Left} />
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '10px', color: '#666' }}>Multiplier</div>
        <div style={{ fontSize: '18px', fontWeight: 'bold' }}>× {product}</div>
      </div>
      <Handle id={`${id}-source`} type="source" position={Position.Right} />
    </div>
  );
}

// Constant gadget
export function ConstantGadget({ id }: GadgetComponentProps) {
  const gadgetsTable = useCommonGadget();
  const [value, , constantGadget] = useGadget(lastCell, 42);

  useEffect(() => {
    gadgetsTable.receive({ [id]: constantGadget });
    return () => {
      gadgetsTable.receive({ [id]: undefined });
    };
  }, [id, constantGadget, gadgetsTable]);

  return (
    <div
      style={{
        padding: '10px',
        border: '2px solid #607d8b',
        borderRadius: '5px',
        background: '#eceff1',
        userSelect: 'none',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '10px', color: '#666' }}>Constant</div>
        <input
          type="number"
          value={value as number}
          onChange={(e) => constantGadget.receive(Number(e.target.value))}
          style={{
            fontSize: '16px',
            fontWeight: 'bold',
            width: '60px',
            textAlign: 'center',
            border: 'none',
            background: 'transparent',
          }}
        />
      </div>
      <Handle id={`${id}-source`} type="source" position={Position.Right} />
    </div>
  );
}

// Component registry
const componentRegistry: Record<string, any> = {
  counter: CounterGadget,
  timer: TimerGadget,
  display: DisplayGadget,
  adder: AdderGadget,
  multiplier: MultiplierGadget,
  constant: ConstantGadget,
};

// Main node component that uses registry
export function GadgetNode({ id, data }: { id: string; data: any }) {
  const Component = componentRegistry[data?.type] || CounterGadget;
  return <Component id={id} />;
}