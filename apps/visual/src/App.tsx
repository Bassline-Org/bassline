import { ReactFlow, ReactFlowProvider, Controls, Background } from '@xyflow/react'
import { useBridgedWriter } from '@bassline/react'
import { useGraphState, useXyflowHandlers, bridgeToGraph } from './graph/xyflow'
import type { Reader, Writer } from '@bassline/core'
import '@xyflow/react/dist/style.css'

function GraphCanvas({ reader, changeWriter }: { reader: Reader; changeWriter: Writer }) {
  const { nodes, setNodes, edges, setEdges } = useGraphState(reader)
  const handlers = useXyflowHandlers(changeWriter, setNodes, setEdges)

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <ReactFlow nodes={nodes} edges={edges} {...handlers} fitView>
        <Controls />
        <Background />
      </ReactFlow>
    </div>
  )
}

export default function App({ reader, writer }: { reader: Reader; writer: Writer }) {
  const changeWriter = useBridgedWriter(writer, bridgeToGraph)

  return (
    <ReactFlowProvider>
      <GraphCanvas reader={reader} changeWriter={changeWriter} />
    </ReactFlowProvider>
  )
}
