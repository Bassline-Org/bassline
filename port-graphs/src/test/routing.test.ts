/**
 * Tests for the simplified routing architecture
 *
 * Shows that routing can be built from existing patterns:
 * - Registry is just a firstMap
 * - RouteTable is a cell
 * - Router is a function gadget
 */

import { describe, it, expect } from 'vitest';
import { createRoutingSystem, routeTable } from '../patterns/meta/routing';
import { firstMap } from '../patterns/cells/maps';
import { maxCell } from '../patterns/cells/numeric';
import { createGadget } from '../core';

describe('Simplified Routing Architecture', () => {
  describe('RouteTable Cell', () => {
    it('should manage connections', () => {
      const routes = routeTable({});
      const emissions: any[] = [];
      routes.emit = (effect) => emissions.push(effect);

      // Connect
      routes.receive({ type: 'connect', from: 'a', to: 'b' });
      expect(routes.current()['a']).toEqual(['b']);

      // Connect another
      routes.receive({ type: 'connect', from: 'a', to: 'c' });
      expect(routes.current()['a']).toEqual(['b', 'c']);

      // Disconnect
      routes.receive({ type: 'disconnect', from: 'a', to: 'b' });
      expect(routes.current()['a']).toEqual(['c']);

      // Disconnect last
      routes.receive({ type: 'disconnect', from: 'a', to: 'c' });
      expect(routes.current()['a']).toBe(undefined);
    });

    it('should ignore duplicate connections', () => {
      const routes = routeTable({});
      const emissions: any[] = [];
      routes.emit = (effect) => emissions.push(effect);

      routes.receive({ type: 'connect', from: 'x', to: 'y' });
      emissions.length = 0;

      routes.receive({ type: 'connect', from: 'x', to: 'y' }); // Duplicate
      expect(emissions.length).toBe(0); // No emission
    });

    it('should ignore send/broadcast commands', () => {
      const routes = routeTable({});
      const before = routes.current();

      routes.receive({ type: 'send', from: 'a', to: 'b', data: 42 });
      routes.receive({ type: 'broadcast', from: 'a', data: 42 });

      expect(routes.current()).toBe(before); // Unchanged
    });
  });

  describe('Registry as firstMap', () => {
    it('should accumulate gadget references', () => {
      const registry = firstMap({});
      const g1 = maxCell(0);
      const g2 = maxCell(0);

      registry.receive({ node1: g1 });
      registry.receive({ node2: g2 });

      const current = registry.current();
      expect(current['node1']).toBe(g1);
      expect(current['node2']).toBe(g2);
    });

    it('should keep first value for duplicate keys', () => {
      const registry = firstMap({});
      const g1 = maxCell(1);
      const g2 = maxCell(2);

      registry.receive({ node: g1 });
      registry.receive({ node: g2 }); // Should be ignored

      expect(registry.current()['node']).toBe(g1);
    });
  });

  describe('Complete Routing System', () => {
    it('should wire registry and routes to router automatically', () => {
      const { registry, routes, router } = createRoutingSystem();

      // Create test gadgets that collect received data
      const received: any[] = [];
      const collector = (id: string) => createGadget<any[], any>(
        (_current, incoming) => ({ action: 'collect', context: { data: incoming } }),
        {
          'collect': (_g, { data }) => {
            received.push({ id, data });
            return null;
          }
        }
      )([]);

      const g1 = collector('g1');
      const g2 = collector('g2');
      const g3 = collector('g3');

      // Register gadgets
      registry.receive({ g1, g2, g3 });

      // Create routes
      routes.receive({ type: 'connect', from: 'source', to: 'g1' });
      routes.receive({ type: 'connect', from: 'source', to: 'g2' });

      // Send message
      router.receive({
        route: {
          type: 'send',
          from: 'source',
          to: ['g1', 'g2'],
          data: { msg: 'hello' }
        }
      });

      // Both should receive
      expect(received).toEqual([
        { id: 'g1', data: { msg: 'hello' } },
        { id: 'g2', data: { msg: 'hello' } }
      ]);

      // g3 should not receive (no route)
      expect(received.filter(r => r.id === 'g3')).toEqual([]);
    });

    it('should handle broadcast', () => {
      const { registry, routes, router } = createRoutingSystem();

      const received: any[] = [];
      const makeCollector = (id: string) => createGadget<any[], any>(
        (_current, incoming) => ({ action: 'collect', context: { data: incoming } }),
        {
          'collect': (_g, { data }) => {
            received.push({ id, data });
            return null;
          }
        }
      )([]);

      // Register multiple gadgets
      const gadgets = {
        a: makeCollector('a'),
        b: makeCollector('b'),
        c: makeCollector('c')
      };
      registry.receive(gadgets);

      // Connect all to source
      routes.receive({ type: 'connect', from: 'hub', to: 'a' });
      routes.receive({ type: 'connect', from: 'hub', to: 'b' });
      routes.receive({ type: 'connect', from: 'hub', to: 'c' });

      // Broadcast
      router.receive({
        route: {
          type: 'broadcast',
          from: 'hub',
          data: 'announcement'
        }
      });

      // All should receive
      expect(received).toContainEqual({ id: 'a', data: 'announcement' });
      expect(received).toContainEqual({ id: 'b', data: 'announcement' });
      expect(received).toContainEqual({ id: 'c', data: 'announcement' });
    });

    it('should update routing when routes change', () => {
      const { registry, routes, router } = createRoutingSystem();

      const received: any[] = [];
      const source = maxCell(0); // Need a source gadget
      const target = createGadget<any[], any>(
        (_current, incoming) => ({ action: 'log', context: { data: incoming } }),
        {
          'log': (_g, { data }) => {
            received.push(data);
            return null;
          }
        }
      )([]);

      // Register both source and target
      registry.receive({ source, target });

      // Send before route exists
      router.receive({
        route: { type: 'send', from: 'source', to: 'target', data: 1 }
      });
      expect(received).toEqual([]); // Nothing received (no route)

      // Create route - this will trigger delivery of message 1!
      routes.receive({ type: 'connect', from: 'source', to: 'target' });
      expect(received).toEqual([1]); // Message 1 delivered when route created

      // Send after route exists
      router.receive({
        route: { type: 'send', from: 'source', to: 'target', data: 2 }
      });
      expect(received).toEqual([1, 2]); // Both messages delivered

      // Disconnect
      routes.receive({ type: 'disconnect', from: 'source', to: 'target' });

      // Send after disconnect
      router.receive({
        route: { type: 'send', from: 'source', to: 'target', data: 3 }
      });
      expect(received).toEqual([1, 2]); // Still just 2
    });

    it('demonstrates that everything is just gadgets', () => {
      const { registry, routes, router } = createRoutingSystem();

      // Registry is a gadget (firstMap)
      expect(registry.receive).toBeDefined();
      expect(registry.emit).toBeDefined();
      expect(registry.current).toBeDefined();

      // Routes is a gadget (routeTable cell)
      expect(routes.receive).toBeDefined();
      expect(routes.emit).toBeDefined();
      expect(routes.current).toBeDefined();

      // Router is a gadget (function gadget)
      expect(router.receive).toBeDefined();
      expect(router.emit).toBeDefined();
      expect(router.current).toBeDefined();

      // They all follow consider → act!
    });
  });
});