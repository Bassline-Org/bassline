import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { Draggable } from 'gsap/Draggable'
import { CustomEase } from 'gsap/CustomEase'
import { MorphSVGPlugin } from 'gsap/MorphSVGPlugin'
import { InertiaPlugin } from 'gsap/InertiaPlugin'
import { CustomWiggle } from 'gsap/CustomWiggle'
import { Physics2DPlugin } from 'gsap/Physics2DPlugin'
import { Observer } from 'gsap/Observer'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Flip } from 'gsap/Flip'
import { SplitText } from 'gsap/SplitText'
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin'
import { MotionPathPlugin } from 'gsap/MotionPathPlugin'
import { ReactFlow, ReactFlowProvider } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { PropsWithChildren } from 'react'
import { CustomEdge, DrawnNode, TextNode } from './Flow.tsx'
import { node, pos } from './nodes.ts'
import { useTheme } from './atoms/theme.ts'
import { useEdits, useGraphChanges, useGraphState } from './atoms/graph.ts'
import React from 'react'
import {
  InspectorProvider,
  PaneContainer,
  views,
  actions,
  searches,
  phlowViews,
  phlowActions,
  phlowSearches,
  PRIORITY,
  type Viewable,
  useInspector,
} from '@bassline/ui'
import '@bassline/ui/styles.css'
// import { Inspectors } from './inspectors'
import { Button } from './components/ui/button'
import { Card } from './components/ui/card'
import { z } from 'zod'

gsap.registerPlugin(
  useGSAP,
  Draggable,
  CustomEase,
  MorphSVGPlugin,
  InertiaPlugin,
  CustomWiggle,
  Physics2DPlugin,
  Observer,
  ScrollTrigger,
  Flip,
  SplitText,
  DrawSVGPlugin,
  MotionPathPlugin
)

const nodeTypes = {
  text: TextNode,
  drawn: DrawnNode,
}
const edgeTypes = {
  custom: CustomEdge,
}

export function Flow({ children }: PropsWithChildren) {
  const { nodes, edges } = useGraphState()
  const { onNodesChange, onEdgesChange } = useGraphChanges()
  const edits = useEdits()
  const [theme] = useTheme()
  return (
    <div id="bassline-root" className="h-screen overflow-hidden">
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeContextMenu={(_, node) => edits.copy(node.id)}
          onDelete={({ nodes, edges }) => {
            nodes.forEach(n => edits.remove({ node: n.id }))
            edges.forEach(e => edits.remove({ edge: e.id }))
          }}
          edgesReconnectable
          onReconnect={(old, updated) => {
            edits.define({ edge: { id: old.id, ...updated } })
          }}
          onConnect={connection => {
            edits.connect(connection)
          }}
          colorMode={theme}
          onPaneContextMenu={e => {
            const n = node(pos(e.clientX, e.clientY), { data: {} })
            n.data.label = n.id
            edits.define({ node: n })
          }}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          proOptions={{ hideAttribution: true }}
        >
          {children}
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  )
}

/**
 * Preview panel component - renders text with basic markdown-style formatting
 * Right-click on any line to inspect it
 */
function PreviewPanel({ doc, onInspect }: { doc: TextDocument; onInspect: (target: unknown, label?: string) => void }) {
  const lines = doc.text.split('\n')

  const handleContextMenu = (e: React.MouseEvent, line: string, index: number) => {
    e.preventDefault()
    onInspect({ line, index, length: line.length }, `Line ${index + 1}`)
  }

  return (
    <div className="p-4 space-y-2">
      {lines.map((line, i) => {
        if (line.startsWith('# ')) {
          return (
            <h1 key={i} className="text-2xl font-bold" onContextMenu={e => handleContextMenu(e, line, i)}>
              {line.slice(2)}
            </h1>
          )
        }
        if (line.startsWith('## ')) {
          return (
            <h2 key={i} className="text-xl font-semibold" onContextMenu={e => handleContextMenu(e, line, i)}>
              {line.slice(3)}
            </h2>
          )
        }
        if (line.trim() === '') {
          return <div key={i} className="h-2" />
        }
        return (
          <p key={i} className="text-sm" onContextMenu={e => handleContextMenu(e, line, i)}>
            {line}
          </p>
        )
      })}
    </div>
  )
}

/**
 * Statistics panel component - shows word/character counts
 */
