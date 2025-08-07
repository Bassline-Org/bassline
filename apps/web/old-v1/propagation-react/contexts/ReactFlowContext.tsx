import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { useNodesState, useEdgesState, type Node, type Edge } from '@xyflow/react'
import { useReactFlowState } from '../hooks/useReactFlowState'

interface ReactFlowContextValue {
  nodes: Node[]
  edges: Edge[]
  onNodesChange: (changes: any[]) => void
  onEdgesChange: (changes: any[]) => void
}

const ReactFlowContext = createContext<ReactFlowContextValue | null>(null)

export function useReactFlowContext() {
  const context = useContext(ReactFlowContext)
  if (!context) {
    throw new Error('useReactFlowContext must be used within ReactFlowProvider')
  }
  return context
}

export function ReactFlowProvider({ children }: { children: ReactNode }) {
  const { nodes: stateNodes, edges: stateEdges } = useReactFlowState()
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(stateNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(stateEdges)
  
  // Sync state to React Flow when it changes
  useEffect(() => {
    setNodes(stateNodes)
  }, [stateNodes, setNodes])
  
  useEffect(() => {
    setEdges(stateEdges)
  }, [stateEdges, setEdges])
  
  return (
    <ReactFlowContext.Provider value={{ nodes, edges, onNodesChange, onEdgesChange }}>
      {children}
    </ReactFlowContext.Provider>
  )
}