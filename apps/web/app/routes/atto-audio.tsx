/**
 * Atto-Bassline Audio Synthesis Demo
 * Demonstrates using the propagation network to generate and control audio
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  bootNetwork,
  createOscillator,
  createEnvelope,
  createMixer,
  createAudioOutput,
  wire,
  propagate,
  signal,
  createSignal,
  resumeAudioContext,
  type Network,
  type Gadget
} from 'atto-bassline'
import { NetworkProvider, useGadget, useContact } from 'atto-bassline/react-streams'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Slider } from '~/components/ui/slider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { Label } from '~/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { Play, Pause, Volume2 } from 'lucide-react'

function AudioControls() {
  const [isPlaying, setIsPlaying] = useState(false)
  const playStrengthRef = useRef(1000000) // Track play strength in units
  
  // Get gadgets from network
  const oscillator = useGadget('oscillator')
  const envelope = useGadget('envelope')
  const mixer = useGadget('mixer')
  const audioOutput = useGadget('audio-output')
  
  // Use new hooks to tap into contacts
  const [frequency, setFrequency] = useContact<number>(oscillator, 'frequency')
  const [waveform, setWaveform] = useContact<string>(oscillator, 'waveform_type')
  const [volume, setVolume] = useContact<number>(mixer, 'master')
  
  const [attack, setAttack] = useContact<number>(envelope, 'attack')
  const [decay, setDecay] = useContact<number>(envelope, 'decay')
  const [sustain, setSustain] = useContact<number>(envelope, 'sustain')
  const [release, setRelease] = useContact<number>(envelope, 'release')
  
  const handlePlay = useCallback(async () => {
    if (!oscillator || !audioOutput) return
    
    // Resume audio context on user interaction (required for Chrome autoplay policy)
    await resumeAudioContext()
    
    // First reset the trigger with higher strength
    playStrengthRef.current += 100
    propagate(oscillator.contacts.get('trigger')!, createSignal(false, playStrengthRef.current))
    
    // Then trigger after a small delay
    setTimeout(() => {
      // Increment strength for the actual trigger
      playStrengthRef.current += 100
      
      // Trigger oscillator to generate waveform
      propagate(oscillator.contacts.get('trigger')!, createSignal(true, playStrengthRef.current))
      
      // Small delay to let waveform propagate
      setTimeout(() => {
        // Then tell audio output to play
        playStrengthRef.current += 100
        propagate(audioOutput.contacts.get('play')!, createSignal(true, playStrengthRef.current))
        setIsPlaying(true)
        
        // Auto-stop after duration
        setTimeout(() => {
          playStrengthRef.current += 100
          propagate(oscillator.contacts.get('trigger')!, createSignal(false, playStrengthRef.current))
          propagate(audioOutput.contacts.get('play')!, createSignal(false, playStrengthRef.current))
          setIsPlaying(false)
        }, 2000)
      }, 100)  // Delay for propagation
    }, 50)  // Small delay before triggering
  }, [oscillator, audioOutput])
  
  const handleStop = useCallback(() => {
    if (!audioOutput || !oscillator) return
    
    playStrengthRef.current += 100
    propagate(audioOutput.contacts.get('play')!, createSignal(false, playStrengthRef.current))
    propagate(oscillator.contacts.get('trigger')!, createSignal(false, playStrengthRef.current))
    setIsPlaying(false)
  }, [audioOutput, oscillator])
  
  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Volume2 className="h-6 w-6" />
            Atto-Bassline Audio Synthesis
          </CardTitle>
          <CardDescription>
            Audio synthesis using propagation networks. Adjust parameters and click play to generate sound.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Play Controls */}
          <div className="flex gap-4">
            <Button
              onClick={handlePlay}
              disabled={isPlaying}
              className="flex items-center gap-2"
            >
              <Play className="h-4 w-4" />
              Play Sound
            </Button>
            <Button
              onClick={handleStop}
              disabled={!isPlaying}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Pause className="h-4 w-4" />
              Stop
            </Button>
          </div>
          
          {/* Parameter Controls */}
          <Tabs defaultValue="oscillator" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="oscillator">Oscillator</TabsTrigger>
              <TabsTrigger value="envelope">Envelope</TabsTrigger>
              <TabsTrigger value="mixer">Mixer</TabsTrigger>
            </TabsList>
            
            <TabsContent value="oscillator" className="space-y-4">
              <div className="space-y-2">
                <Label>Frequency: {frequency || 440}Hz</Label>
                <Slider
                  value={[frequency || 440]}
                  onValueChange={([v]) => setFrequency(v)}
                  min={20}
                  max={2000}
                  step={10}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Waveform</Label>
                <Select value={waveform || 'sine'} onValueChange={setWaveform}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sine">Sine</SelectItem>
                    <SelectItem value="square">Square</SelectItem>
                    <SelectItem value="sawtooth">Sawtooth</SelectItem>
                    <SelectItem value="triangle">Triangle</SelectItem>
                    <SelectItem value="noise">Noise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>
            
            <TabsContent value="envelope" className="space-y-4">
              {/* ADSR Controls */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Attack: {attack?.toFixed(3) || 0.01}s</Label>
                  <Slider
                    value={[attack || 0.01]}
                    onValueChange={([v]) => setAttack(v)}
                    min={0.001}
                    max={1}
                    step={0.001}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Decay: {decay?.toFixed(3) || 0.1}s</Label>
                  <Slider
                    value={[decay || 0.1]}
                    onValueChange={([v]) => setDecay(v)}
                    min={0.001}
                    max={1}
                    step={0.001}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Sustain: {(sustain || 0.7).toFixed(2)}</Label>
                  <Slider
                    value={[sustain || 0.7]}
                    onValueChange={([v]) => setSustain(v)}
                    min={0}
                    max={1}
                    step={0.01}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Release: {release?.toFixed(3) || 0.2}s</Label>
                  <Slider
                    value={[release || 0.2]}
                    onValueChange={([v]) => setRelease(v)}
                    min={0.001}
                    max={2}
                    step={0.001}
                  />
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="mixer" className="space-y-4">
              <div className="space-y-2">
                <Label>Master Volume: {((volume || 0.5) * 100).toFixed(0)}%</Label>
                <Slider
                  value={[volume || 0.5]}
                  onValueChange={([v]) => setVolume(v)}
                  min={0}
                  max={1}
                  step={0.01}
                />
              </div>
            </TabsContent>
          </Tabs>
          
          {/* Status Display */}
          <div className="rounded-lg bg-muted p-4">
            <h3 className="font-semibold mb-2">Current Settings</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>Frequency: {frequency || 440}Hz</div>
              <div>Waveform: {waveform || 'sine'}</div>
              <div>Volume: {((volume || 0.5) * 100).toFixed(0)}%</div>
              <div>ADSR: {attack?.toFixed(2)}/{decay?.toFixed(2)}/{sustain?.toFixed(2)}/{release?.toFixed(2)}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function AttoAudio() {
  const [networkContext, setNetworkContext] = useState<{ gadgets: Map<string, Gadget> } | null>(null)
  
  // Initialize network on mount
  useEffect(() => {
    async function init() {
      // Boot network with minimal configuration
      const net = await bootNetwork({
        version: "1.0",
        bootstrap: {
          userControl: {
            id: "audio-control",
            initialGain: 100000
          }
        }
      })
      
      // Create audio gadgets
      const osc = createOscillator('oscillator')
      const env = createEnvelope('envelope')
      const mixer = createMixer('mixer', 2)
      const audioOut = createAudioOutput('audio-output')
      
      // Add gadgets to network
      net.gadgets.set('oscillator', osc)
      net.gadgets.set('envelope', env)
      net.gadgets.set('mixer', mixer)
      net.gadgets.set('audio-output', audioOut)
      
      // Wire the audio processing chain
      // Oscillator → Envelope → Mixer → Audio Output
      wire(osc.contacts.get('waveform_out')!, env.contacts.get('waveform_in')!)
      wire(env.contacts.get('waveform_out')!, mixer.contacts.get('input1')!)
      wire(mixer.contacts.get('output')!, audioOut.contacts.get('audio')!)
      
      // Set initial values for all contacts with low strength so UI can override
      propagate(osc.contacts.get('frequency')!, signal(440, 0.1))
      propagate(osc.contacts.get('waveform_type')!, signal('sine', 0.1))
      propagate(osc.contacts.get('duration')!, signal(2, 0.1))
      propagate(osc.contacts.get('amplitude')!, signal(0.8, 0.1))
      propagate(osc.contacts.get('trigger')!, signal(false, 0.1))
      
      propagate(env.contacts.get('attack')!, signal(0.01, 0.1))
      propagate(env.contacts.get('decay')!, signal(0.1, 0.1))
      propagate(env.contacts.get('sustain')!, signal(0.7, 0.1))
      propagate(env.contacts.get('release')!, signal(0.2, 0.1))
      
      propagate(mixer.contacts.get('master')!, signal(0.5, 0.1))
      propagate(audioOut.contacts.get('gain')!, signal(1, 2.0))
      
      // Create network context
      setNetworkContext({
        gadgets: net.gadgets
      })
    }
    
    init()
  }, [])
  
  if (!networkContext) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <Card>
          <CardContent className="p-8">
            <div className="text-center">Loading audio network...</div>
          </CardContent>
        </Card>
      </div>
    )
  }
  
  return (
    <NetworkProvider network={networkContext}>
      <AudioControls />
    </NetworkProvider>
  )
}