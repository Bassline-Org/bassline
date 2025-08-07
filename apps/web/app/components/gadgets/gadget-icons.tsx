import { 
  Plus, 
  Minus, 
  X, 
  Divide, 
  Circle, 
  Layers, 
  GitMerge, 
  Split, 
  Combine,
  // Future icons for more gadgets
  Equal,
  ChevronRight,
  ChevronLeft,
  ToggleLeft,
  Filter,
  Shuffle,
  Zap,
  Package,
  type LucideIcon
} from 'lucide-react'

// Map gadget names to icons
export const gadgetIcons: Record<string, LucideIcon> = {
  // Math operations
  'Adder': Plus,
  'Subtractor': Minus,
  'Multiplier': X,
  'Divider': Divide,
  
  // Set operations
  'Union': Circle,
  'Intersection': Layers,
  'Difference': GitMerge,
  
  // Data flow
  'Splitter': Split,
  'Splitter3': Split,
  'Joiner': Combine,
  'Joiner3': Combine,
  
  // Future gadgets (placeholders)
  'Equals': Equal,
  'GreaterThan': ChevronRight,
  'LessThan': ChevronLeft,
  'Switch': ToggleLeft,
  'Filter': Filter,
  'Randomizer': Shuffle,
  'Trigger': Zap,
}

// Get icon for a gadget, with fallback
export function getGadgetIcon(gadgetName: string): LucideIcon {
  return gadgetIcons[gadgetName] || Package
}