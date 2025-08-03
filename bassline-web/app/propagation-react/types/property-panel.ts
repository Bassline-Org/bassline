export interface PropertyPanelFrame {
  id: string
  type: 'selection' | 'contact' | 'group'
  targetId?: string  // For contact/group frames
  targetIds?: string[] // For selection frames showing multiple items
  title: string
  depth: number
  timestamp: number // For ordering and animations
}

export interface PropertyPanelStackState {
  frames: PropertyPanelFrame[]
  maxVisibleFrames: number // How many frames to show in the stack
}