import type { BlendMode } from './index'

// Propagation-related settings
export interface PropagationSettings {
  defaultBlendMode: BlendMode
  defaultBoundaryBlendMode?: BlendMode  // Optional separate default for boundaries
  autoPropagateOnConnect: boolean
}

// Visual/UI settings
export interface VisualSettings {
  showEdges: boolean
  edgeOpacity: number  // 0-1
  nodeLabelsVisible: boolean
  compactNodeView: boolean
  animatePropagatation: boolean
  showFatEdges: boolean  // Show thicker edges for arrays/sets
  fatEdgeScale: number   // Multiplier for fat edge thickness (1-3)
}

// Behavior settings
export interface BehaviorSettings {
  multiSelectWithDrag: boolean
  doubleClickToEdit: boolean
  showMergePreview: boolean
  showContradictionAlerts: boolean
}

// Combined app settings
export interface AppSettings {
  propagation: PropagationSettings
  visual: VisualSettings
  behavior: BehaviorSettings
}

// Default settings
export const defaultAppSettings: AppSettings = {
  propagation: {
    defaultBlendMode: 'accept-last',
    autoPropagateOnConnect: true
  },
  visual: {
    showEdges: true,
    edgeOpacity: 1,
    nodeLabelsVisible: true,
    compactNodeView: false,
    animatePropagatation: false,
    showFatEdges: true,
    fatEdgeScale: 1.5
  },
  behavior: {
    multiSelectWithDrag: true,
    doubleClickToEdit: true,
    showMergePreview: true,
    showContradictionAlerts: true
  }
}