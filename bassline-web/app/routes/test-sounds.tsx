import { useState } from 'react'
import { SoundSystemProvider, useSoundSystem } from '~/components/SoundSystem'
import { Button } from '~/components/ui/button'

function TestSoundsContent() {
  const { playSound, setVolume, isEnabled, setEnabled } = useSoundSystem()
  const [volume, setVolumeState] = useState(0.5)
  
  const soundCategories = [
    {
      name: 'Connection Sounds',
      sounds: [
        { name: 'Create Connection', id: 'connection/create' },
        { name: 'Delete Connection', id: 'connection/delete' },
      ]
    },
    {
      name: 'Node Sounds',
      sounds: [
        { name: 'Create Node', id: 'node/create' },
        { name: 'Delete Node', id: 'node/delete' },
        { name: 'Select Node', id: 'node/select' },
      ]
    },
    {
      name: 'Gadget Sounds',
      sounds: [
        { name: 'Create Gadget', id: 'gadget/create' },
        { name: 'Delete Gadget', id: 'gadget/delete' },
        { name: 'Inline Gadget', id: 'gadget/inline' },
        { name: 'Extract Gadget', id: 'gadget/extract' },
        { name: 'Enter Gadget', id: 'gadget/enter' },
        { name: 'Exit Gadget', id: 'gadget/exit' },
      ]
    },
    {
      name: 'Propagation Sounds',
      sounds: [
        { name: 'Pulse', id: 'propagation/pulse' },
        { name: 'Contradiction', id: 'propagation/contradiction' },
        { name: 'Value Change', id: 'propagation/value-change' },
      ]
    },
    {
      name: 'UI Sounds',
      sounds: [
        { name: 'Button Click', id: 'ui/button-click' },
        { name: 'Toggle', id: 'ui/toggle' },
        { name: 'Success', id: 'ui/success' },
        { name: 'Error', id: 'ui/error' },
        { name: 'Layout', id: 'ui/layout' },
        { name: 'Tool Enable', id: 'ui/tool-enable' },
        { name: 'Tool Disable', id: 'ui/tool-disable' },
      ]
    },
    {
      name: 'Special Sounds',
      sounds: [
        { name: 'Achievement', id: 'special/achievement' },
        { name: 'Score', id: 'special/score' },
        { name: 'Combo', id: 'special/combo' },
        { name: 'Combo End', id: 'special/combo-end' },
        { name: 'Photo', id: 'special/photo' },
        { name: 'Favorite', id: 'special/favorite' },
        { name: 'Unfavorite', id: 'special/unfavorite' },
        { name: 'Celebrate', id: 'special/celebrate' },
        { name: 'Impact', id: 'special/impact' },
        { name: 'Jump', id: 'special/jump' },
        { name: 'Correct', id: 'special/correct' },
        { name: 'Incorrect', id: 'special/incorrect' },
        { name: 'Publish', id: 'special/publish' },
        { name: 'Decoration', id: 'special/decoration' },
      ]
    }
  ]
  
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Sound System Test</h1>
      
      <div className="mb-8 space-y-4">
        <div className="flex items-center gap-4">
          <label className="font-semibold">Sound Enabled:</label>
          <Button
            onClick={() => setEnabled(!isEnabled)}
            variant={isEnabled ? 'default' : 'outline'}
          >
            {isEnabled ? 'ON' : 'OFF'}
          </Button>
        </div>
        
        <div className="flex items-center gap-4">
          <label className="font-semibold">Volume:</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={(e) => {
              const newVolume = parseFloat(e.target.value)
              setVolumeState(newVolume)
              setVolume(newVolume)
            }}
            className="w-48"
          />
          <span>{Math.round(volume * 100)}%</span>
        </div>
        
        <p className="text-sm text-gray-600">
          Note: Sound mode must be active to hear sounds. Click or press any key to initialize audio.
        </p>
      </div>
      
      <div className="space-y-8">
        {soundCategories.map((category) => (
          <div key={category.name}>
            <h2 className="text-xl font-semibold mb-4">{category.name}</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {category.sounds.map((sound) => (
                <Button
                  key={sound.id}
                  onClick={() => playSound(sound.id)}
                  variant="outline"
                  size="sm"
                  disabled={!isEnabled}
                >
                  {sound.name}
                </Button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function TestSounds() {
  return (
    <SoundSystemProvider>
      <TestSoundsContent />
    </SoundSystemProvider>
  )
}