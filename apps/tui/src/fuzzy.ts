// Simple fuzzy matching for command palette

export function fuzzyMatch(query: string, text: string): { match: boolean; score: number } {
  if (!query) return { match: true, score: 0 }

  const queryLower = query.toLowerCase()
  const textLower = text.toLowerCase()

  // Exact match gets highest score
  if (textLower === queryLower) {
    return { match: true, score: 1000 }
  }

  // Starts with gets high score
  if (textLower.startsWith(queryLower)) {
    return { match: true, score: 500 + (queryLower.length / textLower.length) * 100 }
  }

  // Contains gets medium score
  if (textLower.includes(queryLower)) {
    return { match: true, score: 200 + (queryLower.length / textLower.length) * 100 }
  }

  // Fuzzy character match
  let queryIndex = 0
  let score = 0
  let lastMatchIndex = -1

  for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
    if (textLower[i] === queryLower[queryIndex]) {
      score += 10
      // Bonus for consecutive matches
      if (lastMatchIndex === i - 1) {
        score += 5
      }
      // Bonus for matching at word boundaries
      if (i === 0 || text[i - 1] === ' ' || text[i - 1] === '-' || text[i - 1] === '_') {
        score += 10
      }
      lastMatchIndex = i
      queryIndex++
    }
  }

  if (queryIndex === queryLower.length) {
    return { match: true, score }
  }

  return { match: false, score: 0 }
}

export function sortByFuzzyScore<T>(items: T[], query: string, getText: (item: T) => string): T[] {
  if (!query) return items

  return items
    .map(item => ({ item, ...fuzzyMatch(query, getText(item)) }))
    .filter(x => x.match)
    .sort((a, b) => b.score - a.score)
    .map(x => x.item)
}
