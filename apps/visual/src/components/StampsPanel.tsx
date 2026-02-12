import { useState, useMemo } from 'react'
import { X, Trash2, Stamp, ChevronRight, ChevronDown, Package, BookOpen } from 'lucide-react'
import type { StampWithAttrs } from '../types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface StampsPanelProps {
  stamps: StampWithAttrs[]
  onClose: () => void
  onDeleteStamp: (stampId: string) => void
}

export function StampsPanel({ stamps, onClose, onDeleteStamp }: StampsPanelProps) {
  const [deleteStamp, setDeleteStamp] = useState<StampWithAttrs | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['templates', 'vocabulary']))

  // Group stamps by kind, then by category
  const groupedStamps = useMemo(() => {
    const templates: Record<string, StampWithAttrs[]> = {}
    const vocabulary: Record<string, StampWithAttrs[]> = {}

    for (const stamp of stamps) {
      const category = stamp.category || 'Uncategorized'
      const target = stamp.kind === 'vocabulary' ? vocabulary : templates

      if (!target[category]) {
        target[category] = []
      }
      target[category].push(stamp)
    }

    return { templates, vocabulary }
  }, [stamps])

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }

  const handleDeleteConfirm = () => {
    if (deleteStamp) {
      onDeleteStamp(deleteStamp.id)
      setDeleteStamp(null)
    }
  }

  const renderStampItem = (stamp: StampWithAttrs) => (
    <div
      key={stamp.id}
      className="grid grid-cols-[auto_1fr_auto] items-center gap-2 p-2 rounded hover:bg-accent/50"
    >
      <Stamp className="h-4 w-4 text-muted-foreground" />
      <div className="min-w-0">
        <div className="text-sm font-medium truncate">{stamp.name}</div>
        {stamp.description && (
          <div className="text-xs text-muted-foreground truncate">{stamp.description}</div>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={(e) => {
          e.stopPropagation()
          setDeleteStamp(stamp)
        }}
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  )

  const renderCategory = (
    categoryName: string,
    stamps: StampWithAttrs[],
    prefix: string
  ) => {
    const key = `${prefix}-${categoryName}`
    const isExpanded = expandedCategories.has(key)

    return (
      <Collapsible key={key} open={isExpanded} onOpenChange={() => toggleCategory(key)}>
        <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 text-sm font-medium hover:bg-accent/50 rounded">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          {categoryName}
          <span className="text-xs text-muted-foreground ml-auto">{stamps.length}</span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="ml-2 border-l pl-2 space-y-1 overflow-hidden">
            {stamps.map(renderStampItem)}
          </div>
        </CollapsibleContent>
      </Collapsible>
    )
  }

  const templateCount = Object.values(groupedStamps.templates).flat().length
  const vocabCount = Object.values(groupedStamps.vocabulary).flat().length

  return (
    <>
      <Card className="w-72 h-full rounded-none border-r border-t-0 border-b-0 border-l-0 flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Stamp className="h-4 w-4" />
            Stamps
          </CardTitle>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>

        <CardContent className="flex-1 min-h-0 p-0 overflow-hidden">
          <ScrollArea className="h-full w-full">
            <div className="px-4 w-full max-w-full">
            {stamps.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">
                <Stamp className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No stamps yet</p>
                <p className="text-xs mt-1">Right-click an entity → Save as stamp</p>
              </div>
            ) : (
              <div className="space-y-4 py-2 w-full max-w-full overflow-hidden">
                {/* Templates Section */}
                {templateCount > 0 && (
                  <Collapsible
                    open={expandedCategories.has('templates')}
                    onOpenChange={() => toggleCategory('templates')}
                  >
                    <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 text-sm font-semibold hover:bg-accent/50 rounded">
                      {expandedCategories.has('templates') ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <Package className="h-4 w-4" />
                      Templates
                      <span className="text-xs text-muted-foreground ml-auto font-normal">{templateCount}</span>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="ml-2 space-y-1 overflow-hidden">
                        {Object.entries(groupedStamps.templates)
                          .sort(([a], [b]) => a.localeCompare(b))
                          .map(([category, stamps]) =>
                            renderCategory(category, stamps, 'template')
                          )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {/* Vocabulary Section */}
                {vocabCount > 0 && (
                  <Collapsible
                    open={expandedCategories.has('vocabulary')}
                    onOpenChange={() => toggleCategory('vocabulary')}
                  >
                    <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 text-sm font-semibold hover:bg-accent/50 rounded">
                      {expandedCategories.has('vocabulary') ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <BookOpen className="h-4 w-4" />
                      Vocabulary
                      <span className="text-xs text-muted-foreground ml-auto font-normal">{vocabCount}</span>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="ml-2 space-y-1 overflow-hidden">
                        {Object.entries(groupedStamps.vocabulary)
                          .sort(([a], [b]) => a.localeCompare(b))
                          .map(([category, stamps]) =>
                            renderCategory(category, stamps, 'vocab')
                          )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </div>
            )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <AlertDialog open={deleteStamp !== null} onOpenChange={(open: boolean) => !open && setDeleteStamp(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Stamp</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteStamp?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
