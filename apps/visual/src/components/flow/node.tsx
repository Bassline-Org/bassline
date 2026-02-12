import { useNodesData, useReactFlow } from '@xyflow/react'
import { BaseNode, BaseNodeContent, BaseNodeFooter } from '../base-node'
import { ComponentProps, memo, useEffect } from 'react'
import { Button } from '../ui/button'
import { ImplicitHandle } from './handle'

export function ImplicitNode({ id, ...props }: ComponentProps<typeof BaseNode>) {
  const rf = useReactFlow()
  const nodeData = useNodesData(id!)
  const incoming = rf.getNodeConnections({ nodeId: id!, type: 'target', handleId: 'implicit' })
  useEffect(() => {
    console.log('implicit: ', incoming)
  }, [incoming])

  return (
    <BaseNode id={id} {...props}>
      <BaseNodeContent>{JSON.stringify(nodeData?.data)}</BaseNodeContent>
    </BaseNode>
  )
}

export const ImplicitBase = memo(() => {
  return (
    <BaseNode className="w-96">
      <ImplicitHandle />
      <BaseNodeContent>
        <p className="text-xs">Proto Implicit</p>
      </BaseNodeContent>
      <BaseNodeFooter>
        <Button variant="outline" className="nodrag w-full">
          Spawn Implicit
        </Button>
      </BaseNodeFooter>
    </BaseNode>
  )
})
