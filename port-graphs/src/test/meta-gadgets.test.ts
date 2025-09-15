/**
 * Tests for Meta-Gadgets
 *
 * These tests demonstrate that meta-gadgets are just regular gadgets
 * that happen to manage other gadgets. The network builds itself!
 */

import { describe, it, expect } from 'vitest';
import { createGadget } from '../core';
import {
  createRouter,
  registerGadget,
  createPubSub,
  connectPubSubToRouter
} from '../patterns/meta';
import { maxCell } from '../patterns/cells/numeric';
import { changed } from '../effects';

describe('Router Meta-Gadget', () => {
  it('should manage connections between gadgets', () => {
    const router = createRouter();
    const emissions: any[] = [];
    router.emit = (effect) => emissions.push(effect);

    // Create some test gadgets
    const source = maxCell(0);
    const target1 = maxCell(100);
    const target2 = maxCell(200);

    // Register gadgets with the router
    registerGadget(router, 'source', source);
    registerGadget(router, 'target1', target1);
    registerGadget(router, 'target2', target2);

    // Connect source to target1
    router.receive({ type: 'connect', from: 'source', to: 'target1' });
    expect(emissions[0]).toEqual(changed({
      connected: { from: 'source', to: 'target1' }
    }));

    // Connect source to target2
    router.receive({ type: 'connect', from: 'source', to: 'target2' });
    expect(emissions[1]).toEqual(changed({
      connected: { from: 'source', to: 'target2' }
    }));

    // Verify route table
    expect(router.current().routes.get('source')).toEqual(new Set(['target1', 'target2']));
  });

  it('should forward messages through routes', () => {
    const router = createRouter();
    const emissions: any[] = [];
    router.emit = (effect) => emissions.push(effect);

    // Create test gadgets that track received data
    const receivedData: any[] = [];
    const target1 = createGadget<any[], any>(
      (_current, incoming) => ({ action: 'collect', context: { data: incoming } }),
      {
        'collect': (g, { data }) => {
          const updated = [...g.current(), data];
          g.update(updated);
          receivedData.push({ target: 'target1', data });
          return changed(updated);
        }
      }
    )([]);

    const target2 = createGadget<any[], any>(
      (_current, incoming) => ({ action: 'collect', context: { data: incoming } }),
      {
        'collect': (g, { data }) => {
          const updated = [...g.current(), data];
          g.update(updated);
          receivedData.push({ target: 'target2', data });
          return changed(updated);
        }
      }
    )([]);

    // Register and connect
    registerGadget(router, 'source', maxCell(0));
    registerGadget(router, 'target1', target1);
    registerGadget(router, 'target2', target2);

    router.receive({ type: 'connect', from: 'source', to: 'target1' });
    router.receive({ type: 'connect', from: 'source', to: 'target2' });

    // Send a message
    router.receive({
      type: 'send',
      from: 'source',
      to: ['target1', 'target2'],
      data: { message: 'hello' }
    });

    // Verify both targets received the message
    expect(receivedData).toEqual([
      { target: 'target1', data: { message: 'hello' } },
      { target: 'target2', data: { message: 'hello' } }
    ]);
  });

  it('should handle broadcast messages', () => {
    const router = createRouter();

    // Create collectors
    const collectors: Record<string, any[]> = {
      a: [],
      b: [],
      c: []
    };

    ['a', 'b', 'c'].forEach(id => {
      const collector = createGadget<any[], any>(
        (_current, incoming) => ({ action: 'collect', context: { data: incoming } }),
        {
          'collect': (_gadget, { data }) => {
            collectors[id]!.push(data);
            return null;
          }
        }
      )([]);
      registerGadget(router, id, collector);
    });

    // Connect source to all targets
    router.receive({ type: 'connect', from: 'source', to: 'a' });
    router.receive({ type: 'connect', from: 'source', to: 'b' });
    router.receive({ type: 'connect', from: 'source', to: 'c' });

    // Broadcast
    router.receive({
      type: 'broadcast',
      from: 'source',
      data: 'broadcast message'
    });

    // All should receive
    expect(collectors['a']).toEqual(['broadcast message']);
    expect(collectors['b']).toEqual(['broadcast message']);
    expect(collectors['c']).toEqual(['broadcast message']);
  });

  it('should handle disconnections', () => {
    const router = createRouter();
    const emissions: any[] = [];
    router.emit = (effect) => emissions.push(effect);

    registerGadget(router, 'source', maxCell(0));
    registerGadget(router, 'target', maxCell(0));

    // Connect
    router.receive({ type: 'connect', from: 'source', to: 'target' });
    expect(router.current().routes.get('source')).toEqual(new Set(['target']));

    emissions.length = 0;

    // Disconnect
    router.receive({ type: 'disconnect', from: 'source', to: 'target' });
    expect(router.current().routes.get('source')).toBe(undefined);
    expect(emissions[0]).toEqual(changed({
      disconnected: { from: 'source', to: 'target' }
    }));
  });
});

