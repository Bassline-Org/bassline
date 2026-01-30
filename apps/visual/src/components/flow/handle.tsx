import { ComponentProps } from 'react'
import { BaseHandle } from '../base-handle'
import { Position } from '@xyflow/react'

export function ImplicitHandle(props: Omit<ComponentProps<typeof BaseHandle>, 'type' | 'position'>) {
  return (
    <BaseHandle
      position={Position.Right}
      id="implicit"
      {...props}
      isConnectableStart={false}
      type="source"
      className="h-0 w-0"
    >
      {props.children}
    </BaseHandle>
  )
}
