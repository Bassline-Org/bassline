import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { useNetworkBridge } from '~/hooks/useNetworkBridge'
import { ReactFlow, Background, Controls, MiniMap } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { ContactNode } from '~/components/ContactNode'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'

const nodeTypes = {
  contact: ContactNode
}

export default function FlowExperiment() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const groupParam = searchParams.get('g') || 'root'
  
  const { 
    structure, 
    isReady, 
    sendAction,
    currentGroup,
    currentGroupId,
    navigationPath,
    enterGroup,
    exitGroup,
    projects,
    createProject,
    deleteProject,
    reset
  } = useNetworkBridge({ currentGroupId: groupParam })
  
  const [newProjectName, setNewProjectName] = useState('')
  const [nodeId, setNodeId] = useState(1)
  const [selectedProject, setSelectedProject] = useState<string | null>(null)
  
  // Convert structure to React Flow nodes
  const nodes = structure?.contacts ? Array.from(structure.contacts.entries()).map(([id, contact], index) => ({
    id,
    type: 'contact',
    position: { 
      x: 100 + (index % 4) * 200, 
      y: 100 + Math.floor(index / 4) * 150 
    },
    data: { 
      contact,
      contactId: id.split(':')[1],
      groupId: id.split(':')[0],
      sendAction 
    }
  })) : []
  
  // Convert wires to edges
  const edges = structure?.wires ? Array.from(structure.wires.entries()).map(([id, wire]) => ({
    id,
    source: wire.fromId,
    target: wire.toId,
    type: wire.properties?.bidirectional === false ? 'straight' : 'default'
  })) : []
  
  // Handle creating new project
  const handleCreateProject = () => {
    if (newProjectName.trim()) {
      createProject(newProjectName.trim())
      setNewProjectName('')
    }
  }
  
  // Handle selecting a project
  const handleSelectProject = (projectId: string) => {
    setSelectedProject(projectId)
    setSearchParams({ g: projectId })
  }
  
  // Handle going back to root
  const handleBackToRoot = () => {
    setSelectedProject(null)
    setSearchParams({ g: 'root' })
  }
  
  // Handle adding a contact
  const handleAddContact = () => {
    const contactName = `contact-${nodeId}`
    setNodeId(nodeId + 1)
    sendAction(['createContact', contactName, currentGroupId, { blendMode: 'merge' }])
  }
  
  // Handle creating a wire
  const handleConnect = (params: any) => {
    const wireId = `wire-${Date.now()}`
    sendAction(['createWire', wireId, params.source, params.target, true])
  }
  
  // Handle adding a gadget
  const handleAddGadget = (gadgetType: string) => {
    const gadgetId = `${gadgetType}-${Date.now()}`
    sendAction(['createGroup', gadgetId, gadgetType, { name: `${gadgetType} gadget` }, currentGroupId])
  }
  
  if (!isReady) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Initializing network...</div>
      </div>
    )
  }
  
  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="bg-gray-100 border-b p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold">Bassline Flow</h1>
            <div className="flex items-center gap-2 text-sm">
              {currentGroupId !== 'root' && (
                <>
                  <Button variant="link" size="sm" onClick={handleBackToRoot}>
                    root
                  </Button>
                  <span>/</span>
                </>
              )}
              <span className="font-medium">{currentGroupId}</span>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button
              onClick={handleAddContact}
              size="sm"
            >
              Add Contact
            </Button>
            <Button
              onClick={() => handleAddGadget('add')}
              size="sm"
              variant="outline"
            >
              Add Gadget
            </Button>
            <Button
              onClick={reset}
              size="sm"
              variant="destructive"
            >
              Reset All
            </Button>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Sidebar - Projects */}
        <div className="w-64 bg-white border-r p-4">
          <div className="mb-4">
            <h2 className="text-lg font-semibold mb-2">Projects</h2>
            <div className="flex gap-2">
              <Input
                placeholder="New project name"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
                className="flex-1"
              />
              <Button onClick={handleCreateProject} size="sm">
                Add
              </Button>
            </div>
          </div>
          
          <div className="space-y-2">
            {projects.map(project => (
              <Card 
                key={project.id}
                className={`cursor-pointer hover:shadow-md transition-shadow ${
                  selectedProject === project.id ? 'ring-2 ring-blue-500' : ''
                }`}
                onClick={() => handleSelectProject(project.id)}
              >
                <CardHeader className="p-3">
                  <CardTitle className="text-sm">{project.name}</CardTitle>
                </CardHeader>
              </Card>
            ))}
            
            {projects.length === 0 && (
              <p className="text-sm text-gray-500">No projects yet. Create one above!</p>
            )}
          </div>
        </div>
        
        {/* Main Canvas */}
        <div className="flex-1">
          <Tabs defaultValue="graph" className="h-full">
            <TabsList className="ml-4 mt-2">
              <TabsTrigger value="graph">Graph View</TabsTrigger>
              <TabsTrigger value="data">Data View</TabsTrigger>
            </TabsList>
            
            <TabsContent value="graph" className="h-full m-0">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onConnect={handleConnect}
                nodeTypes={nodeTypes}
                fitView
              >
                <Background />
                <Controls />
                <MiniMap />
              </ReactFlow>
            </TabsContent>
            
            <TabsContent value="data" className="p-4">
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Contacts ({structure?.contacts?.size || 0})</h3>
                  <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto max-h-48">
                    {JSON.stringify(
                      structure?.contacts ? Object.fromEntries(structure.contacts) : {},
                      null,
                      2
                    )}
                  </pre>
                </div>
                
                <div>
                  <h3 className="font-semibold mb-2">Groups ({structure?.groups?.size || 0})</h3>
                  <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto max-h-48">
                    {JSON.stringify(
                      structure?.groups ? Object.fromEntries(structure.groups) : {},
                      null,
                      2
                    )}
                  </pre>
                </div>
                
                <div>
                  <h3 className="font-semibold mb-2">Wires ({structure?.wires?.size || 0})</h3>
                  <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto max-h-48">
                    {JSON.stringify(
                      structure?.wires ? Object.fromEntries(structure.wires) : {},
                      null,
                      2
                    )}
                  </pre>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}