describe('PubSub Meta-Gadget', () => {
  it('should track subscriptions', () => {
    const pubsub = createPubSub();
    const emissions: any[] = [];
    pubsub.emit = (effect) => emissions.push(effect);

    // Subscribe
    pubsub.receive({
      type: 'subscribe',
      topic: 'news',
      subscriber: 'reader1'
    });

    expect(pubsub.current().get('news')).toEqual(new Set(['reader1']));

    // Check emitted effect includes routing instruction
    const effect = emissions[0];
    expect(effect.changed.subscribed).toEqual({
      topic: 'news',
      subscriber: 'reader1'
    });
    expect(effect.changed.route).toEqual({
      type: 'connect',
      from: 'news',
      to: 'reader1'
    });
  });

  it('should emit routing instructions for publishing', () => {
    const pubsub = createPubSub();
    const emissions: any[] = [];
    pubsub.emit = (effect) => emissions.push(effect);

    // Subscribe multiple
    pubsub.receive({ type: 'subscribe', topic: 'events', subscriber: 'handler1' });
    pubsub.receive({ type: 'subscribe', topic: 'events', subscriber: 'handler2' });

    emissions.length = 0;

    // Publish
    pubsub.receive({
      type: 'publish',
      topic: 'events',
      data: { event: 'click' }
    });

    // Should emit routing instruction
    const effect = emissions[0];
    expect(effect.changed.route).toEqual({
      type: 'send',
      from: 'events',
      to: ['handler1', 'handler2'],
      data: { event: 'click' }
    });
  });

  it('should handle unsubscribe', () => {
    const pubsub = createPubSub();
    const emissions: any[] = [];
    pubsub.emit = (effect) => emissions.push(effect);

    // Subscribe
    pubsub.receive({ type: 'subscribe', topic: 'updates', subscriber: 'watcher' });
    expect(pubsub.current().get('updates')).toEqual(new Set(['watcher']));

    emissions.length = 0;

    // Unsubscribe
    pubsub.receive({ type: 'unsubscribe', topic: 'updates', subscriber: 'watcher' });
    expect(pubsub.current().get('updates')).toBe(undefined);

    // Should emit disconnect routing instruction
    expect(emissions[0].changed.route).toEqual({
      type: 'disconnect',
      from: 'updates',
      to: 'watcher'
    });
  });
});

describe('Composed Meta-Gadgets', () => {
  it('should work together: pubsub using router for delivery', () => {
    // Create the infrastructure
    const router = createRouter();
    const pubsub = createPubSub();

    // Connect pubsub to router - meta-gadgets talking!
    connectPubSubToRouter(pubsub, router);

    // Create actual gadgets to receive messages
    const messagesReceived: any[] = [];
    const subscriber1 = createGadget<any[], any>(
      (_current, incoming) => ({ action: 'log', context: { data: incoming } }),
      {
        'log': (_gadget, { data }) => {
          messagesReceived.push({ subscriber: 'sub1', data });
          return null;
        }
      }
    )([]);

    const subscriber2 = createGadget<any[], any>(
      (_current, incoming) => ({ action: 'log', context: { data: incoming } }),
      {
        'log': (_gadget, { data }) => {
          messagesReceived.push({ subscriber: 'sub2', data });
          return null;
        }
      }
    )([]);

    // Register gadgets with router
    registerGadget(router, 'sub1', subscriber1);
    registerGadget(router, 'sub2', subscriber2);
    registerGadget(router, 'news', subscriber1); // Topic 'news' routes to subscriber1

    // Subscribe through pubsub
    pubsub.receive({ type: 'subscribe', topic: 'news', subscriber: 'sub1' });
    pubsub.receive({ type: 'subscribe', topic: 'news', subscriber: 'sub2' });

    // Publish through pubsub
    pubsub.receive({
      type: 'publish',
      topic: 'news',
      data: { headline: 'Meta-gadgets work!' }
    });

    // Both subscribers should have received the message!
    expect(messagesReceived).toEqual([
      { subscriber: 'sub1', data: { headline: 'Meta-gadgets work!' } },
      { subscriber: 'sub2', data: { headline: 'Meta-gadgets work!' } }
    ]);
  });

  it('demonstrates that meta-gadgets are just gadgets', () => {
    // The router is just a gadget
    const router = createRouter();
    expect(router.receive).toBeDefined();
    expect(router.emit).toBeDefined();
    expect(router.current).toBeDefined();
    expect(router.update).toBeDefined();

    // The pubsub is just a gadget
    const pubsub = createPubSub();
    expect(pubsub.receive).toBeDefined();
    expect(pubsub.emit).toBeDefined();
    expect(pubsub.current).toBeDefined();
    expect(pubsub.update).toBeDefined();

    // They follow the same protocol as any other gadget!
    // receive data → consider → act → emit effects
  });

  it('shows the network building itself', () => {
    const router = createRouter();
    const pubsub = createPubSub();
    connectPubSubToRouter(pubsub, router);

    // Track all routing table changes
    const routingChanges: any[] = [];
    const originalEmit = router.emit;
    router.emit = (effect) => {
      originalEmit(effect);
      if (effect && typeof effect === 'object' && 'changed' in effect) {
        routingChanges.push(effect.changed);
      }
    };

    // Register some gadgets
    registerGadget(router, 'sensor1', maxCell(0));
    registerGadget(router, 'sensor2', maxCell(0));
    registerGadget(router, 'display', maxCell(0));

    // The network builds itself through data!
    pubsub.receive({ type: 'subscribe', topic: 'temps', subscriber: 'display' });

    // The subscription caused a route to be created
    expect(routingChanges.some(change =>
      change.connected?.from === 'temps' && change.connected?.to === 'display'
    )).toBe(true);

    // This is the key insight: the network structure (routing) is being
    // modified by processing data (subscription commands), using the same
    // gadget protocol used for everything else!
  });
});