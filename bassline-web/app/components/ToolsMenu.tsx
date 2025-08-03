import { useState } from 'react'
import { Button } from '~/components/ui/button'
import { Card } from '~/components/ui/card'
import { 
  Settings, 
  Eye, 
  EyeOff, 
  Info, 
  Grid,
  Layers,
  Zap,
  ChevronDown,
  ChevronUp,
  Tag,
  Bug,
  Lightbulb,
  Sliders,
  LayoutGrid,
  Package
} from 'lucide-react'

export interface ViewSettings {
  showInstructions: boolean
  showMiniMap: boolean
  showGrid: boolean
  showPropagationFlow: boolean
  showNodeLabels: boolean
  showDebugInfo: boolean
  showShortcutHints: boolean
}

interface ToolsMenuProps {
  viewSettings: ViewSettings
  onViewSettingsChange: (settings: ViewSettings) => void
  onOpenConfiguration?: () => void
  onAutoLayout?: () => void
  onOpenGadgets?: () => void
}

export function ToolsMenu({ viewSettings, onViewSettingsChange, onOpenConfiguration, onAutoLayout, onOpenGadgets }: ToolsMenuProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  
  const toggleSetting = (key: keyof ViewSettings) => {
    onViewSettingsChange({
      ...viewSettings,
      [key]: !viewSettings[key]
    })
  }
  
  const ViewToggle = ({ 
    setting, 
    label, 
    icon: Icon,
    shortcut
  }: { 
    setting: keyof ViewSettings
    label: string
    icon: React.ComponentType<any>
    shortcut?: string
  }) => {
    const isEnabled = viewSettings[setting]
    return (
      <div className="flex flex-col items-center">
        <Button
          size="sm"
          variant={isEnabled ? "default" : "outline"}
          className="p-2 h-auto flex flex-col gap-1 min-w-[80px]"
          onClick={() => toggleSetting(setting)}
        >
          <Icon className="w-4 h-4" />
          <span className="text-xs">{label}</span>
        </Button>
        {shortcut && (
          <kbd className="text-xs bg-gray-200 px-1 rounded mt-1">{shortcut}</kbd>
        )}
      </div>
    )
  }
  
  return (
    <div className="flex flex-col items-center select-none">
      {isExpanded && (
        <Card className="mb-2 p-2">
          <div className="flex gap-2 flex-wrap justify-center">
          <ViewToggle 
            setting="showInstructions" 
            label="Instructions" 
            icon={Info}
            shortcut="W"
          />
          <ViewToggle 
            setting="showMiniMap" 
            label="Mini Map" 
            icon={Layers}
            shortcut="E"
          />
          <ViewToggle 
            setting="showGrid" 
            label="Grid Background" 
            icon={Grid}
            shortcut="D"
          />
          <ViewToggle 
            setting="showPropagationFlow" 
            label="Flow" 
            icon={Zap}
          />
          <ViewToggle 
            setting="showNodeLabels" 
            label="Labels" 
            icon={Tag}
          />
          <ViewToggle 
            setting="showDebugInfo" 
            label="Debug" 
            icon={Bug}
          />
          <ViewToggle 
            setting="showShortcutHints" 
            label="Hints" 
            icon={Lightbulb}
          />
          </div>
        </Card>
      )}
      
      <div className="flex gap-3">
        {onOpenGadgets && (
          <Button
            size="sm"
            variant="ghost"
            className="px-4 py-2"
            onClick={onOpenGadgets}
          >
            <Package className="w-4 h-4 mr-2" />
            <span>Gadgets</span>
            <kbd className="text-xs bg-gray-200 px-1 rounded ml-2">G</kbd>
          </Button>
        )}
        {onAutoLayout && (
          <Button
            size="sm"
            variant="ghost"
            className="px-4 py-2"
            onClick={onAutoLayout}
          >
            <LayoutGrid className="w-4 h-4 mr-2" />
            <span>Auto Layout</span>
            <kbd className="text-xs bg-gray-200 px-1 rounded ml-2">L</kbd>
          </Button>
        )}
        {onOpenConfiguration && (
          <Button
            size="sm"
            variant="ghost"
            className="px-4 py-2"
            onClick={onOpenConfiguration}
          >
            <Sliders className="w-4 h-4 mr-2" />
            <span>Configuration</span>
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="px-4 py-2"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <Settings className="w-4 h-4 mr-2" />
          <span>View Options</span>
          {isExpanded ? <ChevronDown className="w-4 h-4 ml-2" /> : <ChevronUp className="w-4 h-4 ml-2" />}
        </Button>
      </div>
    </div>
  )
}