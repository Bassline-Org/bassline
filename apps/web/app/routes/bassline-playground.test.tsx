import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { factoryBassline, maxCell, minCell, lastCell, withTaps } from 'port-graphs';
import '@testing-library/jest-dom';

describe('Bassline Playground Logic', () => {
  it('should create and connect gadgets', () => {
    // Type registry
    const typeRegistry = {
      max: maxCell,
      min: minCell,
      last: lastCell,
    };

    // Create a bassline instance
    const bassline = withTaps(factoryBassline(typeRegistry));
    const effects: any[] = [];

    // Track effects
    bassline.tap(effect => effects.push(effect));

    // Create instances
    bassline.receive({ spawn: { name: 'sensor', type: 'max', args: [0] } });
    bassline.receive({ spawn: { name: 'processor', type: 'min', args: [100] } });
    bassline.receive({ spawn: { name: 'output', type: 'last', args: [null] } });

    // Check instances were created
    const state1 = bassline.current();
    expect(state1.instances['sensor']).toBeDefined();
    expect(state1.instances['processor']).toBeDefined();
    expect(state1.instances['output']).toBeDefined();

    // Create connections
    bassline.receive({
      connect: {
        id: 'sensor-processor',
        from: 'sensor',
        to: 'processor',
        pattern: 'extract'
      }
    });

    bassline.receive({
      connect: {
        id: 'processor-output',
        from: 'processor',
        to: 'output',
        pattern: 'extract'
      }
    });

    // Check connections were created
    const state2 = bassline.current();
    expect(Object.keys(state2.connections)).toHaveLength(2);

    // Test data flow
    const sensor = state2.instances['sensor'];
    const processor = state2.instances['processor'];
    const output = state2.instances['output'];

    // Send value through network
    sensor.receive(50);
    expect(sensor.current()).toBe(50);
    expect(processor.current()).toBe(50); // min(100, 50) = 50
    expect(output.current()).toBe(50);

    // Send another value
    sensor.receive(25);
    expect(sensor.current()).toBe(50); // max keeps 50
    expect(processor.current()).toBe(50); // min still has 50 (it receives from sensor which emits 50)
    expect(output.current()).toBe(50); // last takes what processor sends

    // Test deletion
    bassline.receive({ destroy: 'processor' });
    const state3 = bassline.current();
    expect(state3.instances['processor']).toBeUndefined();
    expect(Object.keys(state3.connections)).toHaveLength(0); // Connections cleaned up
  });

  it('should handle React Flow graph updates', () => {
    const typeRegistry = {
      max: maxCell,
      min: minCell,
      last: lastCell,
    };

    const bassline = withTaps(factoryBassline(typeRegistry));

    // Create instances
    bassline.receive({ spawn: { name: 'node1', type: 'max', args: [10] } });
    bassline.receive({ spawn: { name: 'node2', type: 'min', args: [20] } });

    const state = bassline.current();

    // Simulate graph node creation
    const nodes = Object.entries(state.instances).map(([name, gadget], index) => ({
      id: name,
      position: { x: 150 * index, y: 0 },
      data: {
        label: `${name}: ${gadget.current()}`
      }
    }));

    expect(nodes).toHaveLength(2);
    expect(nodes[0].data.label).toContain('10');
    expect(nodes[1].data.label).toContain('20');

    // Create connection
    bassline.receive({
      connect: {
        id: 'edge1',
        from: 'node1',
        to: 'node2',
        pattern: 'extract'
      }
    });

    // Simulate edge creation
    const edges = Object.entries(bassline.current().connections).map(([id, conn]: [string, any]) => ({
      id,
      source: conn.data.from,
      target: conn.data.to,
      animated: true
    }));

    expect(edges).toHaveLength(1);
    expect(edges[0].source).toBe('node1');
    expect(edges[0].target).toBe('node2');
  });
});