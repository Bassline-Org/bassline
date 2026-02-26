import { NodeAppendix } from '@/components/node-appendix'
import { BaseNode, BaseNodeContent, BaseNodeHeader, BaseNodeHeaderTitle } from '@/components/base-node'
import { Node, NodeProps, useNodesData, useReactFlow } from '@xyflow/react'
import { Card, CardContent, CardHeader } from './components/ui/card'

export const NodeAppendixDemo = ({ id }: NodeProps) => {
  const rf = useReactFlow()
  const { data } = useNodesData<Node<{ data: { expanded: boolean } }>>(id) ?? { data: { expanded: false } }
  return (
    <BaseNode
      onContextMenu={e => {
        e.preventDefault()
        rf.updateNodeData(id, { expanded: !data.expanded })
      }}
    >
      {data?.expanded && (
        <NodeAppendix position="right" className="p-4">
          <Card>
            <CardHeader>Options</CardHeader>
            <CardContent>
              <code>{JSON.stringify(data)}</code>
            </CardContent>
          </Card>
        </NodeAppendix>
      )}
      <BaseNodeHeader className="border-b">
        <BaseNodeHeaderTitle>Custom Node</BaseNodeHeaderTitle>
      </BaseNodeHeader>
      <BaseNodeContent>
        <p>Node Content goes here.</p>
      </BaseNodeContent>
    </BaseNode>
  )
}
