import { DefaultRecord, GraphId, GadgetRecord, PortRecord, ConnectionRecord, FreePortRecord, GadgetId, GadgetPortRecord, PortId, ConnectionId, DefaultRecordType, PortDirection, JsonValue } from "./types"

// Re-export all types
export { type DefaultRecord, type GraphId, type GadgetRecord, type PortRecord, type ConnectionRecord, type FreePortRecord, type GadgetId, type GadgetPortRecord, type PortId, type ConnectionId, type DefaultRecordType }

export class PortGraph {
  public records: Record<string, DefaultRecord> = {}
  constructor(public registry: GraphRegistry, public id: GraphId) {}

  addGadget(inputs: {name: GadgetId, primitiveName: string, ladder: GraphId | null}) {
    const gadget: GadgetRecord = {
      ...inputs,
      recordType: 'gadget',
      type: 'function',
    }
    this.addGadgetRecord(gadget)
    return gadget
  }

  addCell(inputs: {name: GadgetId, primitiveName: string, ladder?: GraphId | null}) {
    const cell: GadgetRecord = {
      ...inputs,
      recordType: 'gadget',
      ladder: inputs.ladder || null,
      type: 'cell',
    }
    this.addGadgetRecord(cell)
    return cell
  }

  addPort(inputs: {name: PortId, portName: string, type: string, direction: PortDirection, gadget: GadgetId, currentValue?: JsonValue}) {
    const port: PortRecord = {
      ...inputs,
      recordType: 'port',
      position: 'top',
      currentValue: inputs.currentValue || null,
    }
    this.addPortRecord(port)
    return port
  }
  addEdge(inputs: {name: ConnectionId, source: PortId, target: PortId}) {
    const edge: ConnectionRecord = {
      ...inputs,
      recordType: 'connection',
    }
    this.addEdgeRecord(edge)
    return edge
  }

  private addGadgetRecord(gadget: GadgetRecord): GadgetRecord {
      this.records[gadget.name] = gadget
      return gadget
  }
  private addPortRecord(port: PortRecord): PortRecord {
      this.records[port.name] = port
      return port
  }
  private addEdgeRecord(edge: ConnectionRecord): ConnectionRecord {
      this.records[edge.name] = edge
      return edge
  }

  // Queries
  private getPortRecords(): PortRecord[] {
    return Object.values(this.records).filter(record => record.recordType === 'port') as PortRecord[]
  }
  private getGadgetRecords(): GadgetRecord[] {
    return Object.values(this.records).filter(record => record.recordType === 'gadget') as GadgetRecord[]
  }
  private getConnectionRecords(): ConnectionRecord[] {
    return Object.values(this.records).filter(record => record.recordType === 'connection') as ConnectionRecord[]
  }

  getPortRecord(name: PortId): PortRecord {
    const port = this.records[name]
    if(!port || port.recordType !== 'port') {
      throw new Error(`Port ${name} not found`)
    }
    return port as PortRecord
  }

  getGadgetRecord(name: GadgetId): GadgetRecord {
    const gadget = this.records[name]
    if(!gadget || gadget.recordType !== 'gadget') {
      throw new Error(`Gadget ${name} not found`)
    }
    return gadget as GadgetRecord
  }
  getConnectionRecord(name: ConnectionId): ConnectionRecord {
    const connection = this.records[name]
    if(!connection || connection.recordType !== 'connection') {
      throw new Error(`Connection ${name} not found`)
    }
    return connection as ConnectionRecord
  }
  getLadders(): (GraphId | null)[] {
    return this.getGadgetRecords().filter(record => record.ladder).map((record: GadgetRecord) => record.ladder)
  }
  get interface(): (FreePortRecord)[] {
      const connectedPorts = new Set(this.getConnectionRecords().flatMap(record => [record.source, record.target]));
      return this.getPortRecords().filter(record => !connectedPorts.has(record.name)) as (FreePortRecord)[]
  }

  getGadgetPorts(name: GadgetId): (GadgetPortRecord)[] {
      const gadget = this.getGadgetRecord(name)
      if(!gadget) {
          throw new Error(`Gadget ${name} not found`)
      }
      return this.getPortRecords().filter(record => record.gadget === name) as GadgetPortRecord[]
  }

  getLadder(id: GraphId): PortGraph {
      const ladder = this.registry.getGraph(id)
      if(!ladder) {
          throw new Error(`Ladder ${id} not found`)
      }
      return ladder
  }

  validateLadder(gadgetId: GadgetId, ladderId: GraphId): boolean {
      const gadgetPorts = this.getGadgetPorts(gadgetId)
      const ladderGraph = this.getLadder(ladderId)
      const ladderInterface = ladderGraph.interface
      
      if (gadgetPorts.length !== ladderInterface.length) return false
      
      // Check semantic properties match exactly
      const gadgetPortsMap = new Map(gadgetPorts.map(p => [p.name, p]))
      const interfacePortsMap = new Map(ladderInterface.map(p => [p.name, p]))
      
      // All gadget ports must have matching interface ports with same semantic properties
      for (const [name, gadgetPort] of gadgetPortsMap) {
          const interfacePort = interfacePortsMap.get(name)
          if (!interfacePort) return false
          if (gadgetPort.type !== interfacePort.type) return false
          if (gadgetPort.direction !== interfacePort.direction) return false
      }
      
      return true
  }
  
  flatten(): Record<GraphId, Record<string, DefaultRecord>> {
      const result: Record<GraphId, Record<string, DefaultRecord>> = {}
      const visited = new Set<GraphId>()
      
      const collectGraph = (graphId: GraphId) => {
          if (visited.has(graphId)) return
          visited.add(graphId)
          
          const graph = this.registry.getGraph(graphId)
          if (!graph) return
          
          result[graphId] = { ...graph.records }
          
          // Recursively collect all ladder graphs
          for (const gadget of graph.getGadgetRecords()) {
              if (gadget.ladder) {
                  collectGraph(gadget.ladder)
              }
          }
      }
      
      collectGraph(this.id)
      return result
  }
}

export class GraphRegistry {
  private graphs: Record<GraphId, WeakRef<PortGraph>> = {}
  constructor() {}

  newGraph(id: GraphId): PortGraph {
      if(this.graphs[id]) {
          throw new Error(`Graph ${id} already exists`)
      }
      this.graphs[id] = new WeakRef(new PortGraph(this, id));
      return this.graphs[id].deref()!
  }

  getGraph(id: GraphId): PortGraph {
      const graph = this.graphs[id]
      if(!graph) {
          throw new Error(`Graph ${id} not found`)
      }
      return graph.deref()!
  }
}