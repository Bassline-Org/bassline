import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WatchedGraph } from '../src/algebra/watch.js';
import { quad } from '../src/algebra/quad.js';
import { word } from '../src/types.js';
import {
  createRegistry,
  registerAction,
  ref,
  BaseMirror,
  Cell
} from '../src/mirror/index.js';

describe('Middleware Pipeline', () => {
  let graph;
  let registry;

  beforeEach(() => {
    graph = new WatchedGraph();
    registry = createRegistry();
    graph.setRegistry(registry);
  });

  afterEach(() => {
    registry.dispose();
  });

  describe('Standalone ref triggers', () => {
    it('should trigger action when ref is inserted', () => {
      const calls = [];
      registerAction(registry, 'tracker', (params, g, r) => {
        calls.push({ params, hasGraph: !!g, hasRef: !!r });
      });

      graph.add(ref('bl:///action/tracker?event=click&id=123'));

      expect(calls).toHaveLength(1);
      expect(calls[0].params).toEqual({ event: 'click', id: '123' });
      expect(calls[0].hasGraph).toBe(true);
      expect(calls[0].hasRef).toBe(true);
    });

    it('should not store standalone refs in the graph', () => {
      registerAction(registry, 'noop', () => {});

      graph.add(ref('bl:///action/noop'));

      // Graph should be empty - standalone refs are not stored
      expect(graph.size).toBe(0);
    });

    it('should handle multiple action triggers', () => {
      const calls = [];
      registerAction(registry, 'log', (params) => {
        calls.push(params.message);
      });

      graph.add(ref('bl:///action/log?message=first'));
      graph.add(ref('bl:///action/log?message=second'));
      graph.add(ref('bl:///action/log?message=third'));

      expect(calls).toEqual(['first', 'second', 'third']);
    });

    it('should allow action to insert quads into graph', () => {
      registerAction(registry, 'insert', (params, g) => {
        g.add(quad(word('from-action'), word('attr'), parseInt(params.val)));
      });

      graph.add(ref('bl:///action/insert?val=42'));

      // Verify quad was inserted
      expect(graph.size).toBe(1);
      const quads = graph.quads;
      expect(quads.length).toBe(1);
      // Check the quad was inserted correctly
      expect(quads[0].value).toBe(42);
    });
  });

  describe('Quad middleware interception', () => {
    it('should call onInsert for refs in value slot', () => {
      let insertCalled = false;
      let insertedValue = null;

      // Register a custom action that tracks inserts
      registerAction(registry, 'tracker', () => {});

      // Get the action mirror and override its onInsert
      const actionMirror = registry.lookup(ref('bl:///action/tracker'));
      actionMirror.onInsert = (q, g) => {
        insertCalled = true;
        insertedValue = q.value;
        return true;
      };

      const testRef = ref('bl:///action/tracker');
      graph.add(quad(
        word('entity'),
        word('source'),
        testRef
      ));

      expect(insertCalled).toBe(true);
      // The value should be the ref we inserted
      expect(insertedValue).toBe(testRef);
    });

    it('should call onInsert for refs in context slot', () => {
      const insertedQuads = [];

      registerAction(registry, 'ctx-tracker', () => {});
      const actionMirror = registry.lookup(ref('bl:///action/ctx-tracker'));
      actionMirror.onInsert = (q, g) => {
        insertedQuads.push(q);
        return true;
      };

      graph.add(quad(
        word('alice'),
        word('age'),
        30,
        ref('bl:///action/ctx-tracker')
      ));

      expect(insertedQuads).toHaveLength(1);
      expect(insertedQuads[0].value).toBe(30);
    });

    it('should block insert when onInsert returns false', () => {
      registerAction(registry, 'blocker', () => {});
      const actionMirror = registry.lookup(ref('bl:///action/blocker'));
      actionMirror.onInsert = (q, g) => false; // Block all inserts

      graph.add(quad(
        word('entity'),
        word('attr'),
        ref('bl:///action/blocker')
      ));

      // Quad should not be in the graph
      expect(graph.size).toBe(0);
    });

    it('should allow insert when onInsert returns true', () => {
      registerAction(registry, 'allower', () => {});
      const actionMirror = registry.lookup(ref('bl:///action/allower'));
      actionMirror.onInsert = (q, g) => true;

      graph.add(quad(
        word('entity'),
        word('attr'),
        ref('bl:///action/allower')
      ));

      expect(graph.size).toBe(1);
    });

    it('should run all middleware even if one blocks', () => {
      const calls = [];

      registerAction(registry, 'tracker-a', () => {});
      registerAction(registry, 'tracker-b', () => {});

      const mirrorA = registry.lookup(ref('bl:///action/tracker-a'));
      const mirrorB = registry.lookup(ref('bl:///action/tracker-b'));

      mirrorA.onInsert = (q, g) => {
        calls.push('A');
        return false; // Block
      };
      mirrorB.onInsert = (q, g) => {
        calls.push('B');
        return true; // Allow
      };

      // Quad with both refs
      graph.add(quad(
        word('entity'),
        word('attr'),
        ref('bl:///action/tracker-a'),
        ref('bl:///action/tracker-b')
      ));

      // Both should have been called
      expect(calls).toContain('A');
      expect(calls).toContain('B');
      // But insert should be blocked
      expect(graph.size).toBe(0);
    });

    it('should work without registry set', () => {
      const graphNoRegistry = new WatchedGraph();

      // Should not throw even though refs can't be resolved
      graphNoRegistry.add(quad(
        word('entity'),
        word('attr'),
        word('value')
      ));

      expect(graphNoRegistry.size).toBe(1);
    });

    it('should pass correct graph reference to onInsert', () => {
      let capturedGraph = null;

      registerAction(registry, 'capturer', () => {});
      const mirror = registry.lookup(ref('bl:///action/capturer'));
      mirror.onInsert = (q, g) => {
        capturedGraph = g;
        return true;
      };

      graph.add(quad(
        word('test'),
        word('ref'),
        ref('bl:///action/capturer')
      ));

      expect(capturedGraph).toBe(graph);
    });
  });

  describe('Registry integration', () => {
    it('should get and set registry', () => {
      expect(graph.getRegistry()).toBe(registry);

      const newRegistry = createRegistry();
      graph.setRegistry(newRegistry);
      expect(graph.getRegistry()).toBe(newRegistry);
      newRegistry.dispose();
    });

    it('should handle null registry gracefully', () => {
      graph.setRegistry(null);

      // Should not throw
      graph.add(ref('bl:///action/test'));
      graph.add(quad(word('a'), word('b'), ref('bl:///cell/c')));
    });
  });
});
