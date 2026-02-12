import { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { ChevronDown, Check, Search } from 'lucide-react'

interface FontPickerProps {
  value: string
  onChange: (font: string) => void
  placeholder?: string
}

declare global {
  interface Window {
    fonts: {
      list: () => Promise<string[]>
      search: (query: string) => Promise<string[]>
    }
  }
}

export function FontPicker({ value, onChange, placeholder = 'Select font...' }: FontPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [fonts, setFonts] = useState<string[]>([])
  const [filteredFonts, setFilteredFonts] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Load fonts on first open
  useEffect(() => {
    if (isOpen && fonts.length === 0) {
      setLoading(true)
      window.fonts.list().then((f) => {
        setFonts(f)
        setFilteredFonts(f)
        setLoading(false)
      })
    }
  }, [isOpen, fonts.length])

  // Filter fonts when search changes
  useEffect(() => {
    if (search.trim()) {
      const q = search.toLowerCase()
      setFilteredFonts(fonts.filter((f) => f.toLowerCase().includes(q)))
    } else {
      setFilteredFonts(fonts)
    }
    setHighlightedIndex(0)
  }, [search, fonts])

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Scroll highlighted item into view
  useEffect(() => {
    if (listRef.current && highlightedIndex >= 0) {
      const item = listRef.current.children[highlightedIndex] as HTMLElement
      if (item) {
        item.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [highlightedIndex])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown') {
        setIsOpen(true)
        e.preventDefault()
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex((i) => Math.min(i + 1, filteredFonts.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex((i) => Math.max(i - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (filteredFonts[highlightedIndex]) {
          onChange(filteredFonts[highlightedIndex])
          setIsOpen(false)
          setSearch('')
        }
        break
      case 'Escape':
        setIsOpen(false)
        setSearch('')
        break
    }
  }

  const selectFont = (font: string) => {
    onChange(font)
    setIsOpen(false)
    setSearch('')
  }

  // Extract primary font from value (first font in stack)
  const displayValue = value ? value.split(',')[0].replace(/["']/g, '').trim() : ''

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen)
          if (!isOpen) {
            setTimeout(() => inputRef.current?.focus(), 0)
          }
        }}
        onKeyDown={handleKeyDown}
        className={cn(
          'flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          !displayValue && 'text-muted-foreground'
        )}
      >
        <span
          className="truncate"
          style={displayValue ? { fontFamily: displayValue } : undefined}
        >
          {displayValue || placeholder}
        </span>
        <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg">
          {/* Search input */}
          <div className="flex items-center border-b px-2">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <Input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search fonts..."
              className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>

          {/* Font list */}
          <div ref={listRef} className="max-h-60 overflow-y-auto p-1">
            {loading ? (
              <div className="py-4 text-center text-sm text-muted-foreground">
                Loading fonts...
              </div>
            ) : filteredFonts.length === 0 ? (
              <div className="py-4 text-center text-sm text-muted-foreground">
                No fonts found
              </div>
            ) : (
              filteredFonts.slice(0, 100).map((font, index) => (
                <button
                  key={font}
                  type="button"
                  onClick={() => selectFont(font)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={cn(
                    'relative flex w-full items-center rounded-sm py-1.5 pl-8 pr-2 text-sm',
                    'cursor-pointer select-none outline-none',
                    index === highlightedIndex && 'bg-accent text-accent-foreground',
                    font === displayValue && 'font-medium'
                  )}
                  style={{ fontFamily: font }}
                >
                  {font === displayValue && (
                    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                      <Check className="h-4 w-4" />
                    </span>
                  )}
                  {font}
                </button>
              ))
            )}
            {filteredFonts.length > 100 && (
              <div className="py-2 text-center text-xs text-muted-foreground">
                Showing 100 of {filteredFonts.length} fonts. Type to filter.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
