import { ReactFlow, ReactFlowProvider, Controls, Background } from '@xyflow/react'
import { useBridgedWriter } from '@bassline/react'
import { useEffect } from 'react'
import { useGraphState, useXyflowHandlers, bridgeToGraph, type XyflowEvent, type InboundMsg } from './graph/xyflow'
import type { Reader, Writer } from '@bassline/core'
import { graph } from './graph/messages'
import '@xyflow/react/dist/style.css'

function GraphCanvas({
  reader,
  writer,
  changeWriter,
}: {
  reader: Reader<InboundMsg>
  writer: Writer
  changeWriter: Writer<XyflowEvent>
}) {
  const { nodes, setNodes, edges, setEdges } = useGraphState(reader)
  const handlers = useXyflowHandlers(changeWriter, setNodes, setEdges)

  useEffect(() => {
    graph(writer).query(null, null, null)
  }, [writer])

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <ReactFlow nodes={nodes} edges={edges} {...handlers} fitView>
        <Controls />
        <Background />
      </ReactFlow>
    </div>
  )
}

export default function App({ reader, writer }: { reader: Reader<InboundMsg>; writer: Writer }) {
  const changeWriter = useBridgedWriter(writer, bridgeToGraph)

  return (
    <ReactFlowProvider>
      <GraphCanvas reader={reader} writer={writer} changeWriter={changeWriter} />
    </ReactFlowProvider>
  )
}
