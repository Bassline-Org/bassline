/**
 * Simple test to verify Konva components are working
 */

import React from 'react'
import { Stage, Layer, Rect, Text } from 'react-konva'

export default function KonvaTest() {
  return (
    <div>
      <h1>Direct Konva Test</h1>
      <Stage width={600} height={400}>
        <Layer>
          <Rect
            x={20}
            y={20}
            width={100}
            height={100}
            fill="red"
            cornerRadius={10}
          />
          <Text
            x={30}
            y={50}
            text="Hello Konva!"
            fontSize={16}
            fill="white"
          />
        </Layer>
      </Stage>
    </div>
  )
}