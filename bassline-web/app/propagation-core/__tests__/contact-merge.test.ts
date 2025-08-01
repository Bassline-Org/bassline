import { describe, it, expect } from 'vitest';
import { Contact } from '../models/Contact2';
import { ContactGroup } from '../models/ContactGroup';
import { Wire } from '../models/Wire';
import { NumericContent, SimpleContent, Contradiction } from '../models/MergeableContent';

describe('Contact Merge Strategies', () => {
  describe('merge strategy (default)', () => {
    it('should use content merge semantics', () => {
      const contact = new Contact('c1', { x: 0, y: 0 }, 'merge');
      
      // Set initial numeric value
      contact.setContent(new NumericContent(42));
      expect(contact.getValue()).toBe(42);
      
      // Same value - no contradiction
      contact.setContent(new NumericContent(42));
      expect(contact.getValue()).toBe(42);
      expect(contact.hasContradiction()).toBe(false);
      
      // Different value - contradiction
      contact.setContent(new NumericContent(43));
      expect(contact.hasContradiction()).toBe(true);
      expect(contact.getValue()).toBeNull();
    });

    it('should not propagate contradictions', () => {
      const group = new ContactGroup('g1', 'Test');
      const c1 = new Contact('c1', { x: 0, y: 0 }, 'merge');
      const c2 = new Contact('c2', { x: 100, y: 0 }, 'merge');
      
      group.addContact(c1);
      group.addContact(c2);
      group.addWire(new Wire('w1', 'c1', 'c2', group.id));
      
      // Set initial value
      c1.setContent(new NumericContent(42));
      expect(c2.getValue()).toBe(42);
      
      // Create contradiction in c1
      c1.setContent(new NumericContent(43));
      expect(c1.hasContradiction()).toBe(true);
      
      // c2 should still have old value (contradiction doesn't propagate)
      expect(c2.getValue()).toBe(42);
      expect(c2.hasContradiction()).toBe(false);
    });
  });

  describe('last strategy', () => {
    it('should always accept incoming value', () => {
      const contact = new Contact('c1', { x: 0, y: 0 }, 'last');
      
      contact.setContent(new NumericContent(42));
      expect(contact.getValue()).toBe(42);
      
      // Different value - accepted (no contradiction)
      contact.setContent(new NumericContent(43));
      expect(contact.getValue()).toBe(43);
      expect(contact.hasContradiction()).toBe(false);
      
      // Different type - also accepted
      contact.setContent(new SimpleContent('text'));
      expect(contact.getValue()).toBe('text');
      expect(contact.hasContradiction()).toBe(false);
    });
  });

  describe('first strategy', () => {
    it('should keep first value and ignore updates', () => {
      const contact = new Contact('c1', { x: 0, y: 0 }, 'first');
      
      contact.setContent(new NumericContent(42));
      expect(contact.getValue()).toBe(42);
      
      // Try to change - ignored
      contact.setContent(new NumericContent(43));
      expect(contact.getValue()).toBe(42); // Still 42
      expect(contact.hasContradiction()).toBe(false);
      
      // Try different type - also ignored
      contact.setContent(new SimpleContent('text'));
      expect(contact.getValue()).toBe(42); // Still 42
    });
  });

  describe('propagation with different strategies', () => {
    it('should handle mixed strategies in a network', () => {
      const group = new ContactGroup('g1', 'Test');
      
      // c1: merge strategy (strict)
      // c2: last strategy (permissive) 
      // c3: first strategy (stubborn)
      const c1 = new Contact('c1', { x: 0, y: 0 }, 'merge');
      const c2 = new Contact('c2', { x: 100, y: 0 }, 'last');
      const c3 = new Contact('c3', { x: 200, y: 0 }, 'first');
      
      group.addContact(c1);
      group.addContact(c2);
      group.addContact(c3);
      
      // Wire: c1 -> c2 -> c3
      group.addWire(new Wire('w1', 'c1', 'c2', group.id));
      group.addWire(new Wire('w2', 'c2', 'c3', group.id));
      
      // Initial propagation
      c1.setContent(new NumericContent(42));
      expect(c1.getValue()).toBe(42);
      expect(c2.getValue()).toBe(42);
      expect(c3.getValue()).toBe(42);
      
      // Update c2 directly (last strategy accepts it)
      c2.setContent(new NumericContent(100));
      expect(c2.getValue()).toBe(100);
      expect(c3.getValue()).toBe(42); // c3 keeps first value
      
      // Try to update c1 with different value
      c1.setContent(new NumericContent(43));
      expect(c1.hasContradiction()).toBe(true); // Contradiction in c1
      expect(c2.getValue()).toBe(100); // c2 unchanged
      expect(c3.getValue()).toBe(42);  // c3 unchanged
    });
  });
});