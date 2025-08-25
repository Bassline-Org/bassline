/**
 * ListView Demo - Shows the power of query-based views
 */

import { useCallback } from 'react'
import { NetworkProvider, useNetwork, useGadget, useTypedCell, useFunctionOutput } from '../../../../proper-bassline-react/src/hooks'
import { ListViewComponent, SelectableListViewComponent } from '../../../../proper-bassline-react/src/list-view'
import { GraphViewComponent } from '../../../../proper-bassline-react/src/graph-view'
import { Network } from '../../../../proper-bassline/src/network'
import { OrdinalCell, MaxCell, SetCell } from '../../../../proper-bassline/src/cells/basic'
import { str, num, LatticeValue, isSet } from '../../../../proper-bassline/src/types'
import { QueryGadget } from '../../../../proper-bassline/src/query-gadget'
import { networkValue } from '../../../../proper-bassline/src/network-value'

// Component that connects QueryGadget output to ListView
function QueryListView({ network }: { network: Network }) {
  // Create query gadget and input cells
  const networkCell = useGadget(() => {
    const cell = new OrdinalCell('network-input')
    cell.userInput(networkValue(network))
    return cell
  }, 'network-cell')
  
  const selectorCell = useGadget(() => {
    const cell = new OrdinalCell('selector-input')
    cell.userInput(str('OrdinalCell'))
    return cell
  }, 'selector-cell')
  
  const queryGadget = useGadget(() => {
    const query = new QueryGadget('query-list')
    query.connectFrom('network', networkCell)
    query.connectFrom('selector', selectorCell)
    return query
  }, 'query-gadget')
  
  // Network cell already has the network value from initialization
  
  // Get query output (set of gadget IDs)
  const queryOutput = useFunctionOutput<LatticeValue>(queryGadget)
  
  // Process query output to get actual values
  let itemsArray: LatticeValue[] = []
  
  // Debug logging
  console.log('QueryListView - network children:', network.children.size)
  console.log('QueryListView - queryOutput:', queryOutput)
  console.log('QueryListView - queryOutput is Set?:', queryOutput instanceof Set)
  console.log('QueryListView - isSet(queryOutput)?:', isSet(queryOutput))
  
  // The queryOutput is actually a Set directly, not a LatticeSet
  if (queryOutput && queryOutput instanceof Set) {
    console.log('QueryListView - query returned set with size:', queryOutput.size)
    // The query returns a set of gadget IDs as strings
    const gadgetIds = Array.from(queryOutput)
    
    // For each ID, find the gadget and get its value
    const values: LatticeValue[] = []
    gadgetIds.forEach(idValue => {
      if (idValue.type === 'string') {
        console.log('Looking for gadget with ID:', idValue.value)
        // Find gadget by ID in the network's children
        let gadget = null
        for (const child of network.children) {
          if (child.id === idValue.value) {
            gadget = child
            break
          }
        }
        
        if (gadget && 'getOutput' in gadget) {
          const output = (gadget as any).getOutput()
          console.log('Found gadget, output:', output)
          if (output) {
            // Extract the actual value from the cell
            if (output.type === 'dict' && output.value.has('value')) {
              const cellValue = output.value.get('value')
              if (cellValue) {
                values.push(cellValue)
              }
            } else {
              values.push(output)
            }
          }
        }
      }
    })
    
    itemsArray = values
    console.log('QueryListView - final items:', itemsArray)
  }
  
  const handleItemClick = useCallback((item: LatticeValue, index: number) => {
    console.log('Query result clicked:', item, 'at index:', index)
  }, [])
  
  return (
    <div>
      <div className="mb-2 text-sm text-gray-500">
        Found {itemsArray.length} OrdinalCells in network
      </div>
      <ListViewComponent
        items={itemsArray}
        spacing={8}
        orientation="vertical"
        itemHeight={40}
        width={400}
        height={250}
        onItemClick={handleItemClick}
      />
    </div>
  )
}

