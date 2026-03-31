import { Sheet } from '@bassline/sheet'

const PREFIX = 'sheet:'

export function listSheets(): string[] {
  const names: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(PREFIX)) names.push(key.slice(PREFIX.length))
  }
  return names.sort()
}

export function loadSheet(name: string): Sheet {
  const saved = localStorage.getItem(PREFIX + name)
  return saved ? Sheet.fromJSON(saved) : new Sheet()
}

export function saveSheet(name: string, sheet: Sheet): void {
  localStorage.setItem(PREFIX + name, JSON.stringify(sheet))
}

export function deleteSheet(name: string): void {
  localStorage.removeItem(PREFIX + name)
}

export function exportSheet(sheet: Sheet, filename: string): void {
  const blob = new Blob([JSON.stringify(sheet.toJSON(), null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function importSheet(file: File): Promise<Sheet> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        resolve(Sheet.fromJSON(reader.result as string))
      } catch (e) {
        reject(e)
      }
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })
}
