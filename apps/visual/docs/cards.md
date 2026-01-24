# Cards

The fundamental unit of source code in Borth.

## What is a Card?

A **card** is a chunk of borth source code that executes as a unit. It's the thing you edit, the thing you run, and the thing visual entities reference.

Cards are like:
- Smalltalk "doits" or method definitions
- Jupyter notebook cells
- A file in traditional programming

But cards are more than just text. They capture:
- The source code itself
- The vocabulary context (`in:`, `using:`)
- The sequence of operations (order matters)

## Why Cards?

### Words Are Lossy

You can't reconstruct a program from just its compiled words because:

1. **Context matters** - `in:` and `using:` affect how words resolve
2. **Order matters** - `immediate` modifies the previous definition
3. **Modifications happen** - words can be altered after definition

A card captures the full picture.

### Cards Are the Source of Truth

```
Card (source text)
    │
    └── run ──► Runtime state (words, vocabs)
                    │
                    └── indexed in DB (for queries)
```

The runtime is **derived** from cards. If you have all the cards, you can rebuild the runtime.

## Data Model

### Minimal Schema

```sql
CREATE TABLE cards (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  created_at INTEGER,
  modified_at INTEGER
);
```

That's it. Cards are just source text with an ID.

### Optional: Word Index

For fast lookups and refactoring, we can maintain a derived index:

```sql
CREATE TABLE word_index (
  name TEXT NOT NULL,
  vocab TEXT NOT NULL,
  card_id TEXT REFERENCES cards(id),
  PRIMARY KEY (name, vocab)
);
```

This is rebuilt by running cards. It's a cache, not the source of truth.

## Visual Entities as Cards

Every visual element is (or references) a card. The card defines the element's behavior.

```javascript
entity = {
  id: "node-123",
  attrs: {
    card_id: "card-456",  // the card that defines behavior
    count: 0,             // state lives in attrs
  }
}
```

Or more directly: the entity IS a card row in the database.

### Late-Bound Self

When a card runs in a visual context, `self` is bound to the current entity:

```borth
: render
  self ' count .prop .log ;  ( self is bound at runtime )
```

Multiple entities can share the same card. Each gets `self` bound to itself when its handlers run.

### Behaviors from Vocabularies

Cards can define behaviors in vocabularies:

```borth
in: ui ;

: counter/render
  self ' count .prop self .set-label ;

: counter/click
  self ' count .prop 1 + self ' count .prop! ;
```

Then entities reference the behavior:

```javascript
entity.attrs.behavior = "ui:counter"
```

The system looks up `ui:counter/render`, `ui:counter/click`, etc.

## Card Operations

### Run

Execute a card's source, updating the runtime:

```javascript
async function runCard(cardId) {
  const card = await db.get('SELECT * FROM cards WHERE id = ?', cardId)
  await runtime.run(card.source)
}
```

### Fork

Create a new card from an existing one:

```javascript
async function forkCard(cardId) {
  const card = await db.get('SELECT * FROM cards WHERE id = ?', cardId)
  const newId = uuid()
  await db.run(
    'INSERT INTO cards (id, source, created_at) VALUES (?, ?, ?)',
    newId, card.source, Date.now()
  )
  return newId
}
```

### Edit

Update a card's source and re-run:

```javascript
async function editCard(cardId, newSource) {
  await db.run(
    'UPDATE cards SET source = ?, modified_at = ? WHERE id = ?',
    newSource, Date.now(), cardId
  )
  // Re-run to update runtime
  await runtime.run(newSource)
  // Update word index
  await rebuildIndex(cardId)
}
```

### Merge

Apply changes from one card to another (for syncing/collaboration):

```javascript
async function mergeCard(sourceId, targetId) {
  const source = await db.get('SELECT * FROM cards WHERE id = ?', sourceId)
  await editCard(targetId, source.source)
}
```

## Context Stack

When cards run, they can establish context for nested cards:

```
App Card (in: app ; using: core ui ;)
├── defines shared words
├── establishes vocabularies
│
└── Component Card (uses app's context)
    └── can use words from app
```

React context providers mirror this:

```jsx
<CardContext card={appCard}>
  <CardContext card={componentCard}>
    <Entity />
  </CardContext>
</CardContext>
```

## Refactoring

With cards as structured data, refactoring becomes queries:

### Find Usages

```sql
-- Find cards that might use a word (text search)
SELECT * FROM cards WHERE source LIKE '%word-name%';

-- Or with word index:
SELECT c.* FROM cards c
JOIN word_index w ON c.id = w.card_id
WHERE w.name = 'word-name';
```

### Rename

```javascript
async function renameWord(oldName, newName) {
  // Find all cards that use the word
  const cards = await db.all(
    'SELECT * FROM cards WHERE source LIKE ?',
    `%${oldName}%`
  )

  // Update each card
  for (const card of cards) {
    const newSource = card.source.replace(
      new RegExp(`\\b${oldName}\\b`, 'g'),
      newName
    )
    await editCard(card.id, newSource)
  }
}
```

### Extract to Vocabulary

```javascript
async function extractToVocab(cardId, wordNames, newVocabName) {
  const card = await db.get('SELECT * FROM cards WHERE id = ?', cardId)

  // Parse out the word definitions
  const extracted = extractDefinitions(card.source, wordNames)

  // Create new card for the vocabulary
  const vocabCard = `in: ${newVocabName} ;\n${extracted}`
  const vocabCardId = await createCard(vocabCard)

  // Update original to use the new vocab
  const remaining = removeDefinitions(card.source, wordNames)
  const updated = `using: ${newVocabName} ;\n${remaining}`
  await editCard(cardId, updated)

  return vocabCardId
}
```

## Runtime Integration

### Loading

On startup, load and run all cards:

```javascript
async function loadRuntime() {
  const rt = createRuntime()

  // Load cards in dependency order (or just creation order)
  const cards = await db.all('SELECT * FROM cards ORDER BY created_at')

  for (const card of cards) {
    try {
      await rt.run(card.source)
    } catch (e) {
      console.error(`Card ${card.id} failed:`, e)
    }
  }

  return rt
}
```

### Change Tracking

When the runtime changes (via REPL, UI edit, etc.), create/update a card:

```javascript
// Intercept definitions
runtime.onDefine = async (word, source) => {
  // Find or create card for this definition
  const cardId = await findOrCreateCard(source)
  word.cardId = cardId
}
```

## Relationship to Blits

Blits are self-contained SQLite files that can contain cards:

```
myapp.blit (SQLite)
├── cards (table)
│   ├── card-1: "in: app ; : main ... ;"
│   └── card-2: "in: ui ; : button ... ;"
├── _cells
├── _store
└── _fn
```

Loading a blit loads its cards into the runtime.

## Open Questions

1. **Card dependencies** - Should cards explicitly declare dependencies on other cards?

2. **Versioning** - Do we keep history of card edits? (Like Smalltalk's changes file)

3. **Compilation caching** - Should we cache compiled forms, or always derive from source?

4. **Card identity** - When is a card "the same" card? (Content-addressed vs ID-based)

## Summary

- **Card** = unit of source code
- **Cards are primary** - words/vocabs are derived
- **Visual entities = cards** (or reference cards)
- **Late-bound self** - enables shared behaviors
- **Simple DB schema** - just id + source
- **Refactoring via queries** - structured, not text munging
