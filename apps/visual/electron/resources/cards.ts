/**
 * Cards Resource
 *
 * Provides access to Borth source code cards and card sets.
 */

import { resource, routes, bind } from '@bassline/core'
import type { db as DbType } from '../db'

type Db = typeof DbType

interface ResourceHeaders {
  path?: string
  params?: Record<string, string>
}

export function createCardsResource(db: Db) {
  // Card set routes
  const setsResource = routes({
    // GET /cards/sets - list all sets with card counts
    // PUT /cards/sets - create new set
    '': resource({
      get: async () => {
        const sets = db.cards.listSets()
        // Add card count to each set
        const setsWithCounts = sets.map(set => ({
          ...set,
          card_count: db.cards.getSetCardCount(set.id),
        }))
        return { headers: { type: 'js/arr' }, body: setsWithCounts }
      },
      put: async (_h: ResourceHeaders, body: { name?: string }) => {
        const set = db.cards.createSet(body?.name || 'Untitled Set')
        return { headers: { created: true }, body: set }
      },
    }),

    // GET /cards/sets/:setId - get set with card count
    // PUT /cards/sets/:setId with null - delete set
    unknown: bind('setId', routes({
      '': resource({
        get: async (h: ResourceHeaders) => {
          const setId = h.params?.setId || ''
          const set = db.cards.getSet(setId)
          if (!set) {
            return { headers: { condition: 'not-found' }, body: null }
          }
          return {
            headers: {},
            body: {
              ...set,
              card_count: db.cards.getSetCardCount(setId),
            },
          }
        },
        put: async (h: ResourceHeaders, body: unknown) => {
          const setId = h.params?.setId || ''
          if (body === null) {
            db.cards.deleteSet(setId)
            return { headers: { deleted: true }, body: null }
          }
          return { headers: { condition: 'not-implemented' }, body: null }
        },
      }),

      // GET /cards/sets/:setId/cards - get cards in set
      cards: resource({
        get: async (h: ResourceHeaders) => {
          const setId = h.params?.setId || ''
          const cards = db.cards.getSetCards(setId)
          return { headers: { type: 'js/arr' }, body: cards }
        },
      }),
    })),
  })

  // Individual card routes
  const cardResource = bind('cardId', resource({
    // GET /cards/:cardId - get card with source
    get: async (h: ResourceHeaders) => {
      const cardId = h.params?.cardId || ''
      const card = db.cards.getCardWithSource(cardId)
      if (!card) {
        return { headers: { condition: 'not-found' }, body: null }
      }
      return { headers: {}, body: card }
    },
    // PUT /cards/:cardId with null - delete card
    // PUT /cards/:cardId with { source } - edit card
    put: async (h: ResourceHeaders, body: unknown) => {
      const cardId = h.params?.cardId || ''
      if (body === null) {
        db.cards.deleteCard(cardId)
        return { headers: { deleted: true }, body: null }
      }
      if (body && typeof body === 'object' && 'source' in body) {
        const newVersion = db.cards.editCard(cardId, (body as { source: string }).source)
        const updated = db.cards.getCardWithSource(cardId)
        return { headers: { updated: true, version: newVersion }, body: updated }
      }
      return { headers: { condition: 'not-implemented' }, body: null }
    },
  }))

  return routes({
    // GET /cards - list all cards
    // PUT /cards - create new card
    '': resource({
      get: async () => {
        const cards = db.cards.listCards()
        return { headers: { type: 'js/arr' }, body: cards }
      },
      put: async (_h: ResourceHeaders, body: { set_id?: string | null; source?: string }) => {
        const card = db.cards.createCard(body?.set_id ?? null, body?.source || '')
        return { headers: { created: true }, body: card }
      },
    }),

    // /cards/sets/*
    sets: setsResource,

    // /cards/:cardId
    unknown: cardResource,
  })
}
