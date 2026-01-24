/**
 * CardBrowser - Main component for browsing card sets and cards
 *
 * Manages navigation state between set list and card list views.
 * Includes ViewControls for display mode switching.
 */

import type { CardSet, Card, CardViewConfig } from '@/types'
import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { CardSetGrid } from './CardSetGrid'
import { CardGrid } from './CardGrid'
import { CardPreviewModal } from './CardPreviewModal'
import { CardViewProvider } from './CardViewProvider'
import { ViewControls } from './ViewControls'
import { CardBoxVariant } from './CardBox'
import { Button } from '@/components/ui/button'
import { ChevronLeft, Layers } from 'lucide-react'

export interface CardBrowserProps {
  sets: CardSet[]
  /** Cards to display (when viewing a specific set) */
  cards?: Card[]
  /** Currently selected set ID */
  currentSetId?: string
  /** CardBox variant for set cards */
  setVariant?: CardBoxVariant
  /** CardBox variant for individual cards */
  cardVariant?: CardBoxVariant
  /** Initial view configuration */
  initialConfig?: Partial<CardViewConfig>
}

export function CardBrowser({
  sets,
  cards,
  currentSetId,
  setVariant = 'default',
  cardVariant = 'glass',
  initialConfig,
}: CardBrowserProps) {
  const navigate = useNavigate()
  const [selectedCard, setSelectedCard] = useState<Card | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  // Get current set name for breadcrumb
  const currentSet = currentSetId ? sets.find((s) => s.id === currentSetId) : null

  const handleSelectSet = useCallback(
    (setId: string) => {
      navigate(`/cards/set/${setId}`)
    },
    [navigate]
  )

  const handleBack = useCallback(() => {
    navigate('/cards')
  }, [navigate])

  const handleSelectCard = useCallback(
    (cardId: string) => {
      const card = cards?.find((c) => c.id === cardId)
      if (card) {
        setSelectedCard(card)
        setModalOpen(true)
      }
    },
    [cards]
  )

  const handleModalClose = useCallback((open: boolean) => {
    setModalOpen(open)
    if (!open) {
      // Clear selection after animation
      setTimeout(() => setSelectedCard(null), 200)
    }
  }, [])

  // Determine which view controls to show
  const isCardView = Boolean(currentSetId && cards)

  return (
    <CardViewProvider initialConfig={initialConfig}>
      <div className="h-full flex flex-col">
        {/* Header with breadcrumb navigation and view controls */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            {currentSetId ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBack}
                  className="h-8 px-2"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <nav className="flex items-center gap-2 text-sm">
                  <button
                    onClick={handleBack}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    All Sets
                  </button>
                  <span className="text-muted-foreground">/</span>
                  <span className="text-foreground font-medium">
                    {currentSet?.name || 'Unknown Set'}
                  </span>
                </nav>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-muted-foreground" />
                <h1 className="text-lg font-semibold">Card Sets</h1>
              </div>
            )}
          </div>

          {/* View controls on the right */}
          <ViewControls target={isCardView ? 'cards' : 'sets'} />
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-auto">
          {isCardView ? (
            <CardGrid
              cards={cards!}
              onSelectCard={handleSelectCard}
              variant={cardVariant}
            />
          ) : (
            <CardSetGrid
              sets={sets}
              onSelectSet={handleSelectSet}
              variant={setVariant}
            />
          )}
        </div>

        {/* Card preview modal */}
        <CardPreviewModal
          card={selectedCard}
          open={modalOpen}
          onOpenChange={handleModalClose}
        />
      </div>
    </CardViewProvider>
  )
}

export default CardBrowser
