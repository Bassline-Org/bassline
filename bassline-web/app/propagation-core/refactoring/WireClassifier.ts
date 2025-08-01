import type { Wire } from '../models/Wire'
import type { Selection, WireClassification } from './types'

export class WireClassifier {
  classify(wires: Wire[], selection: Selection): WireClassification {
    const internal: Wire[] = []
    const incoming: Wire[] = []
    const outgoing: Wire[] = []
    const external: Wire[] = []
    
    for (const wire of wires) {
      const fromSelected = selection.contacts.has(wire.fromId)
      const toSelected = selection.contacts.has(wire.toId)
      
      if (fromSelected && toSelected) {
        internal.push(wire)
      } else if (!fromSelected && toSelected) {
        incoming.push(wire)
      } else if (fromSelected && !toSelected) {
        outgoing.push(wire)
      } else {
        external.push(wire)
      }
    }
    
    return { internal, incoming, outgoing, external }
  }
  
  // Group wires by their external endpoint
  groupByExternalEndpoint(wires: Wire[], selection: Selection, direction: 'incoming' | 'outgoing'): Map<string, Wire[]> {
    const grouped = new Map<string, Wire[]>()
    
    wires.forEach(wire => {
      const externalId = direction === 'incoming' ? wire.fromId : wire.toId
      const existing = grouped.get(externalId) || []
      existing.push(wire)
      grouped.set(externalId, existing)
    })
    
    return grouped
  }
}