import { maxCell, lastCell, lastMap } from 'port-graphs';
import { Handle, Position } from '@xyflow/react';
import { useEffect, useState } from 'react';
import { useTap } from 'port-graphs-react';

// Generic gadget component props
export interface GadgetComponentProps {
  gadget: any;
  id: string;
}

// Counter gadget with attached component
export const counterGadgetFactory = () => maxCell(0);
counterGadgetFactory.Component = ({ gadget, id }: GadgetComponentProps) => {
  const [value, setValue] = useState(gadget.current());

  useTap(gadget, (effect: any) => {
    if (effect && typeof effect === 'object' && 'changed' in effect) {
      setValue(effect.changed);
    }
  }, []);
  return (
    <div
      onClick={() => gadget.receive(value + 1)}
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
        <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{value}</div>
      </div>
      <Handle id={`${id}-source`} type="source" position={Position.Right} />
    </div>
  );
};

// Timer gadget with attached component
export const timerGadgetFactory = () => lastCell(0);
timerGadgetFactory.Component = ({ gadget, id }: GadgetComponentProps) => {
  const [value, setValue] = useState(gadget.current());

  useTap(gadget, (effect: any) => {
    if (effect && typeof effect === 'object' && 'changed' in effect) {
      setValue(effect.changed);
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      gadget.receive((value as number) + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [gadget, value]);

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
};

// Adder gadget with attached component
export const adderGadgetFactory = () => {
  const baseGadget = lastCell(0);
  const inputsMap = new Map<string, number>();

  // Extend the gadget to track inputs
  return {
    ...baseGadget,
    inputs: inputsMap,
    receive: (data: any) => {
      if (typeof data === 'number') {
        baseGadget.receive(data);
      } else if (data && typeof data === 'object' && 'from' in data && 'value' in data) {
        inputsMap.set(data.from, data.value);
        const sum = Array.from(inputsMap.values()).reduce((a, b) => a + b, 0);
        baseGadget.receive(sum);
      }
    }
  };
};

adderGadgetFactory.Component = ({ gadget, id }: GadgetComponentProps) => {
  const [value, setValue] = useState(gadget.current());

  useTap(gadget, (effect: any) => {
    if (effect && typeof effect === 'object' && 'changed' in effect) {
      setValue(effect.changed);
    }
  }, []);
  const inputCount = gadget.inputs ? gadget.inputs.size : 0;

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
        <div style={{ fontSize: '18px', fontWeight: 'bold' }}>Σ {value}</div>
        <div style={{ fontSize: '8px', color: '#999' }}>
          {inputCount} inputs
        </div>
      </div>
      <Handle id={`${id}-source`} type="source" position={Position.Right} />
    </div>
  );
};

// Display gadget with attached component
export const displayGadgetFactory = () => lastCell('-');
displayGadgetFactory.Component = ({ gadget, id }: GadgetComponentProps) => {
  const [value, setValue] = useState(gadget.current());

  useTap(gadget, (effect: any) => {
    if (effect && typeof effect === 'object' && 'changed' in effect) {
      setValue(effect.changed);
    }
  }, []);

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
};

// Multiplier gadget
export const multiplierGadgetFactory = () => {
  const baseGadget = lastCell(1);
  const inputsMap = new Map<string, number>();

  return {
    ...baseGadget,
    inputs: inputsMap,
    receive: (data: any) => {
      if (typeof data === 'number') {
        baseGadget.receive(data);
      } else if (data && typeof data === 'object' && 'from' in data && 'value' in data) {
        inputsMap.set(data.from, data.value);
        const product = Array.from(inputsMap.values()).reduce((a, b) => a * b, 1);
        baseGadget.receive(product);
      }
    }
  };
};

multiplierGadgetFactory.Component = ({ gadget, id }: GadgetComponentProps) => {
  const [value, setValue] = useState(gadget.current());

  useTap(gadget, (effect: any) => {
    if (effect && typeof effect === 'object' && 'changed' in effect) {
      setValue(effect.changed);
    }
  }, []);
  const inputCount = gadget.inputs ? gadget.inputs.size : 0;

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
        <div style={{ fontSize: '18px', fontWeight: 'bold' }}>× {value}</div>
        <div style={{ fontSize: '8px', color: '#999' }}>
          {inputCount} inputs
        </div>
      </div>
      <Handle id={`${id}-source`} type="source" position={Position.Right} />
    </div>
  );
};

// Constant gadget
export const constantGadgetFactory = (initialValue: number = 42) => {
  const gadget = lastCell(initialValue);
  // Make it editable
  return gadget;
};

constantGadgetFactory.Component = ({ gadget, id }: GadgetComponentProps) => {
  const [value, setValue] = useState(gadget.current());

  useTap(gadget, (effect: any) => {
    if (effect && typeof effect === 'object' && 'changed' in effect) {
      setValue(effect.changed);
    }
  }, []);

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
          onChange={(e) => gadget.receive(Number(e.target.value))}
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
};

// Define gadget type info
export interface GadgetTypeInfo {
  factory: any;
  icon: string;
  name: string;
  description: string;
}

// Create category gadgets as lastMaps
export const createGadgetCategories = () => {
  const mathCategory = lastMap({
    adder: {
      factory: adderGadgetFactory,
      icon: '➕',
      name: 'Adder',
      description: 'Sums all inputs'
    },
    multiplier: {
      factory: multiplierGadgetFactory,
      icon: '✖️',
      name: 'Multiplier',
      description: 'Multiplies all inputs'
    },
    constant: {
      factory: constantGadgetFactory,
      icon: '🔢',
      name: 'Constant',
      description: 'Constant value'
    }
  });

  const dataCategory = lastMap({
    counter: {
      factory: counterGadgetFactory,
      icon: '🔢',
      name: 'Counter',
      description: 'Click to increment'
    },
    timer: {
      factory: timerGadgetFactory,
      icon: '⏰',
      name: 'Timer',
      description: 'Auto-incrementing timer'
    }
  });

  const visualCategory = lastMap({
    display: {
      factory: displayGadgetFactory,
      icon: '📺',
      name: 'Display',
      description: 'Shows incoming values'
    }
  });

  return {
    math: mathCategory,
    data: dataCategory,
    visual: visualCategory
  };
};

// Generic gadget node component
export function GadgetNode({ id, data }: { id: string; data: any }) {
  const Component = data?.Component;
  const gadget = data?.gadget;

  if (!Component || !gadget) {
    return (
      <div style={{ padding: '10px', border: '1px solid red', color: 'red' }}>
        Unknown gadget type
      </div>
    );
  }

  return <Component gadget={gadget} id={id} />;
}