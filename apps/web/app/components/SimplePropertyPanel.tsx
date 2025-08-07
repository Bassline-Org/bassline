import { useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Label } from '~/components/ui/label'
import { Input } from '~/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { Switch } from '~/components/ui/switch'
import { useNetworkState } from '~/propagation-react/contexts/NetworkState'
import { useContactState } from '~/propagation-react/hooks/useContactState'
import { useGroupState } from '~/propagation-react/hooks/useGroupState'
import { useSoundSystem } from '~/components/SoundSystem'
import { useSoundToast } from '~/hooks/useSoundToast'

export function SimplePropertyPanel() {
  const { state, updateContact, updateGroup } = useNetworkState()
  const { selectedContactIds, selectedGroupIds } = state
  const { playSound } = useSoundSystem()
  const toast = useSoundToast()
  
  // Handle single or multiple selection
  const selectedContactId = selectedContactIds.length === 1 ? selectedContactIds[0] : null
  const selectedGroupId = selectedGroupIds.length === 1 ? selectedGroupIds[0] : null
  const hasMultipleContacts = selectedContactIds.length > 1
  const hasMultipleGroups = selectedGroupIds.length > 1
  const { 
    content, 
    blendMode, 
    isBoundary, 
    boundaryDirection,
    setContent, 
    setBlendMode,
    setBoundary,
    setBoundaryDirection 
  } = useContactState(selectedContactId)
  
  const {
    name,
    isPrimitive,
    contactIds,
    subgroupIds,
    boundaryContactIds,
    setName,
    setIsPrimitive
  } = useGroupState(selectedGroupId)
  
  const handleContentChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const newContent = event.target.value
    setContent(newContent)
    playSound('propagation/value-change')
    // Show toast for empty content
    if (newContent === '') {
      toast.info('Content cleared')
    }
  }, [setContent, playSound, toast])
  
  const handleBlendModeChange = useCallback((value: 'accept-last' | 'merge') => {
    if (hasMultipleContacts) {
      // Update all selected contacts
      selectedContactIds.forEach(id => {
        const contact = state.contacts[id]
        if (contact) {
          updateContact(id, { blendMode: value })
        }
      })
      playSound('ui/toggle')
      toast.success(`Updated blend mode for ${selectedContactIds.length} contacts`)
    } else {
      setBlendMode(value)
      playSound('ui/toggle')
      toast.success(`Blend mode: ${value === 'accept-last' ? 'Accept Last' : 'Merge'}`)
    }
  }, [setBlendMode, hasMultipleContacts, selectedContactIds, state.contacts, updateContact, playSound, toast])
  
  const handleBoundaryToggle = useCallback((checked: boolean) => {
    if (hasMultipleContacts) {
      // Update all selected contacts
      selectedContactIds.forEach(id => {
        const contact = state.contacts[id]
        if (contact) {
          updateContact(id, { 
            isBoundary: checked,
            boundaryDirection: checked ? 'input' : undefined
          })
        }
      })
      playSound('ui/boundary-create')
      toast.success(`Updated ${selectedContactIds.length} contacts`)
    } else {
      setBoundary(checked, 'input')
      playSound('ui/boundary-create')
      toast.success(checked ? 'Contact is now a boundary' : 'Contact is no longer a boundary')
    }
  }, [setBoundary, hasMultipleContacts, selectedContactIds, state.contacts, updateContact, playSound, toast])
  
  const handleBoundaryDirectionChange = useCallback((value: 'input' | 'output') => {
    setBoundaryDirection(value)
    playSound('ui/toggle')
    toast.info(`Boundary direction: ${value}`)
  }, [setBoundaryDirection, playSound, toast])
  
  const handleGroupNameChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const newName = event.target.value
    setName(newName)
    playSound('ui/text-change')
  }, [setName, playSound])
  
  const handlePrimitiveToggle = useCallback((checked: boolean) => {
    setIsPrimitive(checked)
    playSound('ui/toggle')
    toast.info(checked ? 'Group is now primitive' : 'Group is no longer primitive')
  }, [setIsPrimitive, playSound, toast])
  
  // Get common properties for multiple selection
  const getCommonBlendMode = useCallback(() => {
    if (!hasMultipleContacts) return blendMode
    const modes = selectedContactIds.map(id => state.contacts[id]?.blendMode).filter(Boolean)
    return modes.every(m => m === modes[0]) ? modes[0] : 'mixed'
  }, [hasMultipleContacts, selectedContactIds, state.contacts, blendMode])
  
  const getCommonBoundaryState = useCallback(() => {
    if (!hasMultipleContacts) return isBoundary
    const states = selectedContactIds.map(id => state.contacts[id]?.isBoundary).filter(b => b !== undefined)
    return states.every(s => s === states[0]) ? states[0] : 'mixed'
  }, [hasMultipleContacts, selectedContactIds, state.contacts, isBoundary])
  
  if (selectedContactIds.length === 0 && selectedGroupIds.length === 0) {
    return (
      <div className="w-80 p-4">
        <Card>
          <CardHeader>
            <CardTitle>Properties</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Select a contact or group to edit its properties
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }
  
  // Show group properties if a group is selected
  if (selectedGroupId) {
    return (
      <div className="w-80 p-4">
        <Card>
          <CardHeader>
            <CardTitle>Group Properties</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={handleGroupNameChange}
                placeholder="Enter group name..."
              />
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="primitive">Primitive Group</Label>
              <Switch
                id="primitive"
                checked={isPrimitive}
                onCheckedChange={handlePrimitiveToggle}
              />
            </div>
            
            <div className="space-y-2 text-sm text-muted-foreground">
              <div>Contacts: {contactIds.length}</div>
              <div>Subgroups: {subgroupIds.length}</div>
              <div>Boundary Contacts: {boundaryContactIds.length}</div>
            </div>
            
            <div className="text-xs text-muted-foreground">
              Group ID: {selectedGroupId}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }
  
  // Calculate common properties before conditional rendering (only if contacts selected)
  const commonBlendMode = selectedContactIds.length > 0 ? getCommonBlendMode() : 'accept-last'
  const commonBoundary = selectedContactIds.length > 0 ? getCommonBoundaryState() : false
  
  // Show contact properties if contact(s) selected
  if (selectedContactIds.length > 0) {
    return (
      <div className="w-80 p-4">
        <Card>
          <CardHeader>
            <CardTitle>
              {hasMultipleContacts 
                ? `${selectedContactIds.length} Contacts Selected`
                : 'Contact Properties'
              }
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!hasMultipleContacts && (
              <div>
                <Label htmlFor="content">Content</Label>
                <Input
                  id="content"
                  value={content || ''}
                  onChange={handleContentChange}
                  placeholder="Enter content..."
                />
              </div>
            )}
          
            <div>
              <Label htmlFor="blendMode">
                Blend Mode
                {commonBlendMode === 'mixed' && ' (Mixed)'}
              </Label>
              <Select 
                value={commonBlendMode === 'mixed' ? '' : commonBlendMode} 
                onValueChange={handleBlendModeChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder={commonBlendMode === 'mixed' ? 'Mixed' : undefined} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="accept-last">Accept Last</SelectItem>
                  <SelectItem value="merge">Merge</SelectItem>
                </SelectContent>
              </Select>
            </div>
          
            <div className="flex items-center justify-between">
              <Label htmlFor="boundary">
                Boundary Contact
                {commonBoundary === 'mixed' && ' (Mixed)'}
              </Label>
              <Switch
                id="boundary"
                checked={commonBoundary === true}
                onCheckedChange={handleBoundaryToggle}
              />
            </div>
          
            {!hasMultipleContacts && isBoundary && (
              <div>
                <Label htmlFor="boundaryDirection">Boundary Direction</Label>
                <Select value={boundaryDirection || 'input'} onValueChange={handleBoundaryDirectionChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="input">Input</SelectItem>
                    <SelectItem value="output">Output</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            
            <div className="text-xs text-muted-foreground">
              {hasMultipleContacts 
                ? `Selected IDs: ${selectedContactIds.join(', ')}`
                : `Contact ID: ${selectedContactId}`
              }
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }
  
  
  // This should never happen due to the above conditions, but TypeScript needs it
  return null
}