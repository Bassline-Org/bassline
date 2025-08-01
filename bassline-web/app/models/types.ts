export interface Position {
  x: number;
  y: number;
}

export interface Identifiable {
  id: string;
}

export type UUID = string;

export interface Announcement {
  type: string;
  source: Identifiable;
  timestamp: number;
}

export interface ContactContent {
  value: any;
  timestamp: number;
}

export interface BlendMode {
  name: string;
  blend(current: any, incoming: any): any;
}

export interface Contact extends Identifiable {
  content: ContactContent | null;
  blendMode: BlendMode;
  position: Position;
  groupId: UUID | null;
  setContent(value: any): void;
  isBoundary(): boolean;
}

export interface BoundaryContact extends Contact {
  pairedContactId: UUID | null;
}

export interface ContactGroupWire extends Identifiable {
  from: UUID;
  to: UUID;
  groupId: UUID;
}

export interface ContactGroup extends Identifiable {
  name: string;
  contacts: Map<UUID, Contact>;
  wires: Map<UUID, ContactGroupWire>;
  subgroups: Map<UUID, ContactGroup>;
  parentId: UUID | null;
  position: Position;
}

export interface ContactGroupRefactor {
  groupId: UUID;
  actions: RefactorAction[];
}

export type RefactorAction = 
  | { type: 'addContact'; contact: Contact }
  | { type: 'removeContact'; contactId: UUID }
  | { type: 'addWire'; wire: ContactGroupWire }
  | { type: 'removeWire'; wireId: UUID }
  | { type: 'moveContact'; contactId: UUID; newPosition: Position }
  | { type: 'extractSubgroup'; contactIds: UUID[]; subgroupName: string };