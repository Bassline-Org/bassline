/**
 * Pico-Bassline Core Runtime
 * Ultra-minimal propagation network implementation
 */

import {
  Value,
  Properties,
  ContactAccess,
  WireMode,
  ComputeFunction,
  StructureData,
  ContactInfo,
  PropagationEvent,
  isPrimitiveProps,
  InvalidWiringError
} from './types'

/**
 * Contact - The fundamental unit that holds and propagates values
 */
export class Contact {
  id: string
  value: Value
  old: Value
  parent: WeakRef<Group>
  sources: Set<WeakRef<Contact>> = new Set()
  targets: Set<WeakRef<Contact>> = new Set()
  access: ContactAccess

  constructor(
    id: string,
    parent: Group,
    value?: Value,
    access?: Partial<ContactAccess>
  ) {
    this.id = id
    this.parent = new WeakRef(parent)
    this.value = value
    this.old = undefined
    
    // Default access: internal-only for regular contacts
    this.access = {
      boundary: false,
      internal: 'both',
      external: 'none',
      ...access
    }
  }

  /**
   * Check if a contact can write to this contact
   */
  canWrite(from: Contact): boolean {
    const fromGroup = from.parent.deref()
    const thisGroup = this.parent.deref()
    
    if (!fromGroup || !thisGroup) return false
    
    // Meta-contact special rules
    if (this.id.startsWith('meta-')) {
      if (this.id === 'meta-actions') {
        // Actions can be triggered internally or by parent
        return fromGroup === thisGroup || fromGroup === thisGroup.parent
      }
      if (this.id === 'meta-properties' || 
          this.id === 'meta-structure' || 
          this.id === 'meta-dynamics') {
        // Other meta-contacts only writable by parent
        return fromGroup === thisGroup.parent
      }
    }
    
    // Regular contact access control
    if (fromGroup === thisGroup) {
      // Same group - always allow internal access for non-boundary contacts
      if (!this.access.boundary) return true
      // For boundary contacts, check internal permissions
      return this.access.internal === 'both' || this.access.internal === 'write'
    } else if (fromGroup === thisGroup.parent && this.access.boundary) {
      // Parent writing to child boundary
      return this.access.external === 'both' || this.access.external === 'write'
    } else if (fromGroup?.parent === thisGroup && from.access.boundary) {
      // Child boundary writing to parent - check if boundary can write out
      return from.access.external === 'both' || from.access.external === 'read'
    }
    
    return false
  }

  /**
   * Check if a contact can read from this contact
   */
  canRead(from: Contact): boolean {
    const fromGroup = from.parent.deref()
    const thisGroup = this.parent.deref()
    
    if (!fromGroup || !thisGroup) return false
    
    // Special case: dynamics not readable internally
    if (this.id === 'meta-dynamics' && fromGroup === thisGroup) {
      return false
    }
    
    if (fromGroup === thisGroup) {
      // Same group - always allow internal access for non-boundary contacts
      if (!this.access.boundary) return true
      // For boundary contacts, check internal permissions
      return this.access.internal === 'both' || this.access.internal === 'read'
    } else if (thisGroup?.parent === fromGroup && this.access.boundary) {
      // Parent reading from child boundary
      return this.access.external === 'both' || this.access.external === 'read'
    } else if (thisGroup && fromGroup === thisGroup.parent && from.access.boundary) {
      // Child boundary reading from parent - check if boundary can read in
      return from.access.external === 'both' || from.access.external === 'write'
    }
    
    return false
  }

