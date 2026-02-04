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
import { ReactFlow, ReactFlowProvider, useReactFlow } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { PropsWithChildren } from 'react'
import { CustomEdge, DrawnNode, TextNode, ViewPanel } from './Flow.tsx'
import { dims, drawn, edge, group, node, parent, pos, tags, text } from './nodes.ts'
import { useTheme } from './atoms/theme.ts'
import { useEdits, useGraphChanges, useGraphState } from './atoms/graph.ts'
import { Toaster } from './components/ui/sonner.tsx'
import { SmokeyBackground } from './ShaderBg.tsx'
import { useState, useEffect } from 'react'
import { Inspector, phlow, PhlowViewType, PRIORITY, IViewable } from './phlow'
import { Button } from './components/ui/button'
import { Card } from './components/ui/card'
import { z } from 'zod'
import { FormsDemo } from './forms'
import { useGraph, useSeedNamespace } from './namespace'

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

class TextDocument implements IViewable {
  text: string

  constructor(initialText: string) {
    this.text = initialText
  }

  phlowViews: PhlowViewType<any>[] = [
    phlow.textEditor({
      title: 'text',
      priority: PRIORITY.high,
      text: () => this.text,
      onBlur: t => (this.text = t),
    }),
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

    phlow.list<string>({
      title: 'lines',
      priority: PRIORITY.low,
      items: () => this.text.split('\n'),
      text: item => item,
    }),
  ]

  static phlowViews: PhlowViewType[] = [
    phlow.explicit({
      title: 'class info',
      priority: PRIORITY.high,
      component: () => (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">TextDocument</h2>
          <p className="text-muted-foreground">
            A simple text document class that provides multiple views of its content.
          </p>
          <div className="space-y-2">
            <h3 className="font-medium">Properties</h3>
            <ul className="list-disc list-inside text-sm">
              <li>
                <code>text: string</code> - The document content
              </li>
            </ul>
          </div>
          <div className="space-y-2">
            <h3 className="font-medium">Methods</h3>
            <ul className="list-disc list-inside text-sm">
              <li>
                <code>constructor(initialText: string)</code>
              </li>
            </ul>
          </div>
        </div>
      ),
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

class ProjectConfigModel implements IViewable {
  config: ProjectConfig

  constructor(initialConfig: ProjectConfig) {
    this.config = initialConfig
  }

  phlowViews: PhlowViewType<any>[] = [
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

type InspectTarget = 'document' | 'documentClass' | 'projectConfig' | 'forms' | 'namespace'

export default function App() {
  useTheme() // Initialize theme on document root
  const [target, setTarget] = useState<InspectTarget>('namespace')
  const [seeded, setSeeded] = useState(false)

  const graphViewable = useGraph()
  const seedNamespace = useSeedNamespace()

  // Seed namespace data on first mount
  useEffect(() => {
    if (!seeded) {
      seedNamespace()
      setSeeded(true)
    }
  }, [seeded, seedNamespace])

  const viewable = target === 'document' ? document : target === 'documentClass' ? TextDocument : projectConfig

  return (
    <div className="flex flex-col w-screen h-screen p-4 gap-4 bg-background">
      <Card className="shrink-0 p-2">
        <div className="flex gap-2 items-center flex-wrap">
          <span className="text-sm text-muted-foreground px-2">Inspect:</span>
          <Button
            variant={target === 'namespace' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setTarget('namespace')}
          >
            Namespace
          </Button>
          <Button variant={target === 'forms' ? 'secondary' : 'ghost'} size="sm" onClick={() => setTarget('forms')}>
            Forms Demo (AutoForm + Zod)
          </Button>
          <Button
            variant={target === 'projectConfig' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setTarget('projectConfig')}
          >
            Project Config (Zod)
          </Button>
          <Button
            variant={target === 'document' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setTarget('document')}
          >
            TextDocument (instance)
          </Button>
          <Button
            variant={target === 'documentClass' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setTarget('documentClass')}
          >
            TextDocument (class)
          </Button>
        </div>
      </Card>
      <div className="flex-1 min-h-0 overflow-auto">
        {target === 'forms' ? (
          <Card className="p-4">
            <FormsDemo />
          </Card>
        ) : target === 'namespace' ? (
          <Inspector target={graphViewable} />
        ) : (
          <Inspector target={viewable} />
        )}
      </div>
    </div>
  )
}
