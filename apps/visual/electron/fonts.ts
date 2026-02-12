import { getFonts } from 'font-list'

let fontCache: string[] | null = null

export async function listSystemFonts(): Promise<string[]> {
  if (!fontCache) {
    const fonts = await getFonts()
    // Clean up font names (remove surrounding quotes)
    fontCache = fonts.map(f => f.replace(/^["']|["']$/g, '')).sort()
  }
  return fontCache
}

export function searchFonts(fonts: string[], query: string): string[] {
  if (!query.trim()) return fonts
  const q = query.toLowerCase()
  return fonts.filter(f => f.toLowerCase().includes(q))
}
