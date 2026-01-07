import { useState } from 'react'
import { useTheme } from '../providers/ThemeProvider'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FontPicker } from './FontPicker'

type Category = 'background' | 'foreground' | 'border' | 'accent' | 'semantic' | 'graph' | 'typography'

const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'background', label: 'Backgrounds' },
  { id: 'foreground', label: 'Text' },
  { id: 'border', label: 'Borders' },
  { id: 'accent', label: 'Accent' },
  { id: 'semantic', label: 'Semantic' },
  { id: 'graph', label: 'Graph' },
  { id: 'typography', label: 'Typography' },
]

export function ThemeEditor() {
  const { theme, colors, typography, tokens, updateColor, updateTypography } = useTheme()
  const [activeCategory, setActiveCategory] = useState<Category>('background')

  if (!theme) return null

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-medium">
          Editing: <span className="font-semibold">{theme.name}</span>
        </h3>
        {theme.isSystem && <Badge variant="secondary">System</Badge>}
      </div>

      <Tabs value={activeCategory} onValueChange={(v) => setActiveCategory(v as Category)}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          {CATEGORIES.map((cat) => (
            <TabsTrigger key={cat.id} value={cat.id} className="text-xs">
              {cat.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {CATEGORIES.map((cat) => (
          <TabsContent key={cat.id} value={cat.id} className="mt-4 space-y-3">
            {tokens
              .filter((t) => t.category === cat.id)
              .map((token) => (
                <TokenEditor
                  key={token.id}
                  token={token}
                  value={cat.id === 'typography' ? typography[token.id] : colors[token.id]}
                  onChange={cat.id === 'typography' ? updateTypography : updateColor}
                  isTypography={cat.id === 'typography'}
                />
              ))}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}

interface TokenEditorProps {
  token: { id: string; label: string; description: string }
  value: string
  onChange: (tokenId: string, value: string) => void
  isTypography: boolean
}

function TokenEditor({ token, value, onChange, isTypography }: TokenEditorProps) {
  const [inputValue, setInputValue] = useState(value || '')

  const handleBlur = () => {
    if (inputValue !== value) {
      onChange(token.id, inputValue)
    }
  }

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setInputValue(newValue)
    onChange(token.id, newValue)
  }

  const isFontSize = token.id === 'font-size-base'
  const isFontFamily = token.id.startsWith('font-') && !isFontSize
  const isColor = !isTypography

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <Label className="text-sm">{token.label}</Label>
        <code className="text-xs text-muted-foreground">{token.id}</code>
      </div>

      {isColor ? (
        <div className="flex gap-2">
          <input
            type="color"
            value={value || '#000000'}
            onChange={handleColorChange}
            className="h-9 w-12 cursor-pointer rounded border border-input bg-transparent p-1"
          />
          <Input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={(e) => e.key === 'Enter' && handleBlur()}
            placeholder="#000000"
            className="flex-1 font-mono text-sm"
          />
        </div>
      ) : isFontSize ? (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={(e) => e.key === 'Enter' && handleBlur()}
            min={10}
            max={24}
            className="w-20"
          />
          <span className="text-sm text-muted-foreground">px</span>
        </div>
      ) : isFontFamily ? (
        <FontPicker
          value={value || ''}
          onChange={(font) => onChange(token.id, font)}
          placeholder="Select font..."
        />
      ) : (
        <Input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={(e) => e.key === 'Enter' && handleBlur()}
          placeholder="Value..."
        />
      )}

      {token.description && (
        <p className="text-xs text-muted-foreground">{token.description}</p>
      )}
    </div>
  )
}
