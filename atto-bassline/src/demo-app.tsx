/**
 * Demo application showing propagation-powered UI
 * Components participate directly in the propagation network
 */

import React, { useState } from 'react'
import { NetworkProvider, useWiring, useTemplateBuilder, useTemplate, useContact, useGadgetValue } from './react-templates'
import { Button, Slider, TextField, Panel, Toggle, Select } from './react-components'
import { ColorPickerTemplate, RangeSliderTemplate, FormFieldTemplate } from './ui-templates'
import { SliderTemplate, TextFieldTemplate, Multiply } from './templates-v2'
import { signal, propagate } from './propagation'

// ============================================================================
// Color Picker Component (composed from templates)
// ============================================================================

function ColorPicker() {
  const { gadget } = useTemplate(ColorPickerTemplate, {
    red: 128,
    green: 128, 
    blue: 128
  })
  
  const [red, setRed] = useContact<number>(gadget, 'red')
  const [green, setGreen] = useContact<number>(gadget, 'green')
  const [blue, setBlue] = useContact<number>(gadget, 'blue')
  const hex = useGadgetValue<string>(gadget, 'hex')
  const rgb = useGadgetValue<string>(gadget, 'rgb')
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <h3>Color Picker</h3>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <label style={{ width: '60px' }}>Red:</label>
        <Slider value={red || 0} min={0} max={255} onChange={setRed} />
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <label style={{ width: '60px' }}>Green:</label>
        <Slider value={green || 0} min={0} max={255} onChange={setGreen} />
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <label style={{ width: '60px' }}>Blue:</label>
        <Slider value={blue || 0} min={0} max={255} onChange={setBlue} />
      </div>
      
      <div 
        style={{
          width: '100%',
          height: '60px',
          background: rgb || 'black',
          border: '1px solid #ccc',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontFamily: 'monospace'
        }}
      >
        {hex}
      </div>
    </div>
  )
}

// ============================================================================
// Interactive Panels Demo
// ============================================================================