function StatsPanel({ doc }: { doc: TextDocument }) {
  const text = doc.text
  const chars = text.length
  const words = text.split(/\s+/).filter(w => w.length > 0).length
  const lines = text.split('\n').length
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0).length

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-4">Document Statistics</h2>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-muted rounded-lg p-4 text-center">
          <div className="text-3xl font-bold">{chars}</div>
          <div className="text-sm text-muted-foreground">Characters</div>
        </div>
        <div className="bg-muted rounded-lg p-4 text-center">
          <div className="text-3xl font-bold">{words}</div>
          <div className="text-sm text-muted-foreground">Words</div>
        </div>
        <div className="bg-muted rounded-lg p-4 text-center">
          <div className="text-3xl font-bold">{lines}</div>
          <div className="text-sm text-muted-foreground">Lines</div>
        </div>
        <div className="bg-muted rounded-lg p-4 text-center">
          <div className="text-3xl font-bold">{paragraphs}</div>
          <div className="text-sm text-muted-foreground">Paragraphs</div>
        </div>
      </div>
    </div>
  )
}

class TextDocument {
  text: string;

  [phlowViews] = views<TextDocument>()
    .textEditor(self => ({
      title: 'text',
      priority: PRIORITY.high,
      text: () => self.text,
      onBlur: (t: string) => (self.text = t),
    }))
    .columnedList(self => ({
      title: 'character frequency',
      priority: PRIORITY.med,
      items: () => {
        const chars = self.text.split('')
        const freq: Record<string, number> = {}
        for (const char of chars) {
          if (freq[char]) {
            freq[char]++
          } else {
            freq[char] = 1
          }
        }
        const entries = Object.entries(freq)
        entries.sort(([_a, a], [_b, b]) => b - a)
        return entries
      },
      columns: {
        char: { text: ([char]: [string, number]) => `[${char}]` },
        code: { text: ([char]: [string, number]) => char.charCodeAt(0).toString() },
        freq: { text: ([, count]: [string, number]) => count.toString() },
      },
    }))
    .list(self => ({
      title: 'lines',
      priority: PRIORITY.low,
      items: () => self.text.split('\n'),
      text: (item: string) => item,
    }))
    .panel(self => ({
      title: 'Preview',
      priority: PRIORITY.high,
      component: onInspect => React.createElement(PreviewPanel, { doc: self, onInspect }),
    }))
    .panel(self => ({
      title: 'Stats',
      priority: PRIORITY.med,
      component: () => React.createElement(StatsPanel, { doc: self }),
    }));

  [phlowActions] = actions<TextDocument>()
    .button(self => ({
      label: 'Clear',
      tooltip: 'Clear all text',
      onClick: () => {
        self.text = ''
      },
    }))
    .button(self => ({
      label: 'Copy',
      tooltip: 'Copy to clipboard',
      onClick: async () => {
        await navigator.clipboard.writeText(self.text)
      },
    }));

  [phlowSearches] = searches<TextDocument>()
    .source(self => ({
      title: 'Lines',
      showOnEmpty: true,
      items: (query: string) => {
        const lines = self.text.split('\n')
        if (!query) return lines
        return lines.filter(l => l.toLowerCase().includes(query.toLowerCase()))
      },
      text: (line: string) => line,
      send: (line: string) => ({ line, length: line.length }),
    }))
    .source(self => ({
      title: 'Words',
      items: (query: string) =>
        [...new Set(self.text.split(/\s+/))].filter(w => w.toLowerCase().startsWith(query.toLowerCase())),
      text: (word: string) => word,
    }))

  constructor(initialText: string) {
    this.text = initialText
  }
}

const document = new TextDocument(`\
# Welcome to the text editor
This is a simple text editor view.
You can edit this content freely.`)

// ============================================================================
// Project Configuration with Zod
// ============================================================================

const projectConfigSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(50).meta({
    label: 'Project Name',
    placeholder: 'my-project',
  }),
  version: z
    .string()
    .regex(/^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/, 'Must be valid semver')
    .meta({
      label: 'Version',
      placeholder: '1.0.0',
    }),
  description: z.string().max(200).optional().meta({
    label: 'Description',
    placeholder: 'A fantastic project...',
  }),
  minify: z.boolean().meta({ label: 'Minify Output' }),
  sourceMaps: z.boolean().meta({ label: 'Generate Source Maps' }),
  target: z.string().meta({ label: 'Build Target', placeholder: 'es2020' }),
  maxBundleSize: z.number().min(10).max(10000).meta({ label: 'Max Bundle Size (KB)' }),
  timeout: z.number().min(1000).max(600000).meta({ label: 'Build Timeout (ms)' }),
  authorName: z.string().optional().meta({ label: 'Author Name', placeholder: 'Jane Doe' }),
  authorEmail: z
    .string()
    .email()
    .optional()
    .or(z.literal(''))
    .meta({ label: 'Author Email', placeholder: 'jane@example.com' }),
  experimentalFeatures: z.boolean().meta({ label: 'Experimental Features' }),
  debugMode: z.boolean().meta({ label: 'Debug Mode' }),
})

