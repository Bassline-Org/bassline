import { atom, useAtom } from 'jotai'

export type Theme = 'light' | 'dark'
const defaultTheme = 'dark'

const themeBase = atom<Theme | null>(null)
export const theme = atom(
  get => get(themeBase),
  (_, set, newTheme: Theme) => {
    set(themeBase, newTheme)
    const root = window?.document?.documentElement
    if (root) {
      root.classList.remove('light', 'dark')
      root.classList.add(newTheme)
    }
  }
)

export function useTheme() {
  const [themeValue, setTheme] = useAtom(theme)
  if (themeValue === null) setTheme('dark')
  return [themeValue ?? defaultTheme, setTheme] as const
}