  /**
   * Smart wiring that creates appropriate connections based on permissions
   * Throws InvalidWiringError if wiring is not allowed
   */
  wireTo(target: Contact, mode: WireMode = WireMode.AUTO): void {
    let wiredForward = false
    let wiredBackward = false
    
    switch (mode) {
      case WireMode.AUTO: {
        // Smart detection - create connections where allowed
        // Forward: this writes to target
        if (target.canWrite(this)) {
          this.targets.add(new WeakRef(target))
          target.sources.add(new WeakRef(this))
          wiredForward = true
        }
        // Backward: target writes to this
        if (this.canWrite(target)) {
          target.targets.add(new WeakRef(this))
          this.sources.add(new WeakRef(target))
          wiredBackward = true
        }
        
        if (!wiredForward && !wiredBackward) {
          throw new InvalidWiringError(
            `Cannot wire ${this.id} to ${target.id}: No valid connection allowed`
          )
        }
        break
      }
      
      case WireMode.FORWARD_ONLY: {
        if (!target.canWrite(this)) {
          throw new InvalidWiringError(
            `Cannot wire ${this.id} to ${target.id}: Target cannot be written by source`
          )
        }
        this.targets.add(new WeakRef(target))
        target.sources.add(new WeakRef(this))
        wiredForward = true
        break
      }
      
      case WireMode.BIDIRECTIONAL:
      case WireMode.CONSTRAINT: {
        const canForward = target.canWrite(this)
        const canBackward = this.canWrite(target)
        
        if (!canForward && !canBackward) {
          throw new InvalidWiringError(
            `Cannot wire ${this.id} to ${target.id} bidirectionally: No valid connections`
          )
        }
        
        if (canForward) {
          this.targets.add(new WeakRef(target))
          target.sources.add(new WeakRef(this))
          wiredForward = true
        }
        if (canBackward) {
          target.targets.add(new WeakRef(this))
          this.sources.add(new WeakRef(target))
          wiredBackward = true
        }
        break
      }
    }
    
    // Update structure metadata (wire topology changed)
    this.parent.deref()?.updateStructure()
    target.parent.deref()?.updateStructure()
  }

  /**
   * Remove wire connections
   */
  unwireFrom(target: Contact): void {
    // Find and remove the WeakRefs
    for (const ref of this.targets) {
      if (ref.deref() === target) {
        this.targets.delete(ref)
        break
      }
    }
    
    for (const ref of target.sources) {
      if (ref.deref() === this) {
        target.sources.delete(ref)
        break
      }
    }
    
    for (const ref of target.targets) {
      if (ref.deref() === this) {
        target.targets.delete(ref)
        break
      }
    }
    
    for (const ref of this.sources) {
      if (ref.deref() === target) {
        this.sources.delete(ref)
        break
      }
    }
    
    this.parent.deref()?.updateStructure()
    target.parent.deref()?.updateStructure()
  }

  /**
   * Set value with access control
   */
  setValue(newValue: Value, from?: Contact): void {
    // Check write permission if source specified
    if (from && !this.canWrite(from)) {
      return
    }
    
    // Only propagate if value actually changed
    if (newValue !== this.value) {
      this.old = this.value
      this.value = newValue
      this.propagate()
    }
  }

  /**
   * Propagate value to all targets
   */
  propagate(): void {
    // Clean up dead references while propagating
    const deadRefs: WeakRef<Contact>[] = []
    
    for (const targetRef of this.targets) {
      const target = targetRef.deref()
      if (target) {
        // Emit propagation event to dynamics
        this.emitPropagationEvent(this, target)
        target.setValue(this.value, this)
      } else {
        deadRefs.push(targetRef)
      }
    }
    
    // Clean up dead references
    for (const ref of deadRefs) {
      this.targets.delete(ref)
    }
  }

  /**
   * Emit a propagation event to meta-dynamics
   */
  private emitPropagationEvent(from: Contact, to: Contact): void {
    const fromGroup = from.parent.deref()
    const toGroup = to.parent.deref()
    
    if (!fromGroup || !toGroup) return
    
    // Find the common parent group that should receive this event
    let eventGroup: Group | undefined = fromGroup
    
    // If crossing group boundaries, emit to the parent
    if (fromGroup !== toGroup) {
      // Find common ancestor
      eventGroup = fromGroup.parent || toGroup.parent
    }
    
    // Emit to the group's dynamics contact
    if (eventGroup?.dynamics) {
      const event: PropagationEvent = {
        type: 'propagate',
        from: from.id,
        to: to.id,
        fromGroup: fromGroup.id,
        toGroup: toGroup.id,
        value: from.value,
        timestamp: Date.now()
      }
      
      // Append to existing events or start new stream
      const current = eventGroup.dynamics.value as PropagationEvent[] || []
      eventGroup.dynamics.setValue([...current, event])
    }
  }

