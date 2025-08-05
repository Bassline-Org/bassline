import { toast as sonnerToast } from 'sonner'
import type { ExternalToast } from 'sonner'
import { useSound } from '~/components/SoundSystem'
import { useCallback } from 'react'

export function useSoundToast() {
  const { play: playNotifySound } = useSound('ui/toggle')
  const { play: playErrorSound } = useSound('ui/error')
  const { play: playSuccessSound } = useSound('ui/success')
  
  const toast = useCallback((message: string, options?: ExternalToast) => {
    playNotifySound()
    return sonnerToast(message, options)
  }, [playNotifySound])
  
  const success = useCallback((message: string, options?: ExternalToast) => {
    playSuccessSound()
    return sonnerToast.success(message, options)
  }, [playSuccessSound])
  
  const error = useCallback((message: string, options?: ExternalToast) => {
    playErrorSound()
    return sonnerToast.error(message, options)
  }, [playErrorSound])
  
  const info = useCallback((message: string, options?: ExternalToast) => {
    playNotifySound()
    return sonnerToast.info(message, options)
  }, [playNotifySound])
  
  const warning = useCallback((message: string, options?: ExternalToast) => {
    playNotifySound()
    return sonnerToast.warning(message, options)
  }, [playNotifySound])
  
  return {
    toast,
    success,
    error,
    info,
    warning
  }
}