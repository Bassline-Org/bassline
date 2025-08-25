/**
 * TreeView Demo - Shows hierarchical data visualization
 */

import { useState, useCallback } from 'react'
import { NetworkProvider, useNetwork, useGadget } from '../../../../proper-bassline-react/src/hooks'
import { TreeViewComponent } from '../../../../proper-bassline-react/src/tree-view'
import { Network } from '../../../../proper-bassline/src/network'
import { OrdinalCell } from '../../../../proper-bassline/src/cells/basic'
import { AddFunction, MultiplyFunction } from '../../../../proper-bassline/src/functions/basic'
import { str, num, dict, array, set, obj } from '../../../../proper-bassline/src/types'
import type { LatticeValue } from '../../../../proper-bassline/src/types'

function TreeViewDemoContent() {
  const network = useNetwork()
  const [expandedNodes, setExpandedNodes] = useState(new Set<string>(['root', 'root-0', 'root-1']))
  
  // Create a hierarchical structure
  const hierarchicalData = dict(new Map([
    ['name', str('Project Root')],
    ['type', str('directory')],
    ['children', array([
      dict(new Map([
        ['name', str('src')],
        ['type', str('directory')],
        ['children', array([
          dict(new Map([
            ['name', str('components')],
            ['type', str('directory')],
            ['children', array([
              dict(new Map([
                ['name', str('Button.tsx')],
                ['type', str('file')],
                ['size', num(2048)]
              ])),
              dict(new Map([
                ['name', str('Input.tsx')],
                ['type', str('file')],
                ['size', num(3072)]
              ])),
              dict(new Map([
                ['name', str('Modal.tsx')],
                ['type', str('file')],
                ['size', num(4096)]
              ]))
            ])]
          ])),
          dict(new Map([
            ['name', str('utils')],
            ['type', str('directory')],
            ['children', array([
              dict(new Map([
                ['name', str('helpers.ts')],
                ['type', str('file')],
                ['size', num(1024)]
              ])),
              dict(new Map([
                ['name', str('constants.ts')],
                ['type', str('file')],
                ['size', num(512)]
              ]))
            ])]
          ])),
          dict(new Map([
            ['name', str('index.ts')],
            ['type', str('file')],
            ['size', num(256)]
          ]))
        ])]
      ])),
      dict(new Map([
        ['name', str('public')],
        ['type', str('directory')],
        ['children', array([
          dict(new Map([
            ['name', str('favicon.ico')],
            ['type', str('file')],
            ['size', num(4096)]
          ])),
          dict(new Map([
            ['name', str('index.html')],
            ['type', str('file')],
            ['size', num(1024)]
          ]))
        ])]
      ])),
      dict(new Map([
        ['name', str('package.json')],
        ['type', str('file')],
        ['size', num(2048)]
      ])),
      dict(new Map([
        ['name', str('README.md')],
        ['type', str('file')],
        ['size', num(8192)]
      ]))
    ])]
  ]))
  
  // Create a network structure to display
  const sampleNetwork = useGadget(() => {
    const net = new Network('sample-network')
    
    // Add some cells
    const cell1 = new OrdinalCell('data-1')
    cell1.userInput(num(42))
    net.add(cell1)
    
    const cell2 = new OrdinalCell('data-2')
    cell2.userInput(str('Hello'))
    net.add(cell2)
    
    // Add some gadgets
    const adder = new AddFunction('adder')
    net.add(adder)
    
    const multiplier = new MultiplyFunction('multiplier')
    net.add(multiplier)
    
    // Connect them
    adder.connectFrom('a', cell1)
    multiplier.connectFrom('a', adder)
    
    return net
  })
  
  const handleNodeClick = useCallback((nodeId: string) => {
    console.log('Node clicked:', nodeId)
  }, [])
  
  const handleNodeExpand = useCallback((nodeId: string, expanded: boolean) => {
    console.log('Node', nodeId, expanded ? 'expanded' : 'collapsed')
  }, [])
  
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">TreeView Demo</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* File System Tree */}
        <div>
          <h2 className="text-xl font-semibold mb-4">File System Structure</h2>
          <p className="text-gray-600 mb-4">
            Interactive tree with expand/collapse
          </p>
          <TreeViewComponent
            root={hierarchicalData}
            width={500}
            height={600}
            nodeHeight={28}
            indent={24}
            expandedNodes={expandedNodes}
            interactive={true}
            onNodeClick={handleNodeClick}
            onNodeExpand={handleNodeExpand}
            className="shadow-lg"
          />
        </div>
        
        {/* Network Structure Tree */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Network Structure</h2>
          <p className="text-gray-600 mb-4">
            Visualizing a propagation network as a tree
          </p>
          <TreeViewComponent
            root={obj(sampleNetwork)}
            width={500}
            height={600}
            nodeHeight={30}
            indent={20}
            expandedNodes={new Set(['root'])}
            interactive={true}
            onNodeClick={handleNodeClick}
            onNodeExpand={handleNodeExpand}
            className="shadow-lg"
          />
        </div>
        
        {/* Simple Data Tree */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Simple Data Structure</h2>
          <p className="text-gray-600 mb-4">
            Basic tree with nested arrays and objects
          </p>
          <TreeViewComponent
            root={dict(new Map([
              ['users', array([
                dict(new Map([
                  ['name', str('Alice')],
                  ['age', num(30)],
                  ['active', str('true')]
                ])),
                dict(new Map([
                  ['name', str('Bob')],
                  ['age', num(25)],
                  ['active', str('false')]
                ]))
              ])],
              ['settings', dict(new Map([
                ['theme', str('dark')],
                ['language', str('en')],
                ['notifications', dict(new Map([
                  ['email', str('true')],
                  ['push', str('false')]
                ]))]
              ]))]
            ]))}
            width={500}
            height={400}
            nodeHeight={26}
            indent={20}
            className="shadow-lg"
          />
        </div>
        
        {/* Current Network Tree */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Current Network</h2>
          <p className="text-gray-600 mb-4">
            The main network with all gadgets
          </p>
          <TreeViewComponent
            root={obj(network)}
            width={500}
            height={400}
            nodeHeight={28}
            indent={22}
            expandedNodes={new Set(['root'])}
            interactive={true}
            onNodeClick={handleNodeClick}
            onNodeExpand={handleNodeExpand}
            className="shadow-lg"
          />
        </div>
      </div>
      
      <div className="mt-12 p-6 bg-gray-50 rounded-lg">
        <h3 className="text-lg font-semibold mb-4">What's Happening?</h3>
        <ul className="space-y-2 text-gray-700">
          <li className="flex items-start">
            <span className="text-green-500 mr-2">✓</span>
            <span>
              <strong>TreeView</strong> is a FunctionGadget that renders hierarchical data
            </span>
          </li>
          <li className="flex items-start">
            <span className="text-green-500 mr-2">✓</span>
            <span>
              It supports <strong>Networks</strong>, <strong>Dicts</strong>, <strong>Arrays</strong>, and <strong>Sets</strong>
            </span>
          </li>
          <li className="flex items-start">
            <span className="text-green-500 mr-2">✓</span>
            <span>
              Interactive mode allows <strong>expand/collapse</strong> of nodes
            </span>
          </li>
          <li className="flex items-start">
            <span className="text-green-500 mr-2">✓</span>
            <span>
              Each node shows a <strong>label</strong> and <strong>value preview</strong>
            </span>
          </li>
          <li className="flex items-start">
            <span className="text-green-500 mr-2">✓</span>
            <span>
              The output is a <strong>GroupGadget</strong> with positioned visual elements
            </span>
          </li>
        </ul>
      </div>
    </div>
  )
}

export default function TreeViewDemo() {
  return (
    <NetworkProvider>
      <TreeViewDemoContent />
    </NetworkProvider>
  )
}