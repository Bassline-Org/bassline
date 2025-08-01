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
import { GadgetRegistry, type GadgetTemplate } from '~/models/Gadget';

interface PropagationContextValue {
  rootGroup: ContactGroup | null;
  currentGroup: ContactGroup | null;
  eventEmitter: EventEmitter;
  propagationEngine: PropagationEngine;
  gadgetRegistry: GadgetRegistry;
  
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
  
  // Gadget operations
  instantiateGadget: (template: GadgetTemplate, position: { x: number; y: number }) => ContactGroup;
  
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
  const gadgetRegistryRef = useRef(new GadgetRegistry());
  
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
    
    const contactId = crypto.randomUUID();
    console.log('Creating contact with ID:', contactId);
    
    const contact = new ContactImpl(
      contactId,
      position,
      blendMode,
      eventEmitterRef.current
    );
    
    if (currentGroup instanceof ContactGroupImpl) {
      currentGroup.addContact(contact);
      console.log('Contact added to group. Current contacts:', Array.from(currentGroup.contacts.keys()));
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
    
    console.log('createWire called with:', { from, to });
    console.log('Current group contacts:', Array.from(currentGroup.contacts.keys()));
    console.log('Current group subgroups:', Array.from(currentGroup.subgroups.keys()));
    
    // Check if both contacts exist in the current group
    let fromContact = currentGroup.contacts.get(from);
    let toContact = currentGroup.contacts.get(to);
    
    // If not found directly, check if they are boundary contacts of subgroups
    if (!fromContact || !toContact) {
      // Search through subgroups for boundary contacts
      for (const subgroup of currentGroup.subgroups.values()) {
        if (!fromContact) {
          fromContact = subgroup.contacts.get(from);
        }
        if (!toContact) {
          toContact = subgroup.contacts.get(to);
        }
        if (fromContact && toContact) break;
      }
    }
    
    if (!fromContact || !toContact) {
      console.error('Cannot create wire: one or both contacts not found', { from, to, fromContact, toContact });
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

  const instantiateGadget = useCallback((template: GadgetTemplate, position: { x: number; y: number }): ContactGroup => {
    if (!currentGroup || !(currentGroup instanceof ContactGroupImpl)) {
      throw new Error('No current group');
    }
    
    const gadget = template.instantiate(position, eventEmitterRef.current);
    currentGroup.addSubgroup(gadget);
    return gadget;
  }, [currentGroup]);

  const value: PropagationContextValue = {
    rootGroup,
    currentGroup,
    eventEmitter: eventEmitterRef.current,
    propagationEngine: propagationEngineRef.current,
    gadgetRegistry: gadgetRegistryRef.current,
    createContact,
    createBoundaryContact,
    deleteContact,
    updateContactContent,
    createWire,
    deleteWire,
    createSubgroup,
    navigateToGroup,
    navigateToParent,
    instantiateGadget,
    selectedContactId,
    setSelectedContactId,
  };

  return (
    <PropagationContext.Provider value={value}>
      {children}
    </PropagationContext.Provider>
  );
};