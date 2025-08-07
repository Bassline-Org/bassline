import { useModeContext } from '~/propagation-react/contexts/ModeContext'
import { X } from 'lucide-react'

export function ModeIndicator() {
  const { currentMode, exitMode, valenceSourceIds } = useModeContext()
  
  if (currentMode === 'normal') return null
  
  const getModeInfo = () => {
    switch (currentMode) {
      case 'valence':
        return {
          title: 'Valence Mode',
          description: valenceSourceIds.length > 0 
            ? `${valenceSourceIds.length} source${valenceSourceIds.length > 1 ? 's' : ''} selected - click compatible targets`
            : 'Select sources first',
          color: 'bg-green-500'
        }
      case 'copy':
        return {
          title: 'Copy Mode',
          description: 'Click to paste',
          color: 'bg-blue-500'
        }
      default:
        return null
    }
  }
  
  const info = getModeInfo()
  if (!info) return null
  
  return (
    <div className={`absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 px-4 py-2 rounded-md shadow-lg border ${info.color} text-white`}>
      <div>
        <div className="font-semibold">{info.title}</div>
        <div className="text-sm opacity-90">{info.description}</div>
      </div>
      <button
        onClick={exitMode}
        className="p-1 rounded hover:bg-white/20 transition-colors"
        title="Exit mode (Esc)"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}