function ListViewDemoContent() {
  const network = useNetwork()
  
  console.log('ListViewDemoContent - network:', network)
  console.log('ListViewDemoContent - network children before adding:', network.children.size)
  
  // Use cells for selection state
  const selectedItemCell = useGadget(() => {
    return new OrdinalCell<LatticeValue | null>('selected-item')
  }, 'selected-item-cell')
  
  const selectedIndexCell = useGadget(() => {
    return new OrdinalCell<number>('selected-index')
  }, 'selected-index-cell')
  
  // Get current selection values
  const [selectedItem] = useTypedCell(selectedItemCell)
  const [selectedIndex] = useTypedCell(selectedIndexCell)
  
  // Add demo data to the network
  const task1 = useGadget(() => {
    const cell = new OrdinalCell<string>('task-1')
    cell.setValue('Build ListView component')
    return cell
  }, 'task-1')
  
  const task2 = useGadget(() => {
    const cell = new OrdinalCell<string>('task-2')
    cell.setValue('Implement query system')
    return cell
  }, 'task-2')
  
  const task3 = useGadget(() => {
    const cell = new OrdinalCell<string>('task-3')
    cell.setValue('Create InspectorView')
    return cell
  }, 'task-3')
  
  const task4 = useGadget(() => {
    const cell = new OrdinalCell<string>('task-4')
    cell.setValue('Add GraphView layout')
    return cell
  }, 'task-4')
  
  const task5 = useGadget(() => {
    const cell = new OrdinalCell<string>('task-5')
    cell.setValue('Build unified editor')
    return cell
  }, 'task-5')
  
  // Add some numeric cells
  const counter1 = useGadget(() => {
    const cell = new MaxCell('counter-1')
    cell.setValue(42)
    return cell
  }, 'counter-1')
  
  const counter2 = useGadget(() => {
    const cell = new MaxCell('counter-2')
    cell.setValue(17)
    return cell
  }, 'counter-2')
  
  // Add a set cell
  const tags = useGadget(() => {
    const cell = new SetCell('tags')
    cell.add(str('ui'))
    cell.add(str('view'))
    cell.add(str('list'))
    return cell
  }, 'tags')
  
  console.log('ListViewDemoContent - network children after adding:', network.children.size)
  console.log('ListViewDemoContent - network children:', Array.from(network.children).map(c => c.id))
  
  // Static items for simple demo
  const staticItems = [
    str('Apple'),
    str('Banana'),
    str('Cherry'),
    str('Date'),
    str('Elderberry'),
    str('Fig'),
    str('Grape'),
    str('Honeydew')
  ]
  
  const numberItems = [
    num(100),
    num(200),
    num(300),
    num(400),
    num(500)
  ]
  
  const handleItemClick = useCallback((item: LatticeValue, index: number) => {
    console.log('Clicked item:', item, 'at index:', index)
  }, [])
  
  const handleSelectionChange = useCallback((item: LatticeValue | null, index: number) => {
    selectedItemCell.setValue(item)
    selectedIndexCell.setValue(index)
  }, [selectedItemCell, selectedIndexCell])
  
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">ListView Demo</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Basic ListView */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Basic ListView</h2>
          <p className="text-gray-600 mb-4">
            Simple list rendering with string items
          </p>
          <ListViewComponent
            items={staticItems}
            spacing={8}
            orientation="vertical"
            itemHeight={40}
            width={400}
            height={300}
            onItemClick={handleItemClick}
          />
        </div>
        
        {/* Horizontal ListView */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Horizontal ListView</h2>
          <p className="text-gray-600 mb-4">
            Horizontal layout with number items
          </p>
          <ListViewComponent
            items={numberItems}
            spacing={12}
            orientation="horizontal"
            itemHeight={60}
            width={400}
            height={100}
            onItemClick={handleItemClick}
          />
        </div>
        
        {/* Selectable ListView */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Selectable ListView</h2>
          <p className="text-gray-600 mb-4">
            Click items to select them
          </p>
          <SelectableListViewComponent
            items={staticItems}
            spacing={6}
            orientation="vertical"
            itemHeight={45}
            width={400}
            height={350}
            onItemClick={handleItemClick}
            onSelectionChange={handleSelectionChange}
          />
          {selectedIndex !== null && selectedIndex >= 0 && (
            <div className="mt-4 p-4 bg-blue-50 rounded">
              <p className="text-sm font-medium">Selected:</p>
              <p className="text-lg">
                Index {selectedIndex}: {selectedItem?.value || 'None'}
              </p>
            </div>
          )}
        </div>
        
        {/* Dynamic Query-based ListView */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Query-based ListView</h2>
          <p className="text-gray-600 mb-4">
            Shows OrdinalCells from the network
          </p>
          <QueryListView network={network} />
        </div>
      </div>
      
      {/* Network Graph Visualization */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Network Graph Visualization</h2>
        <p className="text-gray-600 mb-4">
          Visualizing the propagation network structure
        </p>
        <GraphViewComponent 
          network={network}
          width={900}
          height={400}
          nodeSpacing={150}
          className="shadow-lg"
        />
      </div>
      
      <div className="mt-12 p-6 bg-gray-50 rounded-lg">
        <h3 className="text-lg font-semibold mb-4">What's Happening?</h3>
        <ul className="space-y-2 text-gray-700">
          <li className="flex items-start">
            <span className="text-green-500 mr-2">✓</span>
            <span>
              ListView is a <strong>FunctionGadget</strong> that takes items and layout parameters
            </span>
          </li>
          <li className="flex items-start">
            <span className="text-green-500 mr-2">✓</span>
            <span>
              Each item is rendered as a <strong>VisualGadget</strong> (RectGadget + TextGadget)
            </span>
          </li>
          <li className="flex items-start">
            <span className="text-green-500 mr-2">✓</span>
            <span>
              The output is a <strong>Network</strong> containing positioned visuals
            </span>
          </li>
          <li className="flex items-start">
            <span className="text-green-500 mr-2">✓</span>
            <span>
              <strong>NetworkCanvas</strong> renders the output network as React components
            </span>
          </li>
          <li className="flex items-start">
            <span className="text-green-500 mr-2">✓</span>
            <span>
              Selection state is managed through <strong>OrdinalCells</strong> with our typed system
            </span>
          </li>
        </ul>
      </div>
      
      <div className="mt-8 p-6 bg-blue-50 rounded-lg">
        <h3 className="text-lg font-semibold mb-4">Next Steps</h3>
        <ul className="space-y-2 text-gray-700">
          <li>• Connect QueryGadget output to ListView for live data</li>
          <li>• Add custom item templates</li>
          <li>• Implement virtualization for large lists</li>
          <li>• Add drag-and-drop reordering</li>
          <li>• Create TreeView and GraphView</li>
        </ul>
      </div>
    </div>
  )
}

export default function ListViewDemo() {
  return (
    <NetworkProvider>
      <ListViewDemoContent />
    </NetworkProvider>
  )
}