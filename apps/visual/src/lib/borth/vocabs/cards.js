/**
 * Cards Vocabulary - CRUD operations for borth cards
 *
 * Provides words for listing, creating, editing, running, and deleting cards.
 */

import { Vocab } from '../primitives.js'

export function createCardsVocab(rt) {
  const vocab = new Vocab('cards')
  const saved = rt.current
  rt.current = vocab

  // Helper to get the db
  const getDb = () => {
    if (typeof window !== 'undefined' && window.db) {
      return window.db
    }
    return null
  }

  // cards ( -- cards ) List all cards
  rt.def('cards', async () => {
    const db = getDb()
    if (!db) return [[]]
    const cards = db.cards.listCards()
    return [cards ?? []]
  })

  // card ( id -- card|nil ) Get card by id with source
  rt.def('card', async id => {
    const db = getDb()
    if (!db) return [null]
    const card = db.cards.getCardWithSource(id)
    return [card ?? null]
  })

  // card.source ( card -- source ) Get card source
  rt.def('card.source', card => [card?.source ?? ''])

  // card.id ( card -- id ) Get card id
  rt.def('card.id', card => [card?.id ?? null])

  // card.version ( card -- version ) Get card head version
  rt.def('card.version', card => [card?.head_version ?? 0])

  // card.create ( source -- card ) Create new card (unassigned to any set)
  rt.def('card.create', async source => {
    const db = getDb()
    if (!db) return [null]
    const card = db.cards.createCard(null, source)
    return [card ?? null]
  })

  // card.create-in ( set-id source -- card ) Create new card in a specific set
  rt.def('card.create-in', async (setId, source) => {
    const db = getDb()
    if (!db) return [null]
    const card = db.cards.createCard(setId, source)
    return [card ?? null]
  })

  // card.update ( card source -- card ) Update card source (creates new version)
  rt.def('card.update', async (card, source) => {
    const db = getDb()
    if (!db || !card?.id) return [null]
    db.cards.editCard(card.id, source)
    // Fetch updated card
    const updated = db.cards.getCardWithSource(card.id)
    return [updated ?? null]
  })

  // card.run ( card -- ) Run a card
  rt.def('card.run', async card => {
    if (card?.source) {
      await rt.run(card.source)
    }
  })

  // card.delete ( card -- ) Delete a card
  rt.def('card.delete', async card => {
    const db = getDb()
    if (!db || !card?.id) return
    db.cards.deleteCard(card.id)
  })

  // card.move ( card set-id -- ) Move card to a set (or null for unassigned)
  rt.def('card.move', async (card, setId) => {
    const db = getDb()
    if (!db || !card?.id) return
    db.cards.moveCard(card.id, setId)
  })

  // --- Card Sets ---

  // card-sets ( -- sets ) List all card sets
  rt.def('card-sets', async () => {
    const db = getDb()
    if (!db) return [[]]
    const sets = db.cards.listSets()
    return [sets ?? []]
  })

  // card-set ( id -- set|nil ) Get card set by id
  rt.def('card-set', async id => {
    const db = getDb()
    if (!db) return [null]
    const set = db.cards.getSet(id)
    return [set ?? null]
  })

  // card-set.cards ( set -- cards ) Get cards in a set
  rt.def('card-set.cards', async set => {
    const db = getDb()
    if (!db || !set?.id) return [[]]
    const cards = db.cards.getSetCards(set.id)
    return [cards ?? []]
  })

  // card-set.create ( name -- set ) Create a new card set
  rt.def('card-set.create', async name => {
    const db = getDb()
    if (!db) return [null]
    const set = db.cards.createSet(name)
    return [set ?? null]
  })

  // card-set.delete ( set -- ) Delete a card set (cards become unassigned)
  rt.def('card-set.delete', async set => {
    const db = getDb()
    if (!db || !set?.id) return
    db.cards.deleteSet(set.id)
  })

  rt.current = saved
  return vocab
}
