import { z } from 'zod';
import type { Lattice, ValidatedLattice } from '../core/lattice';
import { ContactId, WireId } from '../core/types';

/**
 * Contact value store - manages runtime state for contacts in the propagation network.
 * Each contact holds a value that changes monotonically according to its lattice.
 */

export interface ContactValue<T = unknown> {
  id: ContactId;
  value: T;
  lattice: Lattice<T>;
  version: number; // Increments on each change for change detection
  lastUpdated: number; // Timestamp
}

export interface ContactConnection {
  wireId: WireId;
  fromContact: ContactId;
  toContact: ContactId;
  isActive: boolean;
}

export class ContactStore {
  private contacts = new Map<ContactId, ContactValue>();
  private connections = new Map<ContactId, Set<ContactConnection>>();
  private changeListeners = new Set<(contactId: ContactId, oldValue: unknown, newValue: unknown) => void>();
  
  constructor() {}
  
  /**
   * Register a new contact with its lattice
   */
  registerContact<T>(
    id: ContactId,
    lattice: Lattice<T>,
    initialValue?: T
  ): void {
    if (this.contacts.has(id)) {
      throw new Error(`Contact ${id} already registered`);
    }
    
    const value = initialValue ?? lattice.bottom();
    this.contacts.set(id, {
      id,
      value,
      lattice: lattice as Lattice<unknown>,
      version: 0,
      lastUpdated: Date.now()
    });
    
    // Initialize connection set
    this.connections.set(id, new Set());
  }
  
  /**
   * Update a contact's value by joining with new value
   * Returns true if the value changed
   */
  updateValue<T>(
    id: ContactId,
    newValue: T
  ): boolean {
    const contact = this.contacts.get(id);
    if (!contact) {
      throw new Error(`Contact ${id} not found`);
    }
    
    const lattice = contact.lattice as Lattice<T>;
    const oldValue = contact.value as T;
    
    // Join with existing value
    const joinedValue = lattice.join(oldValue, newValue);
    
    // Check if value actually changed
    // Simple equality check - if the joined value equals the old value, no change
    if (joinedValue === oldValue) {
      return false;
    }
    
    // Update the contact
    contact.value = joinedValue;
    contact.version++;
    contact.lastUpdated = Date.now();
    
    // Notify listeners
    for (const listener of this.changeListeners) {
      listener(id, oldValue, joinedValue);
    }
    
    return true;
  }
  
  /**
   * Get the current value of a contact
   */
  getValue<T>(id: ContactId): T | undefined {
    const contact = this.contacts.get(id);
    return contact?.value as T;
  }
  
  /**
   * Get full contact info
   */
  getContact(id: ContactId): ContactValue | undefined {
    return this.contacts.get(id);
  }
  
  /**
   * Add a wire connection between contacts
   */
  addConnection(
    wireId: WireId,
    fromContact: ContactId,
    toContact: ContactId
  ): void {
    const connection: ContactConnection = {
      wireId,
      fromContact,
      toContact,
      isActive: true
    };
    
    // Add to both contacts' connection sets
    const fromConnections = this.connections.get(fromContact);
    const toConnections = this.connections.get(toContact);
    
    if (!fromConnections || !toConnections) {
      throw new Error('One or both contacts not found');
    }
    
    fromConnections.add(connection);
    toConnections.add(connection);
  }
  
  /**
   * Remove a wire connection
   */
  removeConnection(wireId: WireId): void {
    // Find and remove from all contact connection sets
    for (const connections of this.connections.values()) {
      for (const conn of connections) {
        if (conn.wireId === wireId) {
          connections.delete(conn);
        }
      }
    }
  }
  
  /**
   * Get all connections for a contact
   */
  getConnections(id: ContactId): Set<ContactConnection> {
    return this.connections.get(id) || new Set();
  }
  
  /**
   * Get contacts that would receive propagation from this contact
   */
  getDownstreamContacts(id: ContactId): ContactId[] {
    const connections = this.connections.get(id);
    if (!connections) return [];
    
    const downstream: ContactId[] = [];
    for (const conn of connections) {
      if (conn.isActive && conn.fromContact === id) {
        downstream.push(conn.toContact);
      }
    }
    return downstream;
  }
  
  /**
   * Subscribe to value changes
   */
  onChange(
    listener: (contactId: ContactId, oldValue: unknown, newValue: unknown) => void
  ): () => void {
    this.changeListeners.add(listener);
    return () => this.changeListeners.delete(listener);
  }
  
  /**
   * Clear all data
   */
  clear(): void {
    this.contacts.clear();
    this.connections.clear();
    this.changeListeners.clear();
  }
  
  /**
   * Get statistics about the store
   */
  getStats() {
    return {
      contactCount: this.contacts.size,
      connectionCount: Array.from(this.connections.values())
        .reduce((sum, conns) => sum + conns.size, 0) / 2, // Divide by 2 since connections are bidirectional
      listenerCount: this.changeListeners.size
    };
  }
}