import { useCallback, useRef, useEffect } from 'react'
import { useFetcher } from 'react-router'
import { Button } from './ui/button'
import { Upload } from 'lucide-react'
import { useSoundToast } from '~/hooks/useSoundToast'

interface BasslineImportWorkerButtonProps {
  variant?: 'icon' | 'text' | 'both'
  size?: 'sm' | 'default'
  parentGroupId?: string
  applySeeds?: boolean
}

export function BasslineImportWorkerButton({ 
  variant = 'icon',
  size = 'sm',
  parentGroupId = 'root',
  applySeeds = true
}: BasslineImportWorkerButtonProps) {
  const fetcher = useFetcher()
  const toast = useSoundToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const handleImport = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    
    try {
      // Read file content
      const text = await file.text()
      
      // Submit to import API
      const formData = new FormData()
      formData.append('bassline', text)
      formData.append('parentGroupId', parentGroupId)
      formData.append('applySeeds', applySeeds.toString())
      
      fetcher.submit(formData, {
        method: 'POST',
        action: '/api/bassline/import'
      })
    } catch (error) {
      console.error('Failed to read file:', error)
      toast.error('Failed to read file')
    }
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [fetcher, parentGroupId, applySeeds, toast])
  
  // Handle the response
  useEffect(() => {
    if (fetcher.data) {
      if (fetcher.data.success) {
        // Report results
        const summary = fetcher.data.summary
        const counts = []
        if (summary.groups > 0) counts.push(`${summary.groups} groups`)
        if (summary.contacts > 0) counts.push(`${summary.contacts} contacts`)
        if (summary.wires > 0) counts.push(`${summary.wires} wires`)
        
        if (counts.length > 0) {
          toast.success(`Imported "${fetcher.data.name}": ${counts.join(', ')}`)
        } else {
          toast.warning('Nothing to import')
        }
        
        // Show warnings if any
        if (summary.warnings && summary.warnings.length > 0) {
          summary.warnings.forEach((warning: string) => {
            console.warn('Import warning:', warning)
          })
        }
      } else {
        toast.error(fetcher.data.error || 'Import failed')
      }
    }
  }, [fetcher.data, toast])
  
  const handleClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])
  
  const isLoading = fetcher.state === 'submitting' || fetcher.state === 'loading'
  
  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.bassline"
        onChange={handleImport}
        style={{ display: 'none' }}
        disabled={isLoading}
      />
      
      {variant === 'icon' ? (
        <Button
          variant="ghost"
          size={size}
          title="Import bassline"
          className="h-8 w-8 p-0"
          onClick={handleClick}
          disabled={isLoading}
        >
          <Upload className={`h-4 w-4 ${isLoading ? 'animate-pulse' : ''}`} />
        </Button>
      ) : variant === 'text' ? (
        <Button
          variant="outline"
          size={size}
          onClick={handleClick}
          disabled={isLoading}
        >
          {isLoading ? 'Importing...' : 'Import Bassline'}
        </Button>
      ) : (
        <Button
          variant="outline"
          size={size}
          className="gap-2"
          onClick={handleClick}
          disabled={isLoading}
        >
          <Upload className={`h-4 w-4 ${isLoading ? 'animate-pulse' : ''}`} />
          {isLoading ? 'Importing...' : 'Import'}
        </Button>
      )}
    </>
  )
}