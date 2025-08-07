import { useCallback, useEffect } from 'react'
import { useFetcher } from 'react-router'
import { Button } from './ui/button'
import { Download } from 'lucide-react'
import { useSoundToast } from '~/hooks/useSoundToast'

interface BasslineExportWorkerButtonProps {
  groupId?: string
  variant?: 'icon' | 'text' | 'both'
  size?: 'sm' | 'default'
  includeValues?: boolean
  exportAll?: boolean
}

export function BasslineExportWorkerButton({ 
  groupId = 'root',
  variant = 'icon',
  size = 'sm',
  includeValues = true,
  exportAll = false
}: BasslineExportWorkerButtonProps) {
  const fetcher = useFetcher()
  const toast = useSoundToast()
  
  const handleExport = useCallback(() => {
    const formData = new FormData()
    formData.append('groupId', groupId)
    formData.append('includeValues', includeValues.toString())
    formData.append('exportAll', exportAll.toString())
    
    fetcher.submit(formData, {
      method: 'POST',
      action: '/api/bassline/export'
    })
  }, [fetcher, groupId, includeValues, exportAll])
  
  // Handle the response
  useEffect(() => {
    if (fetcher.data) {
      if (fetcher.data.success) {
        // Create download
        const blob = new Blob([fetcher.data.bassline], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = fetcher.data.filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        
        toast.success(`Exported successfully`)
      } else {
        toast.error(fetcher.data.error || 'Export failed')
      }
    }
  }, [fetcher.data, toast])
  
  const isLoading = fetcher.state === 'submitting' || fetcher.state === 'loading'
  
  if (variant === 'icon') {
    return (
      <Button
        variant="ghost"
        size={size}
        title="Export as bassline"
        className="h-8 w-8 p-0"
        onClick={handleExport}
        disabled={isLoading}
      >
        <Download className={`h-4 w-4 ${isLoading ? 'animate-pulse' : ''}`} />
      </Button>
    )
  }
  
  if (variant === 'text') {
    return (
      <Button
        variant="outline"
        size={size}
        onClick={handleExport}
        disabled={isLoading}
      >
        {isLoading ? 'Exporting...' : 'Export Bassline'}
      </Button>
    )
  }
  
  return (
    <Button
      variant="outline"
      size={size}
      className="gap-2"
      onClick={handleExport}
      disabled={isLoading}
    >
      <Download className={`h-4 w-4 ${isLoading ? 'animate-pulse' : ''}`} />
      {isLoading ? 'Exporting...' : 'Export'}
    </Button>
  )
}