type ProjectConfig = z.infer<typeof projectConfigSchema>

class ProjectConfigModel implements Viewable<any> {
  config: ProjectConfig

  constructor(initialConfig: ProjectConfig) {
    this.config = initialConfig
  }

  [phlowViews] = views<ProjectConfigModel>()
    .descriptor(self => ({
      title: 'Configuration',
      priority: PRIORITY.high,
      schema: () => projectConfigSchema,
      model: () => self.config,
      onUpdate: (updated: ProjectConfig) => {
        self.config = updated
        console.log('Config updated:', updated)
      },
    }))
    .textEditor(self => ({
      title: 'JSON',
      priority: PRIORITY.med,
      text: () => JSON.stringify(self.config, null, 2),
      onBlur: (text: string) => {
        try {
          self.config = JSON.parse(text)
        } catch (e) {
          console.error('Invalid JSON:', e)
        }
      },
    }))
    .columnedList(self => ({
      title: 'Fields',
      priority: PRIORITY.low,
      items: () => Object.entries(self.config),
      columns: {
        field: { text: ([key]: [string, unknown]) => key },
        type: { text: ([, value]: [string, unknown]) => typeof value },
        value: { text: ([, value]: [string, unknown]) => String(value) },
      },
    }))
    .mondrian(self => ({
      title: 'Structure',
      priority: PRIORITY.med,
      type: 'tree',
      root: () => {
        const config = self.config
        const booleans: { label: string; id: string; value: number; target: unknown; color: string }[] = []
        const strings: { label: string; id: string; value: number; target: unknown; color: string }[] = []
        const numbers: { label: string; id: string; value: number; target: unknown; color: string }[] = []

        for (const [key, value] of Object.entries(config)) {
          const node = {
            label: key,
            id: key,
            value: typeof value === 'string' ? Math.max(value.length, 1) : typeof value === 'number' ? value : 1,
            target: { field: key, value, type: typeof value },
            color: typeof value === 'boolean' ? 'boolean' : typeof value === 'number' ? 'number' : 'string',
          }
          if (typeof value === 'boolean') booleans.push(node)
          else if (typeof value === 'number') numbers.push(node)
          else strings.push(node)
        }

        return {
          label: config.name,
          children: [
            { label: 'Strings', color: 'string', children: strings },
            { label: 'Numbers', color: 'number', children: numbers },
            { label: 'Booleans', color: 'boolean', children: booleans },
          ],
        }
      },
      nodes: { width: 110, height: 36 },
      edges: {
        shape: 'curve',
        connect: [
          { from: 'minify', to: 'sourceMaps' },
          { from: 'debugMode', to: 'experimentalFeatures' },
        ],
      },
      palette: {
        string: '#3b82f6',
        number: '#f59e0b',
        boolean: '#10b981',
      },
    }))
}

const projectConfig = new ProjectConfigModel({
  name: 'my-awesome-project',
  version: '1.0.0',
  description: 'An example project configuration',
  minify: true,
  sourceMaps: true,
  target: 'es2020',
  maxBundleSize: 500,
  timeout: 30000,
  authorName: 'Developer',
  authorEmail: 'dev@example.com',
  experimentalFeatures: false,
  debugMode: false,
})

/**
 * Toolbar component that uses the inspector hooks
 */
function InspectorToolbar() {
  const { inspectRoot, paneCount } = useInspector()

  return (
    <Card className="shrink-0 p-2">
      <div className="flex gap-2 items-center flex-wrap">
        <span className="text-sm text-muted-foreground px-2">Inspect:</span>
        <Button variant="ghost" size="sm" onClick={() => inspectRoot(projectConfig as any)}>
          Project Config (Zod)
        </Button>
        <Button variant="ghost" size="sm" onClick={() => inspectRoot(document as any)}>
          TextDocument
        </Button>
        <Button variant="ghost" size="sm" onClick={() => inspectRoot([1, 2, 3, 4, 5, 6] as any)}>
          Array
        </Button>
        <Button variant="ghost" size="sm" onClick={() => inspectRoot({ foo: '123', bar: 'hello' } as any)}>
          Object
        </Button>
        {paneCount > 0 && (
          <span className="text-xs text-muted-foreground ml-auto">
            {paneCount} pane{paneCount !== 1 ? 's' : ''} open
          </span>
        )}
      </div>
    </Card>
  )
}

export default function App() {
  useTheme() // Initialize theme on document root

  return (
    <InspectorProvider >
      <div className="flex flex-col w-screen h-screen p-4 gap-4 bg-background">
        <InspectorToolbar />
        <div className="flex-1 min-h-0 overflow-hidden border rounded-lg">
          <PaneContainer paneWidth={420} />
        </div>
      </div>
    </InspectorProvider>
  )
}