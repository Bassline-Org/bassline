import { describe, it, expect } from 'vitest';
import { Contact, BoundaryContact } from '../models/Contact';
import { ContactGroup } from '../models/ContactGroup';
import { Wire } from '../models/Wire';
import { AcceptLastValue, KeepFirstValue } from '../models/BlendModes';
import { QueuedScheduler } from '../models/Scheduler';

describe('Core Propagation', () => {
  it('should propagate values through a simple chain', () => {
    // Create a group
    const group = new ContactGroup('g1', 'Test Group');
    
    // Create three contacts in a chain: c1 -> c2 -> c3
    const c1 = new Contact('c1', { x: 0, y: 0 }, new AcceptLastValue());
    const c2 = new Contact('c2', { x: 100, y: 0 }, new AcceptLastValue());
    const c3 = new Contact('c3', { x: 200, y: 0 }, new AcceptLastValue());
    
    group.addContact(c1);
    group.addContact(c2);
    group.addContact(c3);
    
    // Wire them together
    group.addWire(new Wire('w1', 'c1', 'c2', group.id));
    group.addWire(new Wire('w2', 'c2', 'c3', group.id));
    
    // Set content on c1
    c1.setContent(42);
    
    // Should propagate through the chain
    expect(c1.content?.value).toBe(42);
    expect(c2.content?.value).toBe(42);
    expect(c3.content?.value).toBe(42);
  });

  it('should handle cycles without infinite loops', () => {
    const group = new ContactGroup('g1', 'Cycle Test');
    
    // Create a cycle: c1 -> c2 -> c3 -> c1
    const c1 = new Contact('c1', { x: 0, y: 0 }, new AcceptLastValue());
    const c2 = new Contact('c2', { x: 100, y: 0 }, new AcceptLastValue());
    const c3 = new Contact('c3', { x: 100, y: 100 }, new AcceptLastValue());
    
    group.addContact(c1);
    group.addContact(c2);
    group.addContact(c3);
    
    group.addWire(new Wire('w1', 'c1', 'c2', group.id));
    group.addWire(new Wire('w2', 'c2', 'c3', group.id));
    group.addWire(new Wire('w3', 'c3', 'c1', group.id));
    
    // Set content - should propagate but not loop forever
    c1.setContent('cyclic');
    
    expect(c1.content?.value).toBe('cyclic');
    expect(c2.content?.value).toBe('cyclic');
    expect(c3.content?.value).toBe('cyclic');
  });

  it('should use blend modes correctly', () => {
    const group = new ContactGroup('g1', 'Blend Test');
    
    // Create contacts - c1 accepts last value, c2 keeps first
    const c1 = new Contact('c1', { x: 0, y: 0 }, new AcceptLastValue());
    const c2 = new Contact('c2', { x: 100, y: 0 }, new KeepFirstValue());
    
    group.addContact(c1);
    group.addContact(c2);
    group.addWire(new Wire('w1', 'c1', 'c2', group.id));
    
    // Set initial values
    c1.setContent(10);
    expect(c2.content?.value).toBe(10);
    
    // Set another value - c1 accepts it, c2 keeps first
    c1.setContent(20);
    expect(c1.content?.value).toBe(20); // c1 accepts last value
    expect(c2.content?.value).toBe(10); // c2 keeps first value
  });

  it('should work with queued scheduler', () => {
    const scheduler = new QueuedScheduler();
    const group = new ContactGroup('g1', 'Scheduler Test');
    
    const c1 = new Contact('c1', { x: 0, y: 0 }, new AcceptLastValue());
    const c2 = new Contact('c2', { x: 100, y: 0 }, new AcceptLastValue());
    
    group.addContact(c1);
    group.addContact(c2);
    group.addWire(new Wire('w1', 'c1', 'c2', group.id));
    
    // Set content with queued scheduler
    c1.setContent('queued', scheduler);
    
    // Should not propagate yet
    expect(c1.content?.value).toBe('queued');
    expect(c2.content).toBeNull();
    expect(scheduler.hasPendingWork()).toBe(true);
    
    // Flush the queue
    scheduler.flush();
    
    // Now it should have propagated
    expect(c2.content?.value).toBe('queued');
    expect(scheduler.isQuiescent()).toBe(true);
  });

  it('should handle boundary contacts between groups', () => {
    const rootGroup = new ContactGroup('root', 'Root');
    const subgroup = new ContactGroup('sub', 'Subgroup');
    rootGroup.addSubgroup(subgroup);
    
    // Create a boundary contact in the subgroup
    const boundary = new BoundaryContact('b1', { x: 0, y: 50 }, new AcceptLastValue());
    subgroup.addContact(boundary);
    
    // Create regular contacts
    const c1 = new Contact('c1', { x: 0, y: 0 }, new AcceptLastValue());
    const c2 = new Contact('c2', { x: 200, y: 0 }, new AcceptLastValue());
    rootGroup.addContact(c1);
    rootGroup.addContact(c2);
    
    // Wire: c1 -> boundary -> c2
    rootGroup.addWire(new Wire('w1', 'c1', 'b1', rootGroup.id));
    rootGroup.addWire(new Wire('w2', 'b1', 'c2', rootGroup.id));
    
    // Set content on c1
    c1.setContent('through-boundary');
    
    // Should propagate through the boundary
    expect(c1.content?.value).toBe('through-boundary');
    expect(boundary.content?.value).toBe('through-boundary');
    expect(c2.content?.value).toBe('through-boundary');
  });
});