function InteractivePanels() {
  const [panels, setPanels] = useState([
    { id: 'controls', x: 20, y: 20, title: 'Controls' },
    { id: 'settings', x: 250, y: 20, title: 'Settings' },
    { id: 'output', x: 480, y: 20, title: 'Output' }
  ])
  
  const [sliderValue, setSliderValue] = useState(50)
  const [textValue, setTextValue] = useState('')
  const [toggleValue, setToggleValue] = useState(false)
  const [selectValue, setSelectValue] = useState('')
  
  return (
    <div style={{ position: 'relative', width: '100%', height: '600px', background: '#f9f9f9' }}>
      <Panel
        x={panels[0].x}
        y={panels[0].y}
        width={200}
        height={250}
        title={panels[0].title}
        onMove={(x, y) => {
          setPanels(p => p.map(panel => 
            panel.id === 'controls' ? { ...panel, x, y } : panel
          ))
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div>
            <label>Volume:</label>
            <Slider value={sliderValue} onChange={setSliderValue} />
          </div>
          
          <div>
            <label>Name:</label>
            <TextField 
              text={textValue} 
              placeholder="Enter name..." 
              onChange={setTextValue}
            />
          </div>
          
          <Button 
            text="Apply Settings" 
            onClicked={() => console.log('Settings:', { sliderValue, textValue })}
          />
        </div>
      </Panel>
      
      <Panel
        x={panels[1].x}
        y={panels[1].y}
        width={200}
        height={200}
        title={panels[1].title}
        onMove={(x, y) => {
          setPanels(p => p.map(panel => 
            panel.id === 'settings' ? { ...panel, x, y } : panel
          ))
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <Toggle 
            label="Enable notifications" 
            checked={toggleValue}
            onChange={setToggleValue}
          />
          
          <div>
            <label>Theme:</label>
            <Select 
              value={selectValue}
              options={['Light', 'Dark', 'Auto']}
              onChange={setSelectValue}
            />
          </div>
        </div>
      </Panel>
      
      <Panel
        x={panels[2].x}
        y={panels[2].y}
        width={250}
        height={150}
        title={panels[2].title}
        onMove={(x, y) => {
          setPanels(p => p.map(panel => 
            panel.id === 'output' ? { ...panel, x, y } : panel
          ))
        }}
      >
        <div style={{ fontSize: '0.9em' }}>
          <p><strong>Current Values:</strong></p>
          <ul style={{ margin: '10px 0', paddingLeft: '20px' }}>
            <li>Volume: {sliderValue}%</li>
            <li>Name: {textValue || '(empty)'}</li>
            <li>Notifications: {toggleValue ? 'On' : 'Off'}</li>
            <li>Theme: {selectValue || 'Not selected'}</li>
          </ul>
        </div>
      </Panel>
    </div>
  )
}

// ============================================================================
// Wired Components Demo
// ============================================================================

function WiredComponentsDemo() {
  // Create two sliders that are wired together
  const slider1 = useTemplate(SliderTemplate, { value: 25 })
  const slider2 = useTemplate(SliderTemplate, { value: 75 })
  
  // Create a text field that shows the sum
  const sumField = useTemplate(TextFieldTemplate)
  
  // Wire the sliders to affect each other inversely
  useWiring([
    {
      from: { gadget: slider1.gadget, contact: 'value' },
      to: { gadget: slider2.gadget, contact: 'value' }
    }
  ])
  
  const [value1, setValue1] = useContact<number>(slider1.gadget, 'value')
  const [value2, setValue2] = useContact<number>(slider2.gadget, 'value')
  const [sumText, setSumText] = useContact<string>(sumField.gadget, 'text')
  
  React.useEffect(() => {
    const sum = (value1 || 0) + (value2 || 0)
    setSumText(sum.toString())
  }, [value1, value2, setSumText])
  
  return (
    <div style={{ padding: '20px', background: '#fff', borderRadius: '8px' }}>
      <h3>Wired Sliders (Connected via Propagation)</h3>
      <p style={{ color: '#666', marginBottom: '20px' }}>
        These sliders are wired together - moving one affects the other!
      </p>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <label>Slider 1:</label>
          <Slider value={value1 || 0} onChange={setValue1} />
        </div>
        
        <div>
          <label>Slider 2:</label>
          <Slider value={value2 || 0} onChange={setValue2} />
        </div>
        
        <div>
          <label>Sum:</label>
          <TextField text={sumText || ''} enabled={false} />
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Template Builder Demo
// ============================================================================

function TemplateBuilderDemo() {
  const builder = useTemplateBuilder()
  const [builtTemplate, setBuiltTemplate] = useState(null)
  
  const handleBuild = () => {
    // Build a simple processing pipeline
    builder.reset()
    builder.addComponent('input', SliderTemplate)
    builder.addComponent('processor', Multiply)
    builder.addComponent('output', TextFieldTemplate)
    
    builder.addConnection('input.value', 'processor.a')
    builder.addConnection('processor.result', 'output.text')
    
    builder.exposeInput('value', 'input.value')
    builder.exposeInput('factor', 'processor.b')
    builder.exposeOutput('result', 'output.text')
    
    const template = builder.build()
    setBuiltTemplate(template)
    console.log('Built template:', template)
  }
  
  return (
    <div style={{ padding: '20px', background: '#fff', borderRadius: '8px' }}>
      <h3>Template Builder</h3>
      <p style={{ color: '#666', marginBottom: '20px' }}>
        Build templates dynamically at runtime
      </p>
      
      <Button text="Build Pipeline Template" onClicked={handleBuild} />
      
      {builtTemplate && (
        <div style={{ marginTop: '20px', padding: '15px', background: '#f5f5f5', borderRadius: '4px' }}>
          <h4>Built Template Structure:</h4>
          <pre style={{ fontSize: '0.8em', overflow: 'auto' }}>
            {JSON.stringify(builtTemplate, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Main Demo App
// ============================================================================

export function DemoApp() {
  const [activeDemo, setActiveDemo] = useState('panels')
  
  return (
    <NetworkProvider>
      <div style={{ fontFamily: 'system-ui, sans-serif', padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
        <h1>Atto-Bassline Propagation UI Demo</h1>
        <p style={{ color: '#666', marginBottom: '30px' }}>
          React components that ARE gadgets in the propagation network
        </p>
        
        <div style={{ display: 'flex', gap: '10px', marginBottom: '30px' }}>
          <Button 
            text="Interactive Panels" 
            onClicked={() => setActiveDemo('panels')}
            style={{ background: activeDemo === 'panels' ? '#007bff' : '#fff', color: activeDemo === 'panels' ? '#fff' : '#000' }}
          />
          <Button 
            text="Color Picker" 
            onClicked={() => setActiveDemo('color')}
            style={{ background: activeDemo === 'color' ? '#007bff' : '#fff', color: activeDemo === 'color' ? '#fff' : '#000' }}
          />
          <Button 
            text="Wired Components" 
            onClicked={() => setActiveDemo('wired')}
            style={{ background: activeDemo === 'wired' ? '#007bff' : '#fff', color: activeDemo === 'wired' ? '#fff' : '#000' }}
          />
          <Button 
            text="Template Builder" 
            onClicked={() => setActiveDemo('builder')}
            style={{ background: activeDemo === 'builder' ? '#007bff' : '#fff', color: activeDemo === 'builder' ? '#fff' : '#000' }}
          />
        </div>
        
        <div style={{ minHeight: '500px' }}>
          {activeDemo === 'panels' && <InteractivePanels />}
          {activeDemo === 'color' && (
            <div style={{ padding: '20px', background: '#fff', borderRadius: '8px', maxWidth: '400px' }}>
              <ColorPicker />
            </div>
          )}
          {activeDemo === 'wired' && <WiredComponentsDemo />}
          {activeDemo === 'builder' && <TemplateBuilderDemo />}
        </div>
      </div>
    </NetworkProvider>
  )
}