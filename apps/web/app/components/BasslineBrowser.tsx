import { useState, useMemo, useRef, useEffect } from 'react'
import { Search, Download, Eye, Star, GitFork, Shield, Clock, Tag, ChevronRight, Grid, List, ChevronDown, X } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Badge } from './ui/badge'
// import { ScrollArea } from './ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import type { Bassline } from '@bassline/bassline'

// Mock data for demonstration
const mockBasslines: BasslineItem[] = [
  {
    id: '1',
    name: 'math-toolkit',
    version: '2.1.0',
    description: 'Comprehensive mathematical operations including calculus, linear algebra, and statistics',
    author: 'mathcore',
    downloads: 15234,
    stars: 342,
    tags: ['math', 'science', 'primitives', 'verified'],
    attributes: {
      'bassline.pure': true,
      'bassline.frozen': true,
      'permissions.modify': 'none'
    },
    lastUpdated: '2024-01-15',
    size: 2456,
    verified: true
  },
  {
    id: '2',
    name: 'ui-components',
    version: '3.0.2',
    description: 'Modern UI components for building interactive dashboards and data visualizations',
    author: 'design-system',
    downloads: 8923,
    stars: 189,
    tags: ['ui', 'visualization', 'interactive'],
    attributes: {
      'bassline.mutable': true,
      'ui.theme': 'adaptive',
      'permissions.modify': 'team'
    },
    lastUpdated: '2024-01-20',
    size: 5632
  },
  {
    id: '3',
    name: 'data-pipeline',
    version: '1.5.0',
    description: 'ETL pipeline components for data transformation and processing',
    author: 'dataflow',
    downloads: 6234,
    stars: 156,
    tags: ['data', 'etl', 'pipeline', 'stream'],
    attributes: {
      'bassline.pure': false,
      'runtime.async': true,
      'permissions.execute': 'owner'
    },
    lastUpdated: '2024-01-18',
    size: 3890
  },
  {
    id: '4',
    name: 'ml-inference',
    version: '0.9.0-beta',
    description: 'Machine learning inference gadgets with pre-trained models',
    author: 'ml-labs',
    downloads: 3456,
    stars: 234,
    tags: ['ml', 'ai', 'inference', 'beta'],
    attributes: {
      'bassline.dynamic-topology': {
        enabled: true,
        schemaContact: '@model-config'
      },
      'runtime.gpu': 'optional'
    },
    lastUpdated: '2024-01-22',
    size: 12456,
    beta: true
  },
  {
    id: '5',
    name: 'crypto-utils',
    version: '1.2.1',
    description: 'Cryptographic utilities for hashing, encryption, and digital signatures',
    author: 'security-core',
    downloads: 4567,
    stars: 98,
    tags: ['crypto', 'security', 'hash', 'verified'],
    attributes: {
      'bassline.pure': true,
      'bassline.frozen': true,
      'permissions.modify': 'none',
      'security.audited': true
    },
    lastUpdated: '2024-01-10',
    size: 1234,
    verified: true
  },
  {
    id: '6',
    name: 'audio-synthesis',
    version: '2.0.0',
    description: 'Real-time audio synthesis and processing components',
    author: 'soundlab',
    downloads: 2345,
    stars: 67,
    tags: ['audio', 'synthesis', 'dsp', 'realtime'],
    attributes: {
      'bassline.mutable': true,
      'runtime.realtime': true,
      'audio.sampleRate': 48000
    },
    lastUpdated: '2024-01-19',
    size: 4567
  },
  {
    id: '7',
    name: 'game-physics',
    version: '1.0.0',
    description: '2D and 3D physics simulation components for game development',
    author: 'gamedev',
    downloads: 1234,
    stars: 45,
    tags: ['game', 'physics', '3d', 'simulation'],
    attributes: {
      'bassline.mutable': true,
      'runtime.fps': 60,
      'physics.engine': 'matter.js'
    },
    lastUpdated: '2024-01-17',
    size: 7890
  },
  {
    id: '8',
    name: 'database-connectors',
    version: '2.3.0',
    description: 'Universal database connectors for SQL and NoSQL databases',
    author: 'data-team',
    downloads: 9876,
    stars: 234,
    tags: ['database', 'sql', 'nosql', 'connector'],
    attributes: {
      'bassline.dynamic-attributes': {
        enabled: true,
        contact: '@db-config'
      },
      'permissions.execute': 'team'
    },
    lastUpdated: '2024-01-21',
    size: 3456
  }
]

