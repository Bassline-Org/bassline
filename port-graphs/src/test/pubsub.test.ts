/**
 * Tests for the PubSub architecture
 *
 * Shows that pubsub is just cells and functions:
 * - Registry is just a firstMap
 * - Subscriptions is a cell
 * - PubSub is a function gadget
 */

import { describe, it, expect } from 'vitest';
import { createPubSubSystem, subscriptions } from '../patterns/meta/routing';
import { firstMap } from '../patterns/cells/maps';
import { maxCell } from '../patterns/cells/numeric';
import { createGadget } from '../core';

describe('PubSub Architecture', () => {
  describe('Subscriptions Cell', () => {
    it('should manage subscriptions', () => {
      const subs = subscriptions({});
      const emissions: any[] = [];
      subs.emit = (effect) => emissions.push(effect);

      // Subscribe
      subs.receive({ type: 'subscribe', topic: 'news', subscriber: 'alice' });
      expect(subs.current()['news']).toEqual(['alice']);

      // Subscribe another
      subs.receive({ type: 'subscribe', topic: 'news', subscriber: 'bob' });
      expect(subs.current()['news']).toEqual(['alice', 'bob']);

      // Unsubscribe
      subs.receive({ type: 'unsubscribe', topic: 'news', subscriber: 'alice' });
      expect(subs.current()['news']).toEqual(['bob']);

      // Unsubscribe last
      subs.receive({ type: 'unsubscribe', topic: 'news', subscriber: 'bob' });
      expect(subs.current()['news']).toBe(undefined);
    });

    it('should ignore duplicate subscriptions', () => {
      const subs = subscriptions({});
      const emissions: any[] = [];
      subs.emit = (effect) => emissions.push(effect);

      subs.receive({ type: 'subscribe', topic: 'alerts', subscriber: 'charlie' });
      emissions.length = 0;

      subs.receive({ type: 'subscribe', topic: 'alerts', subscriber: 'charlie' }); // Duplicate
      expect(emissions.length).toBe(0); // No emission
    });
  });

  describe('Registry as firstMap', () => {
    it('should accumulate gadget references', () => {
      const registry = firstMap({});
      const gadget1 = maxCell(0);
      const gadget2 = maxCell(0);

      registry.receive({ node1: gadget1 });
      expect(registry.current()).toEqual({ node1: gadget1 });

      registry.receive({ node2: gadget2 });
      expect(registry.current()).toEqual({ node1: gadget1, node2: gadget2 });

      // First wins
      registry.receive({ node1: gadget2 });
      expect(registry.current()).toEqual({ node1: gadget1, node2: gadget2 });
    });
  });

  describe('PubSub Function', () => {
    it('should deliver messages to subscribers', () => {
      const { registry, subscriptions: subs, pubsub } = createPubSubSystem();
      const received: any[] = [];

      // Create test gadgets
      const listener1 = createGadget(
        (state, data) => ({ action: 'record', context: data }),
        { 'record': (g, data) => { received.push({ id: 'listener1', data }); return null; } }
      )([]);

      const listener2 = createGadget(
        (state, data) => ({ action: 'record', context: data }),
        { 'record': (g, data) => { received.push({ id: 'listener2', data }); return null; } }
      )([]);

      // Register gadgets
      registry.receive({ listener1, listener2 });

      // Subscribe to topic
      subs.receive({ type: 'subscribe', topic: 'events', subscriber: 'listener1' });
      subs.receive({ type: 'subscribe', topic: 'events', subscriber: 'listener2' });

      // Publish to topic
      pubsub.receive({ command: { type: 'publish', topic: 'events', data: 'hello' } });

      expect(received).toEqual([
        { id: 'listener1', data: 'hello' },
        { id: 'listener2', data: 'hello' }
      ]);
    });

    it('should only deliver to actual subscribers', () => {
      const { registry, subscriptions: subs, pubsub } = createPubSubSystem();
      const received: any[] = [];

      const listener = createGadget(
        (state, data) => ({ action: 'record', context: data }),
        { 'record': (g, data) => { received.push(data); return null; } }
      )([]);

      registry.receive({ listener });

      // Don't subscribe
      // Try to publish
      pubsub.receive({ command: { type: 'publish', topic: 'events', data: 'hello' } });

      expect(received).toEqual([]); // Nothing received
    });

    it('should handle multiple topics independently', () => {
      const { registry, subscriptions: subs, pubsub } = createPubSubSystem();
      const newsReceived: any[] = [];
      const alertsReceived: any[] = [];

      const newsListener = createGadget(
        (state, data) => ({ action: 'record', context: data }),
        { 'record': (g, data) => { newsReceived.push(data); return null; } }
      )([]);

      const alertListener = createGadget(
        (state, data) => ({ action: 'record', context: data }),
        { 'record': (g, data) => { alertsReceived.push(data); return null; } }
      )([]);

      registry.receive({ newsListener, alertListener });

      // Subscribe to different topics
      subs.receive({ type: 'subscribe', topic: 'news', subscriber: 'newsListener' });
      subs.receive({ type: 'subscribe', topic: 'alerts', subscriber: 'alertListener' });

      // Publish to news
      pubsub.receive({ command: { type: 'publish', topic: 'news', data: 'breaking' } });
      expect(newsReceived).toEqual(['breaking']);
      expect(alertsReceived).toEqual([]);

      // Publish to alerts
      pubsub.receive({ command: { type: 'publish', topic: 'alerts', data: 'warning' } });
      expect(newsReceived).toEqual(['breaking']);
      expect(alertsReceived).toEqual(['warning']);
    });

    it('should handle dynamic subscriptions', () => {
      const { registry, subscriptions: subs, pubsub } = createPubSubSystem();
      const received: any[] = [];

      const listener = createGadget(
        (state, data) => ({ action: 'record', context: data }),
        { 'record': (g, data) => { received.push(data); return null; } }
      )([]);

      registry.receive({ listener });

      // Publish before subscription
      pubsub.receive({ command: { type: 'publish', topic: 'events', data: 'msg1' } });
      expect(received).toEqual([]);

      // Subscribe - function gadget recomputes with pending command
      subs.receive({ type: 'subscribe', topic: 'events', subscriber: 'listener' });
      expect(received).toEqual(['msg1']); // Message delivered on recompute

      // Now publish new message
      pubsub.receive({ command: { type: 'publish', topic: 'events', data: 'msg2' } });
      expect(received).toEqual(['msg1', 'msg2']);

      // Unsubscribe
      subs.receive({ type: 'unsubscribe', topic: 'events', subscriber: 'listener' });

      // Publish after unsubscribe - function still has msg2 command but no subscribers
      pubsub.receive({ command: { type: 'publish', topic: 'events', data: 'msg3' } });
      expect(received).toEqual(['msg1', 'msg2']); // No new message
    });

    it('should recompute when subscriptions change', () => {
      const { registry, subscriptions: subs, pubsub } = createPubSubSystem();
      const received: any[] = [];

      const listener = createGadget(
        (state, data) => ({ action: 'record', context: data }),
        { 'record': (g, data) => { received.push(data); return null; } }
      )([]);

      registry.receive({ listener });

      // Send publish command first (before subscription)
      pubsub.receive({ command: { type: 'publish', topic: 'live', data: 'update' } });
      expect(received).toEqual([]);

      // Now subscribe - pubsub recomputes and delivers the pending message
      // Function gadgets hold arguments and recompute when any input changes
      subs.receive({ type: 'subscribe', topic: 'live', subscriber: 'listener' });
      expect(received).toEqual(['update']); // Message delivered on recompute

      // Send a new publish after subscription
      pubsub.receive({ command: { type: 'publish', topic: 'live', data: 'update2' } });
      expect(received).toEqual(['update', 'update2']);
    });
  });

  describe('Complete PubSub System', () => {
    it('should wire registry, subscriptions, and pubsub together', () => {
      const { registry, subscriptions: subs, pubsub } = createPubSubSystem();

      // Check initial state
      expect(registry.current()).toEqual({});
      expect(subs.current()).toEqual({});
      expect(pubsub.current().subscriptions).toEqual({});
      expect(pubsub.current().gadgets).toEqual({});
    });

    it('should auto-update pubsub when registry changes', () => {
      const { registry, pubsub } = createPubSubSystem();
      const testGadget = maxCell(0);

      registry.receive({ test: testGadget });

      // PubSub should have received the updated gadgets
      expect(pubsub.current().gadgets).toEqual({ test: testGadget });
    });

    it('should auto-update pubsub when subscriptions change', () => {
      const { subscriptions: subs, pubsub } = createPubSubSystem();

      subs.receive({ type: 'subscribe', topic: 'foo', subscriber: 'bar' });

      // PubSub should have received the updated subscriptions
      expect(pubsub.current().subscriptions).toEqual({ foo: ['bar'] });
    });
  });
});