/**
 * Type definitions for visual gadgets in React Flow
 */

import type {
  GadgetSpec,
  PartialSpec,
  TypedGadget
} from 'port-graphs';

/**
 * Label spec for node labels
 */
export interface LabelSpec extends PartialSpec<
  { text: string },
  { setText: string },
  { changed: string }
> {}

/**
 * Style spec for visual styling
 */
export interface StyleSpec extends PartialSpec<
  {
    color?: string;
    borderRadius?: number;
    backgroundColor?: string;
    borderColor?: string;
  },
  {
    setStyle: Partial<{
      color: string;
      borderRadius: number;
      backgroundColor: string;
      borderColor: string;
    }>
  },
  {
    changed: {
      color?: string;
      borderRadius?: number;
      backgroundColor?: string;
      borderColor?: string;
    }
  }
> {}

/**
 * Port types for node connections
 */
export type PortType = 'number' | 'string' | 'boolean' | 'any';

/**
 * Port definition
 */
export interface Port {
  id: string;
  name: string;
  type: PortType;
  offset?: number;
}

/**
 * Port configuration for a node
 */
export interface PortConfiguration {
  inputs: Port[];
  outputs: Port[];
}

/**
 * Port specification
 */
export interface PortSpec extends PartialSpec<
  PortConfiguration,
  Partial<PortConfiguration>,
  {
    changed: PortConfiguration;
    portAdded: Port;
    portRemoved: string;
  }
> {}

/**
 * Generic node gadgets interface
 */
export interface NodeGadgets<
  TLabelSpec extends PartialSpec = LabelSpec,
  TPortSpec extends PartialSpec = PortSpec,
  TLogicSpec extends PartialSpec = PartialSpec,
  TStyleSpec extends PartialSpec = StyleSpec
> {
  label: TLabelSpec;
  ports: TPortSpec;
  logic: TLogicSpec;
  style?: TStyleSpec;
}

/**
 * Node instance with actual gadgets
 */
export interface NodeInstance<TNodeGadgets extends NodeGadgets> {
  id: string;
  gadgets: {
    label: TypedGadget<TNodeGadgets['label']>;
    ports: TypedGadget<TNodeGadgets['ports']>;
    logic: TypedGadget<TNodeGadgets['logic']>;
    style?: TNodeGadgets['style'] extends PartialSpec
      ? TypedGadget<TNodeGadgets['style']>
      : undefined;
  };
}

/**
 * Counter node instance type with full typing
 */
export interface CounterNodeInstance {
  type: 'counter';
  id: string;
  gadgets: {
    label: TypedGadget<LabelSpec>;
    ports: TypedGadget<PortSpec>;
    logic: TypedGadget<import('../nodes/counter-node').CounterSpec> & import('port-graphs').Tappable<import('../nodes/counter-node').CounterSpec['effects']>;
    style: TypedGadget<StyleSpec>;
  };
}

/**
 * Display node instance type with full typing
 */
export interface DisplayNodeInstance {
  type: 'display';
  id: string;
  gadgets: {
    label: TypedGadget<LabelSpec>;
    ports: TypedGadget<PortSpec>;
    logic: TypedGadget<import('../nodes/display-node').DisplaySpec> & import('port-graphs').Tappable<import('../nodes/display-node').DisplaySpec['effects']>;
    style: TypedGadget<StyleSpec>;
  };
}

/**
 * Union of all node instance types - discriminated by 'type' field
 */
export type VisualNodeInstance = CounterNodeInstance | DisplayNodeInstance;

/**
 * Node registry using discriminated union
 */
export type NodeRegistry = {
  [nodeId: string]: VisualNodeInstance;
};

/**
 * Position state type
 */
export type PositionState = {
  [nodeId: string]: { x: number; y: number };
};

/**
 * Selection state type
 */
export type SelectionState = {
  [nodeId: string]: boolean;
};

/**
 * Dimensions state type
 */
export type DimensionsState = {
  [nodeId: string]: { width: number; height: number };
};