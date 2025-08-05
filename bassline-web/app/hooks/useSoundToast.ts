import { toast as sonnerToast } from 'sonner'
import type { ExternalToast } from 'sonner'
import { useSound } from '~/components/SoundSystem'
import { useCallback } from 'react'

export function useSoundToast() {
  // Toast sounds disabled for now - can re-enable later
  // When re-enabling, use quieter volume: useSound('ui/toggle', 0.2)
  // const { play: playNotifySound } = useSound('ui/toggle', 0.2)
  // const { play: playErrorSound } = useSound('ui/error', 0.3)
  // const { play: playSuccessSound } = useSound('ui/success', 0.3)
  
  const toast = useCallback((message: string, options?: ExternalToast) => {
    // playNotifySound()
    return sonnerToast(message, options)
  }, [])
  
  const success = useCallback((message: string, options?: ExternalToast) => {
    // playSuccessSound()
    return sonnerToast.success(message, options)
  }, [])
  
  const error = useCallback((message: string, options?: ExternalToast) => {
    // playErrorSound()
    return sonnerToast.error(message, options)
  }, [])
  
  const info = useCallback((message: string, options?: ExternalToast) => {
    // playNotifySound()
    return sonnerToast.info(message, options)
  }, [])
  
  const warning = useCallback((message: string, options?: ExternalToast) => {
    // playNotifySound()
    return sonnerToast.warning(message, options)
  }, [])
  
  return {
    toast,
    success,
    error,
    info,
    warning
  }
}