interface BasslineItem {
  id: string
  name: string
  version: string
  description: string
  author: string
  downloads: number
  stars: number
  tags: string[]
  attributes: Record<string, any>
  lastUpdated: string
  size: number
  verified?: boolean
  beta?: boolean
}

interface BasslineBrowserProps {
  onImport?: (bassline: BasslineItem) => void
  onPreview?: (bassline: BasslineItem) => void
}

export function BasslineBrowser({ onImport, onPreview }: BasslineBrowserProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [selectedBassline, setSelectedBassline] = useState<BasslineItem | null>(null)
  const [showScrollIndicator, setShowScrollIndicator] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  // Filter basslines based on search and category
  const filteredBasslines = useMemo(() => {
    return mockBasslines.filter(bassline => {
      const matchesSearch = searchQuery === '' || 
        bassline.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        bassline.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        bassline.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      
      const matchesCategory = selectedCategory === 'all' || 
        bassline.tags.includes(selectedCategory)
      
      return matchesSearch && matchesCategory
    })
  }, [searchQuery, selectedCategory])

  // Get unique categories from tags
  const categories = useMemo(() => {
    const allTags = new Set<string>()
    mockBasslines.forEach(b => b.tags.forEach(tag => allTags.add(tag)))
    return ['all', ...Array.from(allTags).sort()]
  }, [])

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatDownloads = (count: number) => {
    if (count < 1000) return count.toString()
    if (count < 1000000) return `${(count / 1000).toFixed(1)}k`
    return `${(count / 1000000).toFixed(1)}M`
  }

  // Check if content is scrollable
  useEffect(() => {
    const checkScrollable = () => {
      if (contentRef.current) {
        const isScrollable = contentRef.current.scrollHeight > contentRef.current.clientHeight
        const isAtBottom = contentRef.current.scrollTop + contentRef.current.clientHeight >= contentRef.current.scrollHeight - 10
        setShowScrollIndicator(isScrollable && !isAtBottom)
      }
    }

    checkScrollable()
    window.addEventListener('resize', checkScrollable)
    
    const contentEl = contentRef.current
    if (contentEl) {
      contentEl.addEventListener('scroll', checkScrollable)
    }

    return () => {
      window.removeEventListener('resize', checkScrollable)
      if (contentEl) {
        contentEl.removeEventListener('scroll', checkScrollable)
      }
    }
  }, [filteredBasslines])

  return (
    <div className="flex h-full w-full bg-background">
      {/* Main Browser */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="border-b px-6 py-4 bg-muted/30">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-semibold">Browse Basslines</h2>
              <Badge variant="secondary">{filteredBasslines.length} available</Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewMode('grid')}
                className={viewMode === 'grid' ? 'bg-muted' : ''}
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewMode('list')}
                className={viewMode === 'list' ? 'bg-muted' : ''}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, description, or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10"
            />
          </div>
        </div>

        {/* Categories */}
        <div className="border-b px-6 py-3 bg-background overflow-x-auto scrollbar-hide">
          <div className="flex gap-2 min-w-max">
            {categories.map(category => (
              <Button
                key={category}
                variant={selectedCategory === category ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(category)}
                className="capitalize whitespace-nowrap"
              >
                {category}
              </Button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 relative">
          <div 
            ref={contentRef}
            className="h-full p-6 overflow-y-auto overflow-x-hidden scrollbar-hide"
          >
            {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
              {filteredBasslines.map(bassline => (
                <Card 
                  key={bassline.id} 
                  className="cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all duration-200 h-full flex flex-col"
                  onClick={() => setSelectedBassline(bassline)}
                >
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg flex items-center gap-2">
                          {bassline.name}
                          {bassline.verified && (
                            <Shield className="h-4 w-4 text-blue-500" />
                          )}
                        </CardTitle>
                        <CardDescription className="text-xs mt-1">
                          v{bassline.version} by {bassline.author}
                        </CardDescription>
                      </div>
                      {bassline.beta && (
                        <Badge variant="outline" className="text-xs">Beta</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col">
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                      {bassline.description}
                    </p>
                    
                    <div className="flex flex-wrap gap-2 mb-4 flex-1">
                      {bassline.tags.slice(0, 3).map(tag => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {bassline.tags.length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{bassline.tags.length - 3}
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <Download className="h-3 w-3" />
                          {formatDownloads(bassline.downloads)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Star className="h-3 w-3" />
                          {bassline.stars}
                        </span>
                      </div>
                      <span>{formatSize(bassline.size)}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredBasslines.map(bassline => (
                <div
                  key={bassline.id}
                  className="flex items-center justify-between p-5 border rounded-lg hover:bg-muted/50 hover:shadow-md transition-all cursor-pointer"
                  onClick={() => setSelectedBassline(bassline)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{bassline.name}</span>
                      {bassline.verified && (
                        <Shield className="h-4 w-4 text-blue-500" />
                      )}
                      <Badge variant="outline" className="text-xs">
                        v{bassline.version}
                      </Badge>
                      {bassline.beta && (
                        <Badge variant="outline" className="text-xs">Beta</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {bassline.description}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span>by {bassline.author}</span>
                      <span className="flex items-center gap-1">
                        <Download className="h-3 w-3" />
                        {formatDownloads(bassline.downloads)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Star className="h-3 w-3" />
                        {bassline.stars}
                      </span>
                      <span>{formatSize(bassline.size)}</span>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              ))}
            </div>
          )}
          </div>
          
          {/* Scroll Indicator */}
          {showScrollIndicator && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none">
              <div className="bg-background/90 backdrop-blur-sm rounded-full px-4 py-2 shadow-lg border flex items-center gap-2 animate-bounce">
                <ChevronDown className="h-4 w-4" />
                <span className="text-sm text-muted-foreground">Scroll for more</span>
                <ChevronDown className="h-4 w-4" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Detail Panel Overlay */}
      {selectedBassline && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 animate-in fade-in duration-200"
            onClick={() => setSelectedBassline(null)}
          />
          
          {/* Panel */}
          <div className="fixed right-0 top-0 h-full w-[400px] lg:w-[450px] bg-background border-l shadow-2xl z-40 animate-in slide-in-from-right duration-300">
            
            <div className="flex flex-col h-full">
              <div className="border-b px-6 py-4 bg-muted/30">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-lg">{selectedBassline.name}</h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedBassline(null)}
                    className="h-8 w-8"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
          
          <div className="flex-1 p-6 overflow-y-auto overflow-x-hidden scrollbar-hide">
            <div className="space-y-6">
              {/* Version and Author */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge>v{selectedBassline.version}</Badge>
                  {selectedBassline.verified && (
                    <Badge variant="secondary" className="gap-1">
                      <Shield className="h-3 w-3" />
                      Verified
                    </Badge>
                  )}
                  {selectedBassline.beta && (
                    <Badge variant="outline">Beta</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  by <span className="font-medium">{selectedBassline.author}</span>
                </p>
              </div>

              {/* Description */}
              <div>
                <h4 className="text-sm font-medium mb-1">Description</h4>
                <p className="text-sm text-muted-foreground">
                  {selectedBassline.description}
                </p>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-2 p-3 bg-muted rounded-lg">
                <div>
                  <p className="text-xs text-muted-foreground">Downloads</p>
                  <p className="font-medium">{selectedBassline.downloads.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Stars</p>
                  <p className="font-medium">{selectedBassline.stars}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Size</p>
                  <p className="font-medium">{formatSize(selectedBassline.size)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Updated</p>
                  <p className="font-medium">{selectedBassline.lastUpdated}</p>
                </div>
              </div>

              {/* Tags */}
              <div>
                <h4 className="text-sm font-medium mb-2">Tags</h4>
                <div className="flex flex-wrap gap-1">
                  {selectedBassline.tags.map(tag => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Attributes */}
              <div>
                <h4 className="text-sm font-medium mb-2">Attributes</h4>
                <div className="space-y-1">
                  {Object.entries(selectedBassline.attributes).map(([key, value]) => (
                    <div key={key} className="flex justify-between text-sm">
                      <span className="text-muted-foreground font-mono text-xs">{key}</span>
                      <span className="font-mono text-xs">
                        {typeof value === 'object' ? 
                          JSON.stringify(value, null, 2) : 
                          String(value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4">
                <Button 
                  className="flex-1"
                  onClick={() => onImport?.(selectedBassline)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Import
                </Button>
                <Button 
                  variant="outline"
                  className="flex-1"
                  onClick={() => onPreview?.(selectedBassline)}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Preview
                </Button>
              </div>
            </div>
          </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}