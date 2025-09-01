import { Gadget } from './gadgets'
import type { Term } from './terms'

// ================================
// Gadget types
// ================================
// Our model now only uses Terms to describe everything
// So the whole network & gadget types can be described by Terms

// Gadget terms define a node in the network
// They have a type (cell, function), a name, and an attributes dictionary
// Example:
// [ 'cell' , 'Add' ] | [ 'function' , 'Add' ]
export type Attributes = { [key: string]: Term }
export type GadgetType = 'cell' | 'function'
export type GadgetTerm = [ 'gadget' , GadgetType, string , Attributes? ]

// Port terms define ports on a gadget
// All gadgets have a control port, connection port
// All other communication is done via data ports which are created by the gadget
// Ports have a name, a direction, and an attributes dictionary
export type PortDirection = 'input' | 'output'
export type PortTerm = [ 'port' , string , PortDirection, Attributes? ]

// Connection terms define connections between gadgets & ports
// Connections are stored in the connection port of the gadget
// The have the form: [ 'connection' , sourcePort , targetPort ]
// Example:
// [ 'connection' , ['gadget1', 'out'] , ['gadget2', 'in'] ]
// Connection paths are tuples of [gadgetId, portName]
export type ConnectionPath = [string, string] // [gadgetId, portName]
export type ConnectionTerm = [ 'connection' , ConnectionPath , ConnectionPath, Attributes? ]


export interface INetwork {
    id: string;
    // All gadgets in the network
    gadgets: Record<string, typeof Gadget>;
    // Gadget id -> [outputPort, [gadgetId, inputPort]]
    connections: Record<string, [string, ConnectionPath][]>;
}

export interface IPort {
    name: string;
    value: Term;
    gadget: typeof Gadget;
    attributes: Record<string, Term>;
}

export interface IConnection {
    source: ConnectionPath;
    target: ConnectionPath;
}