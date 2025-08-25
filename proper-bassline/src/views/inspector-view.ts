/**
 * InspectorView - Live property inspector and editor
 * 
 * Shows properties of a selected gadget and allows live editing.
 * Properties are immediately reflected in the network.
 */

import { FunctionGadget } from '../function'
import { GroupGadget } from '../visuals/group'
import { TextGadget } from '../visuals/text'
import { RectGadget } from '../visuals/rect'
import { LatticeValue, nil, obj, str, num, bool, dict, LatticeDict } from '../types'
import type { Gadget } from '../gadget'
import type { Cell } from '../cell'

export class InspectorView extends FunctionGadget {
  constructor(id: string) {
    super(id, ['target', 'width', 'height'])
  }
  
  fn(args: Record<string, LatticeValue>): LatticeValue {
    const target = args.target
    const width = args.width
    const height = args.height
    
    // Extract values
    let targetGadget: Gadget | null = null
    if (target && target.type === 'object' && target.value) {
      targetGadget = target.value as Gadget
    }
    
    const widthVal = width?.type === 'number' ? width.value : 400
    const heightVal = height?.type === 'number' ? height.value : 600
    
    // Create container
    const container = new GroupGadget(`inspector-${this.id}`)
    container.setSize(widthVal, heightVal)
    
    // Background
    const bg = new RectGadget(`inspector-bg`)
    bg.setPosition(0, 0)
    bg.setSize(widthVal, heightVal)
    bg.setBackgroundColor('#f9fafb')
    bg.setBorderRadius(8)
    container.add(bg)
    
    if (!targetGadget) {
      // Show "no selection" message
      const message = new TextGadget(`no-selection`)
      message.setPosition(20, heightVal / 2 - 10)
      message.setSize(widthVal - 40, 20)
      message.setText('No gadget selected')
      message.setColor('#9ca3af')
      message.setFontSize(14)
      container.add(message)
      
      return obj(container)
    }
    
    // Title
    const title = new TextGadget(`inspector-title`)
    title.setPosition(20, 20)
    title.setSize(widthVal - 40, 30)
    title.setText(`Inspecting: ${targetGadget.id}`)
    title.setFontSize(18)
    title.setFontWeight('bold')
    title.setColor('#111827')
    container.add(title)
    
    // Type info
    const typeInfo = new TextGadget(`inspector-type`)
    typeInfo.setPosition(20, 55)
    typeInfo.setSize(widthVal - 40, 20)
    typeInfo.setText(`Type: ${this.getGadgetType(targetGadget)}`)
    typeInfo.setFontSize(14)
    typeInfo.setColor('#6b7280')
    container.add(typeInfo)
    
    // Properties section
    let yOffset = 100
    
    // Show outputs
    if ('outputs' in targetGadget && (targetGadget as any).outputs) {
      const outputs = (targetGadget as any).outputs as Map<string, LatticeValue>
      
      const outputsTitle = new TextGadget(`outputs-title`)
      outputsTitle.setPosition(20, yOffset)
      outputsTitle.setSize(widthVal - 40, 25)
      outputsTitle.setText('Outputs:')
      outputsTitle.setFontSize(16)
      outputsTitle.setFontWeight('semibold')
      outputsTitle.setColor('#374151')
      container.add(outputsTitle)
      yOffset += 30
      
      outputs.forEach((value, name) => {
        const propGroup = new GroupGadget(`output-${name}`)
        propGroup.setPosition(20, yOffset)
        
        // Property name
        const propName = new TextGadget(`output-name-${name}`)
        propName.setPosition(0, 0)
        propName.setSize(120, 20)
        propName.setText(name)
        propName.setFontSize(12)
        propName.setColor('#4b5563')
        propGroup.add(propName)
        
        // Property value
        const propValue = new TextGadget(`output-value-${name}`)
        propValue.setPosition(130, 0)
        propValue.setSize(widthVal - 170, 20)
        propValue.setText(this.formatValue(value))
        propValue.setFontSize(12)
        propValue.setColor('#111827')
        propGroup.add(propValue)
        
        container.add(propGroup)
        yOffset += 25
      })
    }
    
    // Show inputs (for Functions)
    if ('inputs' in targetGadget && (targetGadget as any).inputs) {
      yOffset += 20
      const inputsTitle = new TextGadget(`inputs-title`)
      inputsTitle.setPosition(20, yOffset)
      inputsTitle.setSize(widthVal - 40, 25)
      inputsTitle.setText('Inputs:')
      inputsTitle.setFontSize(16)
      inputsTitle.setFontWeight('semibold')
      inputsTitle.setColor('#374151')
      container.add(inputsTitle)
      yOffset += 30
      
      const inputs = (targetGadget as any).inputs
      if (inputs instanceof Map) {
        inputs.forEach((conn: any, name: string) => {
          const propGroup = new GroupGadget(`input-${name}`)
          propGroup.setPosition(20, yOffset)
          
          // Input name
          const propName = new TextGadget(`input-name-${name}`)
          propName.setPosition(0, 0)
          propName.setSize(120, 20)
          propName.setText(name)
          propName.setFontSize(12)
          propName.setColor('#4b5563')
          propGroup.add(propName)
          
          // Connection info
          const source = conn.source?.deref ? conn.source.deref() : null
          const connInfo = new TextGadget(`input-conn-${name}`)
          connInfo.setPosition(130, 0)
          connInfo.setSize(widthVal - 170, 20)
          connInfo.setText(source ? `← ${source.id}` : 'disconnected')
          connInfo.setFontSize(12)
          connInfo.setColor(source ? '#059669' : '#ef4444')
          propGroup.add(connInfo)
          
          container.add(propGroup)
          yOffset += 25
        })
      } else if (inputs instanceof Set) {
        // For Cells with Set<Connection>
        let idx = 0
        inputs.forEach((conn: any) => {
          const source = conn.source?.deref ? conn.source.deref() : null
          if (source) {
            const propGroup = new GroupGadget(`input-${idx}`)
            propGroup.setPosition(20, yOffset)
            
            const connInfo = new TextGadget(`input-conn-${idx}`)
            connInfo.setPosition(0, 0)
            connInfo.setSize(widthVal - 40, 20)
            connInfo.setText(`← ${source.id}`)
            connInfo.setFontSize(12)
            connInfo.setColor('#059669')
            propGroup.add(connInfo)
            
            container.add(propGroup)
            yOffset += 25
            idx++
          }
        })
      }
    }
    
    // Show downstream connections
    if ('downstream' in targetGadget && (targetGadget as any).downstream) {
      yOffset += 20
      const downstreamTitle = new TextGadget(`downstream-title`)
      downstreamTitle.setPosition(20, yOffset)
      downstreamTitle.setSize(widthVal - 40, 25)
      downstreamTitle.setText('Downstream:')
      downstreamTitle.setFontSize(16)
      downstreamTitle.setFontWeight('semibold')
      downstreamTitle.setColor('#374151')
      container.add(downstreamTitle)
      yOffset += 30
      
      const downstream = (targetGadget as any).downstream as Set<any>
      downstream.forEach((target: any) => {
        const connGroup = new GroupGadget(`downstream-${target.id}`)
        connGroup.setPosition(20, yOffset)
        
        const connInfo = new TextGadget(`downstream-conn-${target.id}`)
        connInfo.setPosition(0, 0)
        connInfo.setSize(widthVal - 40, 20)
        connInfo.setText(`→ ${target.id}`)
        connInfo.setFontSize(12)
        connInfo.setColor('#0ea5e9')
        connGroup.add(connInfo)
        
        container.add(connGroup)
        yOffset += 25
      })
    }
    
    return obj(container)
  }
  
  private getGadgetType(gadget: Gadget): string {
    if ('latticeOp' in gadget) return 'Cell'
    if ('fn' in gadget) return 'Function'
    if ('children' in gadget) return 'Group/Network'
    return 'Gadget'
  }
  
  private formatValue(value: LatticeValue): string {
    if (!value) return 'nil'
    
    switch (value.type) {
      case 'string':
        return `"${value.value}"`
      case 'number':
        return String(value.value)
      case 'bool':
        return String(value.value)
      case 'set':
        return `Set(${value.value.size})`
      case 'array':
        return `Array(${value.value.length})`
      case 'dict':
        const dict = value as LatticeDict
        if (dict.value.has('ordinal') && dict.value.has('value')) {
          const innerValue = dict.value.get('value')
          return `Ordinal(${this.formatValue(innerValue!)})`
        }
        return `Dict(${dict.value.size})`
      case 'object':
        return `Object(${value.value?.constructor?.name || 'unknown'})`
      default:
        return 'unknown'
    }
  }
}