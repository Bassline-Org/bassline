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
import { PropsWithChildren, useCallback, useEffect } from 'react'
import { CustomEdge, DrawnNode, TextNode, ViewPanel } from './Flow.tsx'
import { dims, drawn, edge, group, node, parent, pos, tags, text } from './nodes.ts'
import { useTheme } from './atoms/theme.ts'
import { useEdits, useGraphChanges, useGraphState } from './atoms/graph.ts'
import { Toaster } from './components/ui/sonner.tsx'
import { SmokeyBackground } from './ShaderBg.tsx'

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

export function useIntro() {
  const rf = useReactFlow()
  rf.addNodes([node(group('foo'), dims(1000, 500), pos(500, 500), tags('foo/bar/baz/zip'))])
  useGSAP(() => {
    const tl = gsap.timeline()
    const nodes = [drawn(), text('p', 'Hello...'), text('h4', 'Welcome to:'), text('h1', 'Bassline'), drawn()].map(
      (v, i) => node(v, parent('foo'), pos(i * 200, i * 50))
    )
    nodes.forEach((n, i, arr) => {
      tl.call(() => rf.addNodes(n), [], '+=1')
      const source = arr[i - 1]
      if (source) {
        tl.call(() => rf.addEdges(edge({ type: 'custom', source: source.id, target: n.id })), [], '-=1')
      }
    })
  })
}

function AppInner() {
  useIntro()
  return <></>
}

export default function App() {
  return (
    <Flow>
      <Toaster />
      <SmokeyBackground backdropBlurAmount="3xl" />
      <ViewPanel />
      {/* <AppInner /> */}
    </Flow>
  )
}
