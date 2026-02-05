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
import {
  InspectorProvider,
  InspectorPager,
  phlow,
  phlowViews,
  PRIORITY,
  type Viewable,
  initPrimitiveViews,
  useInspector,
} from '@bassline/ui'
import '@bassline/ui/styles.css'
import { Inspectors } from './inspectors'
import { Button } from './components/ui/button'
import { Card } from './components/ui/card'
import { z } from 'zod'

// Initialize primitive views for Arrays and Objects
initPrimitiveViews()

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

class TextDocument implements Viewable<any> {
  text: string

  constructor(initialText: string) {
    this.text = initialText
  }

  [phlowViews] = [
    () =>
      phlow.textEditor({
        title: 'text',
        priority: PRIORITY.high,
        text: () => this.text,
        onBlur: t => (this.text = t),
      }),
    () =>
      phlow.columnedList<[string, number]>({
        title: 'character frequency',
        priority: PRIORITY.med,
        items: () => {
          const chars = this.text.split('')
          const freq: Record<string, number> = {}
          for (const char of chars) {
            if (freq[char]) {
              freq[char]++
            } else {
              freq[char] = 1
            }
          }
          const entries = Object.entries(freq)
          entries.sort(([_, a], [__, b]) => b - a)
          return entries
        },
        columns: {
          char: { text: ([char]) => `[${char}]` },
          code: { text: ([char]) => char.charCodeAt(0).toString() },
          freq: { text: ([_, count]) => count.toString() },
        },
      }),
    () =>
      phlow.list<string>({
        title: 'lines',
        priority: PRIORITY.low,
        items: () => this.text.split('\n'),
        text: item => item,
      }),
  ]
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

  [phlowViews] = [
    () =>
      phlow.descriptor<ProjectConfig>({
        title: 'Configuration',
        priority: PRIORITY.high,
        schema: () => projectConfigSchema,
        model: () => this.config,
        onUpdate: updated => {
          this.config = updated
          console.log('Config updated:', updated)
        },
      }),
    () =>
      phlow.textEditor({
        title: 'JSON',
        priority: PRIORITY.med,
        text: () => JSON.stringify(this.config, null, 2),
        onBlur: text => {
          try {
            this.config = JSON.parse(text)
          } catch (e) {
            console.error('Invalid JSON:', e)
          }
        },
      }),
    () =>
      phlow.columnedList<[string, unknown]>({
        title: 'Fields',
        priority: PRIORITY.low,
        items: () => Object.entries(this.config),
        columns: {
          field: { text: ([key]) => key },
          type: { text: ([, value]) => typeof value },
          value: { text: ([, value]) => String(value) },
        },
      }),
  ]
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
    <InspectorProvider components={Inspectors}>
      <div className="flex flex-col w-screen h-screen p-4 gap-4 bg-background">
        <InspectorToolbar />
        <div className="flex-1 min-h-0 overflow-hidden border rounded-lg">
          <InspectorPager paneWidth={420} />
        </div>
      </div>
    </InspectorProvider>
  )
}
