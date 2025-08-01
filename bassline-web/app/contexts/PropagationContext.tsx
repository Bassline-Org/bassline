import React, { createContext, useContext, useRef, useCallback, useState, useEffect } from 'react';
import type { Contact, ContactGroup, ContactGroupWire, UUID } from '~/models/types';
import { ContactImpl } from '~/models/Contact';
import { BoundaryContactImpl } from '~/models/BoundaryContact';
import { ContactGroupImpl } from '~/models/ContactGroup';
import { ContactGroupWireImpl } from '~/models/ContactGroupWire';
import { PropagationEngine } from '~/models/PropagationEngine';
import { EventEmitter } from '~/utils/EventEmitter';
import type { BlendMode } from '~/models/types';
import { DEFAULT_BLEND_MODE } from '~/models/blendModes';

interface PropagationContextValue {
  rootGroup: ContactGroup | null;
  currentGroup: ContactGroup | null;
  eventEmitter: EventEmitter;
  propagationEngine: PropagationEngine;
  
  // Contact operations
  createContact: (position: { x: number; y: number }, blendMode?: BlendMode) => Contact;
  createBoundaryContact: (position: { x: number; y: number }, blendMode?: BlendMode) => BoundaryContactImpl;
  deleteContact: (contactId: UUID) => void;
  updateContactContent: (contactId: UUID, value: any) => void;
  
  // Wire operations
  createWire: (from: UUID, to: UUID) => ContactGroupWire | null;
  deleteWire: (wireId: UUID) => void;
  
  // Group operations
  createSubgroup: (name: string, position: { x: number; y: number }) => ContactGroup;
  navigateToGroup: (groupId: UUID) => void;
  navigateToParent: () => void;
  
  // State
  selectedContactId: UUID | null;
  setSelectedContactId: (id: UUID | null) => void;
}

const PropagationContext = createContext<PropagationContextValue | null>(null);

export const usePropagation = () => {
  const context = useContext(PropagationContext);
  if (!context) {
    throw new Error('usePropagation must be used within PropagationProvider');
  }
  return context;
};

interface PropagationProviderProps {
  children: React.ReactNode;
}

export const PropagationProvider: React.FC<PropagationProviderProps> = ({ children }) => {
  const eventEmitterRef = useRef(new EventEmitter());
  const propagationEngineRef = useRef(new PropagationEngine(eventEmitterRef.current));
  
  const [rootGroup, setRootGroup] = useState<ContactGroup | null>(null);
  const [currentGroup, setCurrentGroup] = useState<ContactGroup | null>(null);
  const [selectedContactId, setSelectedContactId] = useState<UUID | null>(null);
  
  // Initialize with a root group
  useEffect(() => {
    const root = new ContactGroupImpl(
      crypto.randomUUID(),
      'Root',
      { x: 0, y: 0 },
      eventEmitterRef.current
    );
    setRootGroup(root);
    setCurrentGroup(root);
  }, []);

  const findGroupById = useCallback((groupId: UUID, searchGroup: ContactGroup = rootGroup!): ContactGroup | null => {
    if (!searchGroup) return null;
    if (searchGroup.id === groupId) return searchGroup;
    
    for (const subgroup of searchGroup.subgroups.values()) {
      const found = findGroupById(groupId, subgroup);
      if (found) return found;
    }
    return null;
  }, [rootGroup]);

  const createContact = useCallback((position: { x: number; y: number }, blendMode: BlendMode = DEFAULT_BLEND_MODE): Contact => {
    if (!currentGroup) throw new Error('No current group');
    
    const contact = new ContactImpl(
      crypto.randomUUID(),
      position,
      blendMode,
      eventEmitterRef.current
    );
    
    if (currentGroup instanceof ContactGroupImpl) {
      currentGroup.addContact(contact);
    }
    
    return contact;
  }, [currentGroup]);

  const createBoundaryContact = useCallback((position: { x: number; y: number }, blendMode: BlendMode = DEFAULT_BLEND_MODE): BoundaryContactImpl => {
    if (!currentGroup) throw new Error('No current group');
    
    const contact = new BoundaryContactImpl(
      crypto.randomUUID(),
      position,
      blendMode,
      eventEmitterRef.current
    );
    
    if (currentGroup instanceof ContactGroupImpl) {
      currentGroup.addContact(contact);
    }
    
    return contact;
  }, [currentGroup]);

  const deleteContact = useCallback((contactId: UUID) => {
    if (!currentGroup || !(currentGroup instanceof ContactGroupImpl)) return;
    currentGroup.removeContact(contactId);
  }, [currentGroup]);

  const updateContactContent = useCallback((contactId: UUID, value: any) => {
    if (!currentGroup) return;
    
    const contact = currentGroup.contacts.get(contactId);
    if (contact) {
      contact.setContent(value);
      propagationEngineRef.current.propagateFromContact(contact, currentGroup);
    }
  }, [currentGroup]);

  const createWire = useCallback((from: UUID, to: UUID): ContactGroupWire | null => {
    if (!currentGroup || !(currentGroup instanceof ContactGroupImpl)) return null;
    
    // Check if both contacts exist in the current group
    const fromContact = currentGroup.contacts.get(from);
    const toContact = currentGroup.contacts.get(to);
    
    if (!fromContact || !toContact) {
      console.error('Cannot create wire: one or both contacts not found');
      return null;
    }
    
    const wire = new ContactGroupWireImpl(
      crypto.randomUUID(),
      from,
      to,
      currentGroup.id,
      eventEmitterRef.current
    );
    
    currentGroup.addWire(wire);
    return wire;
  }, [currentGroup]);

  const deleteWire = useCallback((wireId: UUID) => {
    if (!currentGroup || !(currentGroup instanceof ContactGroupImpl)) return;
    currentGroup.removeWire(wireId);
  }, [currentGroup]);

  const createSubgroup = useCallback((name: string, position: { x: number; y: number }): ContactGroup => {
    if (!currentGroup || !(currentGroup instanceof ContactGroupImpl)) {
      throw new Error('No current group');
    }
    
    const subgroup = new ContactGroupImpl(
      crypto.randomUUID(),
      name,
      position,
      eventEmitterRef.current
    );
    
    currentGroup.addSubgroup(subgroup);
    return subgroup;
  }, [currentGroup]);

  const navigateToGroup = useCallback((groupId: UUID) => {
    const group = findGroupById(groupId);
    if (group) {
      setCurrentGroup(group);
    }
  }, [findGroupById]);

  const navigateToParent = useCallback(() => {
    if (!currentGroup || !currentGroup.parentId || !rootGroup) return;
    
    const parent = findGroupById(currentGroup.parentId);
    if (parent) {
      setCurrentGroup(parent);
    }
  }, [currentGroup, rootGroup, findGroupById]);

  const value: PropagationContextValue = {
    rootGroup,
    currentGroup,
    eventEmitter: eventEmitterRef.current,
    propagationEngine: propagationEngineRef.current,
    createContact,
    createBoundaryContact,
    deleteContact,
    updateContactContent,
    createWire,
    deleteWire,
    createSubgroup,
    navigateToGroup,
    navigateToParent,
    selectedContactId,
    setSelectedContactId,
  };

  return (
    <PropagationContext.Provider value={value}>
      {children}
    </PropagationContext.Provider>
  );
};