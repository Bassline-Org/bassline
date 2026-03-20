import { ReactFlow, ReactFlowProvider, Controls, Background } from '@xyflow/react'
import { useEffect, useMemo } from 'react'
import { useGraphState, useXyflowHandlers } from './ontology/xyflow/participants'
import { bridgeToGraph } from './ontology/xyflow/bridge'
import type { InboundMsg } from './ontology/xyflow/types'
import { graph } from './ontology/graph/slang'
import type { EOF } from '@bassline/core'
import '@xyflow/react/dist/style.css'

function GraphCanvas({
  send,
  recv,
  onXyflowEvent,
}: {
  send: (msg: unknown) => void
  recv: () => Promise<InboundMsg | typeof EOF>
  onXyflowEvent: (event: any) => void
}) {
  const { nodes, setNodes, edges, setEdges } = useGraphState(recv)
  const handlers = useXyflowHandlers(onXyflowEvent, setNodes, setEdges)

  useEffect(() => {
    graph(send).query(null, null, null)
  }, [send])

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <ReactFlow nodes={nodes} edges={edges} {...handlers} fitView>
        <Controls />
        <Background />
      </ReactFlow>
    </div>
  )
}

export default function App({
  send,
  recv,
}: {
  send: (msg: unknown) => void
  recv: () => Promise<InboundMsg | typeof EOF>
}) {
  const onXyflowEvent = useMemo(() => bridgeToGraph(send), [send])

  return (
    <ReactFlowProvider>
      <GraphCanvas send={send} recv={recv} onXyflowEvent={onXyflowEvent} />
    </ReactFlowProvider>
  )
}