  // Lazy accessors
  get current(): Value {
    return this.value
  }

  get pair(): [Value, Value] {
    return [this.value, this.old]
  }
}

/**
 * Group - Container for contacts and sub-groups (Groups = Gadgets)
 */
export class Group {
  id: string
  parent?: Group
  contacts: Map<string, Contact> = new Map()
  groups: Map<string, Group> = new Map()
  compute?: ComputeFunction

  constructor(id: string, propsValue: Properties = {}, parent?: Group) {
    this.id = id
    this.parent = parent
    
    // Create meta-properties contact
    const propsContact = new Contact('meta-properties', this)
    propsContact.setValue(propsValue)
    this.contacts.set('meta-properties', propsContact)
    
    // Create other meta-contacts if not primitive
    if (!isPrimitiveProps(propsValue)) {
      this.createContact('meta-structure')
      this.createContact('meta-dynamics')
      this.createContact('meta-actions')
      this.updateStructure()
      this.initDynamics()
    }
    
    // Store compute function if primitive
    if (isPrimitiveProps(propsValue)) {
      this.compute = propsValue.compute
    }
  }

  // Meta-contact getters
  get properties(): Contact | undefined {
    return this.contacts.get('meta-properties')
  }

  get structure(): Contact | undefined {
    return this.contacts.get('meta-structure')
  }

  get dynamics(): Contact | undefined {
    return this.contacts.get('meta-dynamics')
  }

  get actions(): Contact | undefined {
    return this.contacts.get('meta-actions')
  }

  /**
   * Create a contact in this group
   */
  createContact(id: string, value?: Value, access?: Partial<ContactAccess>): Contact {
    const contact = new Contact(id, this, value, access)
    this.contacts.set(id, contact)
    this.updateStructure()
    return contact
  }

  /**
   * Create a sub-group
   */
  createGroup(id: string, propsValue?: Properties): Group {
    const group = new Group(id, propsValue, this)
    this.groups.set(id, group)
    this.updateStructure()
    return group
  }

  /**
   * Update structure metadata
   */
  updateStructure(): void {
    if (this.structure) {
      const contactInfos: ContactInfo[] = []
      
      // Collect contact information including connections
      for (const [id, contact] of this.contacts) {
        const sources: string[] = []
        const targets: string[] = []
        
        // Collect source IDs
        for (const sourceRef of contact.sources) {
          const source = sourceRef.deref()
          if (source) {
            sources.push(source.id)
          }
        }
        
        // Collect target IDs
        for (const targetRef of contact.targets) {
          const target = targetRef.deref()
          if (target) {
            targets.push(target.id)
          }
        }
        
        contactInfos.push({ id, sources, targets })
      }
      
      const data: StructureData = {
        contacts: contactInfos,
        groups: Array.from(this.groups.keys())
      }
      this.structure.setValue(data)
    }
  }

  /**
   * Initialize dynamics metadata
   */
  initDynamics(): void {
    if (this.dynamics && !this.dynamics.value) {
      // Initialize with empty event stream
      this.dynamics.setValue([])
    }
  }

  /**
   * Execute primitive compute function
   */
  execute(): void {
    const props = this.properties?.value as Properties || {}
    
    if (isPrimitiveProps(props) && this.compute) {
      const inputs = this.gatherInputs(props)
      const output = this.compute(inputs, props)
      
      const outputContact = this.contacts.get('output')
      if (outputContact) {
        outputContact.setValue(output)
      }
    }
  }

  /**
   * Gather inputs for compute function
   */
  private gatherInputs(props: Properties): Record<string, Value> {
    const result: Record<string, Value> = {}
    
    for (const [id, contact] of this.contacts) {
      // Skip meta-contacts and output
      if (!id.startsWith('meta-') && id !== 'output') {
        result[id] = props.needsHistory ? contact.pair : contact.value
      }
    }
    
    return result
  }
}

// Export everything
export { WireMode, InvalidWiringError, type ContactAccess, type AccessLevel } from './types'