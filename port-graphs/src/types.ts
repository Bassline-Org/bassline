// Port-graph implementation, specifically for hierarchical port graphs, and effective rewrites

export type DefaultAttributes = 'name' | 'description' | 'type' | 'fn' | 'ladder' | 'direction'
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

export type GraphId = `graph-${string}`
export type PortId = `port-${string}`
export type GadgetId = `gadget-${string}`
export type ConnectionId = `connection-${string}`

export type DefaultRecordType = 'gadget' | 'port' | 'connection'
export interface DefaultRecord<T extends DefaultRecordType = DefaultRecordType> {
    name: string,
    recordType: T,
}

export interface GadgetRecord extends DefaultRecord<'gadget'> {
    name: GadgetId,
    type: 'cell' | 'function',
    primitiveName?: string,  // e.g., 'Add', 'Multiply', 'MaxCell', 'OrdinalCell'
    ladder: GraphId | null,
}

export type PortDirection = 'input' | 'output' | 'bidirectional'
export type PortPosition = 'top' | 'bottom' | 'left' | 'right'
export interface PortRecord<ValueType extends JsonValue = JsonValue> extends DefaultRecord<'port'> {
    name: PortId,
    portName: string,
    type: string,
    direction: PortDirection,
    position: PortPosition,
    // NOTE: Stub for "static types" for cells & functions
    //Mode?: 'pass-through' | 'trigger'
    gadget: GadgetId | null,
    currentValue: ValueType | null,
}

export interface FreePortRecord extends PortRecord {
    gadget: null,
}

export interface GadgetPortRecord extends PortRecord {
    gadget: GadgetId,
}

export interface ConnectionRecord extends DefaultRecord<'connection'> {
    name: ConnectionId,
    source: PortId,
    target: PortId,
}
