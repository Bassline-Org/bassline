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
      const gadgetPorts = new Set(this.getGadgetPorts(gadgetId).map(record => record.name))
      const ladderGraph = this.getLadder(ladderId)
      const ladderInterface = new Set(ladderGraph.interface.map(record => record.name))
      return gadgetPorts.size === ladderInterface.size && (gadgetPorts.difference(ladderInterface).size === 0)
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