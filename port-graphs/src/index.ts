import { DefaultRecord, GraphId, GadgetRecord, PortRecord, ConnectionRecord, FreePortRecord, GadgetId, GadgetPortRecord } from "./types"
export { DefaultRecord, GraphId, GadgetRecord, PortRecord, ConnectionRecord, FreePortRecord, GadgetId, GadgetPortRecord }

export class PortGraph<RecordType extends DefaultRecord = DefaultRecord> {
  public records: Record<string, RecordType> = {}
  constructor(public registry: GraphRegistry, public id: GraphId) {}
  addGadget(gadget: GadgetRecord & RecordType): GadgetRecord {
      this.records[gadget.name] = gadget
      return gadget
  }
  addPort(port: PortRecord & RecordType): PortRecord {
      this.records[port.name] = port
      return port
  }
  addEdge(edge: ConnectionRecord & RecordType): ConnectionRecord {
      this.records[edge.name] = edge
      return edge
  }

  // Queries
  get portRecords(): (PortRecord & RecordType)[] {
      return Object.values(this.records).filter(record => record.recordType === 'port') as (PortRecord & RecordType)[]
  }
  get gadgetRecords(): (GadgetRecord & RecordType)[] {
      return Object.values(this.records).filter(record => record.recordType === 'gadget') as (GadgetRecord & RecordType)[]
  }
  get connectionRecords(): (ConnectionRecord & RecordType)[] {
      return Object.values(this.records).filter(record => record.recordType === 'connection') as (ConnectionRecord & RecordType)[]
  }
  get ladders(): (GraphId | null)[] {
      return this.gadgetRecords.map(record => record.ladder)
  }
  get interface(): (FreePortRecord & RecordType)[] {
      const connectedPorts = new Set(this.connectionRecords.flatMap(record => [record.source, record.target]));
      return this.portRecords.filter(record => !connectedPorts.has(record.name)) as (FreePortRecord & RecordType)[]
  }

  getGadgetPorts(name: GadgetId): (GadgetPortRecord & RecordType)[] {
      const gadget = this.records[name] as GadgetRecord & RecordType
      if(!gadget) {
          throw new Error(`Gadget ${name} not found`)
      }
      return this.portRecords.filter(record => record.gadget === name) as (GadgetPortRecord & RecordType)[]
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
          
          result[graphId] = { ...graph.records } as Record<string, DefaultRecord>
          
          // Recursively collect all ladder graphs
          for (const gadget of graph.gadgetRecords) {
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