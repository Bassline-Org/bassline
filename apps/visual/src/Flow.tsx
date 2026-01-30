import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { Drawn, ExampleText } from './TestComponents'
import { Position, getStraightPath, BaseEdge, EdgeProps, Panel, NodeProps, Node, Handle, useNodes } from '@xyflow/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from './components/ui/table'
import { atom, useAtomValue } from 'jotai'
import { reactFlowAtom } from './atoms/graph'

export type TextType = 'h1' | 'h2' | 'h3' | 'h4' | 'p'
type TextNode = Node<{ text: string; style: TextType }, 'text'>
export function TextNode({ data }: NodeProps<TextNode>) {
  const { text, style } = data
  let textComponent
  switch (style) {
    case 'h1':
      textComponent = <h1 className="text-foreground">{text}</h1>
      break
    case 'h2':
      textComponent = <h2 className="text-foreground">{text}</h2>
      break
    case 'h3':
      textComponent = <h3 className="text-foreground">{text}</h3>
      break
    case 'h4':
      textComponent = <h4 className="text-foreground">{text}</h4>
      break
    default:
      textComponent = <p className="text-foreground">{text}</p>
  }
  return (
    <>
      <ExampleText>{textComponent}</ExampleText>
      <Handle position={Position.Left} type="target" />
      <Handle position={Position.Right} type="source" />
    </>
  )
}

export function DrawnNode() {
  return (
    <>
      <Drawn />
      <Handle position={Position.Left} type="target" />
      <Handle position={Position.Right} type="source" />
    </>
  )
}

export function CustomEdge({ id, sourceX, sourceY, targetX, targetY }: EdgeProps) {
  const [edgePath] = getStraightPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  })
  const ref = useRef(null)

  useGSAP(() => {
    const q = gsap.utils.selector(ref.current!)
    gsap.from(q('path'), { drawSVG: '0% 10%', duration: 1, ease: 'expo.out' })
  })

  return (
    <g ref={ref}>
      <BaseEdge id={id} path={edgePath} />
    </g>
  )
}

export function ViewPanel() {
  const columns = useMemo(
    () =>
      atom(get => {
        const { nodes } = get(reactFlowAtom)
        const cols = new Set<string>()
        for (const { data } of nodes) {
          Object.keys(data).forEach(k => cols.add(k))
        }
        const asArr = Array.from(cols)
        asArr.sort()
        return [asArr, nodes] as const
      }),
    []
  )
  const [cols, nodes] = useAtomValue(columns)
  const rows = useMemo(() => {
    const nodeToRow = (node: Node) => {
      const row = []
      for (const col of cols) {
        row.push(node.data[col] ?? '---')
      }
      return row
    }
    return nodes.map(nodeToRow)
  }, [cols, nodes])

  return (
    <Panel position="bottom-left" className="flex bg-background">
      <Table>
        <TableCaption>Table of node data in the graph</TableCaption>
        <TableHeader>
          <TableRow>
            {cols.map(name => (
              <TableHead className="w-[100px] text-accent-foreground text-x1">{name}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(row => {
            return (
              <TableRow>
                {row.map((entry: any) => (
                  <TableCell className="w-[100px] text-foreground">{entry}</TableCell>
                ))}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </Panel>
  )
}

export function SomePanel() {
  const nodes = useNodes()
  const [tags, setTags] = useState(new Set())
  useEffect(() => {
    const tags = new Set()
    for (const key of nodes.flatMap(n => Object.keys(n.data ?? {}))) {
      if (key.startsWith('tag-')) {
        tags.add(key)
      }
    }
    setTags(tags)
  }, [nodes])

  return (
    <Panel position="bottom-center" className="h-12 text-foreground">
      <h1>HomeBass</h1>
      {tags.size && <h1>Unique tags: {tags.size}</h1>}
    </Panel>
  )
}
