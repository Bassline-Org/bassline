/**
 * Core types for the propagation network
 * No UI dependencies - pure data models
 */

export type UUID = string;

export interface Position {
  x: number;
  y: number;
}

export interface Content {
  value: any;
  timestamp: number;
}

// Events emitted by the propagation system
export interface PropagationEvent {
  type: string;
  timestamp: number;
}

export interface ContentChangedEvent extends PropagationEvent {
  type: 'ContentChanged';
  contactId: UUID;
  content: Content;
}

export interface WireAddedEvent extends PropagationEvent {
  type: 'WireAdded';
  groupId: UUID;
  wireId: UUID;
}

export interface WireRemovedEvent extends PropagationEvent {
  type: 'WireRemoved';
  groupId: UUID;
  wireId: UUID;
}