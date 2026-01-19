/**
 * Card storage with versioning
 *
 * Cards are the source unit of programs. Every edit appends a new version,
 * preserving full history. Rollback creates a new version with old source
 * (reversible operation).
 *
 * Schema:
 * - card_sets: collections of cards
 * - cards: card metadata with head_version pointer
 * - card_versions: immutable version history
 */

/**
 * Create a card storage instance backed by a database connection
 * @param {object} db - Database connection with query/execute methods
 * @returns {object} Card storage API
 */
export function createCardStorage(db) {
  // Initialize schema
  db.execute(`
    CREATE TABLE IF NOT EXISTS card_sets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `)

  db.execute(`
    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY,
      set_id TEXT REFERENCES card_sets(id),
      head_version INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    )
  `)

  db.execute(`
    CREATE TABLE IF NOT EXISTS card_versions (
      card_id TEXT NOT NULL REFERENCES cards(id),
      version INTEGER NOT NULL,
      source TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (card_id, version)
    )
  `)

  /**
   * Generate a unique ID
   */
  function generateId() {
    return crypto.randomUUID()
  }

  // --- Set operations ---

  /**
   * Create a new card set
   * @param {string} name - Set name
   * @returns {string} Set ID
   */
  function createSet(name) {
    const id = generateId()
    const now = Date.now()
    db.execute(
      'INSERT INTO card_sets (id, name, created_at) VALUES (?, ?, ?)',
      [id, name, now]
    )
    return id
  }

  /**
   * Get a set by ID
   * @param {string} setId - Set ID
   * @returns {object|null} Set object or null
   */
  function getSet(setId) {
    const result = db.query(
      'SELECT id, name, created_at FROM card_sets WHERE id = ?',
      [setId]
    )
    return result.rows[0] || null
  }

  /**
   * List all sets
   * @returns {Array} Array of set objects
   */
  function listSets() {
    const result = db.query(
      'SELECT id, name, created_at FROM card_sets ORDER BY created_at DESC'
    )
    return result.rows
  }

  /**
   * Delete a set (orphans cards, sets their set_id to null)
   * @param {string} setId - Set ID
   */
  function deleteSet(setId) {
    db.execute('UPDATE cards SET set_id = NULL WHERE set_id = ?', [setId])
    db.execute('DELETE FROM card_sets WHERE id = ?', [setId])
  }

  /**
   * Get all cards in a set
   * @param {string} setId - Set ID
   * @returns {Array} Array of card objects with current source
   */
  function getSetCards(setId) {
    const result = db.query(`
      SELECT c.id, c.set_id, c.head_version, c.created_at, v.source
      FROM cards c
      JOIN card_versions v ON c.id = v.card_id AND c.head_version = v.version
      WHERE c.set_id = ?
      ORDER BY c.created_at
    `, [setId])
    return result.rows
  }

  // --- Card operations ---

  /**
   * Create a new card
   * @param {string|null} setId - Set ID (or null for orphan card)
   * @param {string} source - Initial source code
   * @returns {string} Card ID
   */
  function createCard(setId, source) {
    const cardId = generateId()
    const now = Date.now()

    db.execute(
      'INSERT INTO cards (id, set_id, head_version, created_at) VALUES (?, ?, 0, ?)',
      [cardId, setId, now]
    )
    db.execute(
      'INSERT INTO card_versions (card_id, version, source, created_at) VALUES (?, 0, ?, ?)',
      [cardId, source, now]
    )

    return cardId
  }

  /**
   * Edit a card (append new version)
   * @param {string} cardId - Card ID
   * @param {string} newSource - New source code
   * @returns {number} New version number
   */
  function editCard(cardId, newSource) {
    const card = db.query(
      'SELECT head_version FROM cards WHERE id = ?',
      [cardId]
    ).rows[0]

    if (!card) {
      throw new Error(`Card not found: ${cardId}`)
    }

    const newVersion = card.head_version + 1
    const now = Date.now()

    db.execute(
      'INSERT INTO card_versions (card_id, version, source, created_at) VALUES (?, ?, ?, ?)',
      [cardId, newVersion, newSource, now]
    )
    db.execute(
      'UPDATE cards SET head_version = ? WHERE id = ?',
      [newVersion, cardId]
    )

    return newVersion
  }

  /**
   * Get current source for a card
   * @param {string} cardId - Card ID
   * @returns {string|null} Current source or null
   */
  function getCardSource(cardId) {
    const result = db.query(`
      SELECT v.source FROM cards c
      JOIN card_versions v ON c.id = v.card_id AND c.head_version = v.version
      WHERE c.id = ?
    `, [cardId])
    return result.rows[0]?.source ?? null
  }

  /**
   * Get source for a specific version
   * @param {string} cardId - Card ID
   * @param {number} version - Version number
   * @returns {string|null} Source or null
   */
  function getCardVersion(cardId, version) {
    const result = db.query(
      'SELECT source, created_at FROM card_versions WHERE card_id = ? AND version = ?',
      [cardId, version]
    )
    return result.rows[0] || null
  }

  /**
   * Get full version history for a card
   * @param {string} cardId - Card ID
   * @returns {Array} Array of version objects (newest first)
   */
  function getCardHistory(cardId) {
    const result = db.query(`
      SELECT version, source, created_at FROM card_versions
      WHERE card_id = ? ORDER BY version DESC
    `, [cardId])
    return result.rows
  }

  /**
   * Get card metadata
   * @param {string} cardId - Card ID
   * @returns {object|null} Card object or null
   */
  function getCard(cardId) {
    const result = db.query(
      'SELECT id, set_id, head_version, created_at FROM cards WHERE id = ?',
      [cardId]
    )
    return result.rows[0] || null
  }

  /**
   * Rollback card to a previous version (creates new version with old source)
   * @param {string} cardId - Card ID
   * @param {number} toVersion - Version to rollback to
   * @returns {number} New version number
   */
  function rollbackCard(cardId, toVersion) {
    const old = db.query(
      'SELECT source FROM card_versions WHERE card_id = ? AND version = ?',
      [cardId, toVersion]
    ).rows[0]

    if (!old) {
      throw new Error(`Version not found: ${cardId}@${toVersion}`)
    }

    // Rollback creates a new version (preserves history, reversible)
    return editCard(cardId, old.source)
  }

  /**
   * Move card to a different set
   * @param {string} cardId - Card ID
   * @param {string|null} newSetId - New set ID (or null to orphan)
   */
  function moveCard(cardId, newSetId) {
    db.execute('UPDATE cards SET set_id = ? WHERE id = ?', [newSetId, cardId])
  }

  /**
   * Delete a card and all its versions
   * @param {string} cardId - Card ID
   */
  function deleteCard(cardId) {
    db.execute('DELETE FROM card_versions WHERE card_id = ?', [cardId])
    db.execute('DELETE FROM cards WHERE id = ?', [cardId])
  }

  /**
   * List all cards (with current source)
   * @returns {Array} Array of card objects
   */
  function listCards() {
    const result = db.query(`
      SELECT c.id, c.set_id, c.head_version, c.created_at, v.source
      FROM cards c
      JOIN card_versions v ON c.id = v.card_id AND c.head_version = v.version
      ORDER BY c.created_at DESC
    `)
    return result.rows
  }

  return {
    // Set operations
    createSet,
    getSet,
    listSets,
    deleteSet,
    getSetCards,

    // Card operations
    createCard,
    editCard,
    getCard,
    getCardSource,
    getCardVersion,
    getCardHistory,
    rollbackCard,
    moveCard,
    deleteCard,
    listCards,
  }
}

export default createCardStorage
