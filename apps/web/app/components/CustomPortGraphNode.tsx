import React from 'react'

// Custom node component with inline styles
export function CustomPortGraphNode(props: any) {
  const { data, selected } = props
  
  // Determine background based on gadget type
  let background = 'linear-gradient(135deg, #e5e7eb 0%, #9ca3af 100%)'
  if (data.gadgetType === 'cell') {
    background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
  } else if (data.gadgetType === 'function') {
    background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
  }
  
  const nodeStyle: React.CSSProperties = {
    background,
    border: selected ? '2px solid #3b82f6' : '2px solid rgba(255, 255, 255, 0.3)',
    borderRadius: '8px',
    boxShadow: selected ? '0 0 0 3px rgba(59, 130, 246, 0.5)' : '0 4px 6px rgba(0, 0, 0, 0.1)',
    padding: '12px',
    position: 'relative',
    width: `${data.width || 180}px`,
    minHeight: `${data.height || 120}px`,
    cursor: 'move'
  }
  
  const titleStyle: React.CSSProperties = {
    color: 'white',
    fontWeight: 600,
    fontSize: '14px',
    textAlign: 'center',
    marginBottom: '12px'
  }
  
  const portsContainerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '8px'
  }
  
  const portGroupStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  }
  
  const socketRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  }
  
  const socketStyle: React.CSSProperties = {
    width: '16px',
    height: '16px',
    background: 'white',
    border: '2px solid #6b7280',
    borderRadius: '50%',
    cursor: 'crosshair',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
  }
  
  const socketLabelStyle: React.CSSProperties = {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: '11px',
    whiteSpace: 'nowrap'
  }
  
  return (
    <div style={nodeStyle} data-testid="node">
      <div style={titleStyle}>{data.label}</div>
      
      {data.hasLadder && (
        <div style={{
          position: 'absolute',
          top: '5px',
          right: '5px',
          width: '20px',
          height: '20px',
          background: 'rgba(0, 0, 0, 0.2)',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'rgba(255, 255, 255, 0.8)',
          fontSize: '14px',
          pointerEvents: 'none'
        }}>
          ⬇
        </div>
      )}
      
      <div style={portsContainerStyle}>
        {/* Input sockets */}
        <div style={portGroupStyle}>
          {Object.entries(data.inputs || {}).map(([key, input]: [string, any]) => (
            <div key={key} style={socketRowStyle}>
              <div 
                ref={(ref) => ref && props.emit({ type: 'render', data: { type: 'socket', side: 'input', key, element: ref } })}
                style={socketStyle}
                data-testid={`input-${key}`}
              />
              <span style={socketLabelStyle}>{input?.label || key}</span>
            </div>
          ))}
        </div>
        
        {/* Output sockets */}
        <div style={portGroupStyle}>
          {Object.entries(data.outputs || {}).map(([key, output]: [string, any]) => (
            <div key={key} style={socketRowStyle}>
              <span style={socketLabelStyle}>{output?.label || key}</span>
              <div 
                ref={(ref) => ref && props.emit({ type: 'render', data: { type: 'socket', side: 'output', key, element: ref } })}
                style={socketStyle}
                data-testid={`output-${key}`}
              />
            </div>
          ))}
        </div>
      </div>
      
      {/* Controls */}
      <div ref={(ref) => ref && props.emit({ type: 'render', data: { type: 'controls', element: ref } })} />
    </div>
  )
}

// Custom socket component - for customize.socket() only
export function CustomSocket(props: any) {
  return (
    <div 
      style={{
        width: '16px',
        height: '16px',
        background: 'white',
        border: '2px solid #6b7280',
        borderRadius: '50%',
        cursor: 'crosshair',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
      }}
      data-testid="socket"
    />
  )
}