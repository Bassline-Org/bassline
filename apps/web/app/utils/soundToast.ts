import { toast as sonnerToast } from 'sonner'
import type { ExternalToast } from 'sonner'

// This will be initialized in the component that has access to the sound system
let playSoundFunction: ((soundName: string) => void) | null = null

export function initializeSoundToast(playSound: (soundName: string) => void) {
  playSoundFunction = playSound
}

// Create a wrapper that plays sound with toasts
export const toast = Object.assign(
  (message: string, options?: ExternalToast) => {
    playSoundFunction?.('ui/toggle')
    return sonnerToast(message, options)
  },
  {
    success: (message: string, options?: ExternalToast) => {
      playSoundFunction?.('ui/toggle')
      return sonnerToast.success(message, options)
    },

    error: (message: string, options?: ExternalToast) => {
      playSoundFunction?.('ui/error')
      return sonnerToast.error(message, options)
    },

    info: (message: string, options?: ExternalToast) => {
      playSoundFunction?.('ui/toggle')
      return sonnerToast.info(message, options)
    },

    warning: (message: string, options?: ExternalToast) => {
      playSoundFunction?.('ui/toggle')
      return sonnerToast.warning(message, options)
    }
  }
)