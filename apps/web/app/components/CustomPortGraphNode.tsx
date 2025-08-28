import React from 'react'
import styled, { css } from 'styled-components'
import { Presets } from 'rete-react-plugin'

// Define the styled component with dynamic styles based on gadget type
const nodeStyles = css<{ 
  gadgetType?: string
  width?: number
  height?: number
  selected?: boolean
  hasLadder?: boolean 
}>`
  width: ${props => props.width || 180}px;
  min-height: ${props => props.height || 120}px;
  background: ${props => {
    switch(props.gadgetType) {
      case 'cell': 
        return 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      case 'function': 
        return 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
      case 'aggregator': 
        return 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
      case 'splitter': 
        return 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
      case 'passthrough': 
        return 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)'
      case 'interface': 
        return 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)'
      default: 
        return 'linear-gradient(135deg, #e5e7eb 0%, #9ca3af 100%)'
    }
  }};
  border-radius: 8px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  position: relative;
  
  ${props => props.selected && css`
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.5);
    border-color: #3b82f6;
  `}
  
  ${props => props.hasLadder && css`
    &::after {
      content: '⬇';
      position: absolute;
      top: 5px;
      right: 5px;
      font-size: 14px;
      color: rgba(255, 255, 255, 0.8);
      background: rgba(0, 0, 0, 0.2);
      width: 20px;
      height: 20px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  `}
  
  .title {
    color: white;
    font-weight: 600;
    font-size: 12px;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
    padding: 8px;
    text-align: center;
  }
  
  /* Ensure ports are positioned correctly */
  .input-socket,
  .output-socket {
    position: absolute;
    width: 16px;
    height: 16px;
  }
  
  .input-socket {
    left: -8px;
  }
  
  .output-socket {
    right: -8px;
  }
`

// Custom socket styles
export const SocketStyles = css`
  width: 16px;
  height: 16px;
  background: white;
  border: 2px solid #6b7280;
  border-radius: 50%;
  cursor: crosshair;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  
  &:hover {
    background: #3b82f6;
    transform: scale(1.2);
    border-color: #2563eb;
  }
  
  &.connected {
    background: #3b82f6;
    border-color: #2563eb;
  }
`

// Custom node component
export function CustomPortGraphNode(props: any) {
  const node = props.data
  
  // Extract custom properties from the node
  const customProps = {
    gadgetType: node.gadgetType,
    width: node.width,
    height: node.height,
    selected: node.selected,
    hasLadder: node.hasLadder
  }
  
  // Use the classic node with our custom styles
  return <Presets.classic.Node 
    {...props}
    styles={() => nodeStyles}
    data={{
      ...node,
      ...customProps
    }}
  />
}

// Custom socket component
export function CustomSocket(props: any) {
  const StyledSocket = styled.div`${SocketStyles}`
  return <StyledSocket className={props.className} />
}