import { atomWithImmer } from 'jotai-immer'
import {
  Edge,
  Node,
  NodeChange,
  EdgeChange,
  NodePositionChange,
  NodeDimensionChange,
  NodeSelectionChange,
  Connection,
} from '@xyflow/react'
import { atom, useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useMemo } from 'react'

let _id = 0

//================
// Graph State
//================
type Store<T> = Record<string, T>
export const nodesAtom = atomWithImmer<Store<Node>>({})
export const edgesAtom = atomWithImmer<Store<Edge>>({})
export const reactFlowAtom = atom(get => ({
  nodes: Object.values(get(nodesAtom)),
  edges: Object.values(get(edgesAtom)),
}))

//================
// Graph Event Handling
//================
type NodeOrEdge<T, E = T> = { node: T; edge?: undefined } | { node?: undefined; edge: E }
export type Edit = {
  move: Pick<NodePositionChange, 'position' | 'id' | 'dragging'>
  resize: Omit<NodeDimensionChange, 'type'>
  select: NodeOrEdge<Omit<NodeSelectionChange, 'type'>>
  define: NodeOrEdge<Node, Edge>
  remove: NodeOrEdge<string>
}

export const editAtoms = {
  move: atom(null, (_, set, { id, position, dragging }: Edit['move']) => {
    set(nodesAtom, draft => {
      Object.assign(draft[id], { position, dragging })
    })
  }),
  resize: atom(null, (_, set, change: Edit['resize']) => {
    const { id, dimensions, setAttributes } = change
    set(nodesAtom, draft => {
      const n = draft[id]
      if (!n.measured) {
        n.measured = {}
      }
      const measured = n.measured
      const setBoth = setAttributes === true
      if (setAttributes === 'height' || setBoth) measured.height = dimensions?.height ?? 0
      if (setAttributes === 'width' || setBoth) measured.width = dimensions?.width ?? 0
    })
  }),
  define: atom(null, (_, set, { node, edge }: Edit['define']) => {
    if (node)
      set(nodesAtom, d => {
        d[node.id] = node
      })
    else
      set(edgesAtom, d => {
        d[edge.id] = edge
      })
  }),
  select: atom(null, (_, set, { node, edge }: Edit['select']) => {
    const { selected, id } = node ?? edge
    const select = (d: any) => {
      d[id].selected = selected
    }
    if (node) set(nodesAtom, select)
    else set(edgesAtom, select)
  }),
  remove: atom(null, (_, set, { node, edge }: Edit['remove']) => {
    const id = node ?? edge
    const remove = (d: any) => {
      delete d[id]
    }
    if (node) set(nodesAtom, remove)
    else set(edgesAtom, remove)
  }),
  connect: atom(null, (_, set, c: Connection) => {
    const id = [c.source, c.sourceHandle, c.target, c.targetHandle].filter(Boolean).join('-')
    set(edgesAtom, draft => {
      draft[id] = { id, ...c }
    })
  }),
  copy: atom(null, (_, set, id: string) => {
    const copyId = (_id++).toString()
    set(nodesAtom, draft => {
      const node = draft[id]
      if (!node) return console.error(`couldn't find node: ${id}`)
      const { id: _, data, position, ...rest } = node
      const copy = {
        id: copyId,
        data: {
          ...data,
          copiedFrom: node.id,
          label: `copied from: ${node.id}`,
        },
        position: {
          x: node.position.x + 50,
          y: node.position.y + 50,
        },
        ...rest,
      }
      draft[copyId] = copy
    })
  }),
} as const

export const onChanged = {
  nodes: atom(null, (_, set, changes: NodeChange[]) => {
    for (const change of changes) {
      const { type } = change
      if (type === 'position') set(editAtoms.move, change)
      //else if (type === 'dimensions') set(editAtoms.resize, change)
      else if (type === 'remove') set(editAtoms.remove, { node: change.id })
      else if (type === 'replace' || type === 'add') set(editAtoms.define, { node: change.item })
      else if (type === 'select') set(editAtoms.select, { node: change })
    }
  }),
  edges: atom(null, (_, set, changes: EdgeChange[]) => {
    for (const change of changes) {
      const { type } = change
      if (type === 'add' || type === 'replace') set(editAtoms.define, { edge: change.item })
      if (type === 'remove') set(editAtoms.remove, { edge: change.id })
      if (type === 'select') set(editAtoms.select, { edge: change })
    }
  }),
}

export const useGraphState = () => {
  const rfState = useAtomValue(reactFlowAtom)
  return rfState
}

export const useGraphChanges = () => {
  const onNodesChange = useSetAtom(onChanged.nodes)
  const onEdgesChange = useSetAtom(onChanged.edges)
  return { onNodesChange, onEdgesChange }
}

export const useNode = (id: string) => {
  const a = useMemo(
    () =>
      atom(
        get => get(nodesAtom)[id],
        (_, set, change) => {
          set(nodesAtom, draft => {
            Object.assign(draft[id], change)
          })
        }
      ),
    []
  )
  const [node, setNode] = useAtom(a)
  return [node, setNode] as const
}

export const useEdits = () => {
  const move = useSetAtom(editAtoms.move)
  const resize = useSetAtom(editAtoms.resize)
  const define = useSetAtom(editAtoms.define)
  const select = useSetAtom(editAtoms.select)
  const remove = useSetAtom(editAtoms.remove)
  const connect = useSetAtom(editAtoms.connect)
  const copy = useSetAtom(editAtoms.copy)
  return { move, resize, define, select, remove, connect, copy } as const
}
