import { useState } from 'react'
import { Library, X } from 'lucide-react'
import { Button } from './ui/button'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { BasslineBrowser } from './BasslineBrowser'
import { useSoundToast } from '~/hooks/useSoundToast'

interface BasslineBrowserButtonProps {
  variant?: 'icon' | 'text' | 'both'
  size?: 'sm' | 'default'
}

export function BasslineBrowserButton({ 
  variant = 'icon',
  size = 'sm'
}: BasslineBrowserButtonProps) {
  const [open, setOpen] = useState(false)
  const toast = useSoundToast()
  
  const handleImport = async (bassline: any) => {
    toast.success(`Importing ${bassline.name} v${bassline.version}...`)
    // TODO: Implement actual import using the worker
    console.log('Import bassline:', bassline)
    setOpen(false)
  }
  
  const handlePreview = (bassline: any) => {
    toast.info(`Preview for ${bassline.name} coming soon!`)
    console.log('Preview bassline:', bassline)
  }
  
  const getButtonContent = () => {
    if (variant === 'icon') {
      return <Library className="h-4 w-4" />
    } else if (variant === 'text') {
      return 'Browse Basslines'
    } else {
      return (
        <>
          <Library className="h-4 w-4" />
          Browse
        </>
      )
    }
  }
  
  return (
    <>
      <Button
        variant="outline"
        size={size}
        onClick={() => setOpen(true)}
        title="Browse basslines"
        className={variant === 'icon' ? 'h-8 w-8 p-0' : variant === 'both' ? 'gap-2' : ''}
      >
        {getButtonContent()}
      </Button>
      
      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-50 h-[95vh] w-[95vw] translate-x-[-50%] translate-y-[-50%] bg-background rounded-lg shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
            <div className="relative h-full w-full overflow-hidden rounded-lg">
              <DialogPrimitive.Close asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-4 right-4 z-10 bg-background/80 backdrop-blur-sm"
                >
                  <X className="h-4 w-4" />
                </Button>
              </DialogPrimitive.Close>
              <BasslineBrowser 
                onImport={handleImport}
                onPreview={handlePreview}
              />
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  )
}