/**
 * Basic test to verify strength-based propagation behavior
 */

import {
  createGadget,
  createContact,
  signal,  // Use signal() helper for decimal values
  wire,
  propagate,
  createTransistor,
  createGainMinter,
  createAdder,
  getAllReceipts,
  clearReceipts,
  formatStrength,
  toUnits
} from './src/index'

function test() {
  console.log('Testing Atto-Bassline Strength Propagation\n')
  console.log('=' .repeat(50))
  
  // Test 1: Basic argmax with hysteresis
  console.log('\nTest 1: Argmax with hysteresis')
  {
    const gadget = createGadget('test')
    const contact = createContact('c1', gadget)
    
    // Initial signal
    propagate(contact, signal('value1', 0.5))
    console.log(`Initial: value=${contact.signal.value}, strength=${formatStrength(contact.signal.strength)}`)
    
    // Weaker signal - should be ignored
    propagate(contact, signal('value2', 0.4))
    console.log(`After weaker: value=${contact.signal.value}, strength=${formatStrength(contact.signal.strength)}`)
    
    // Stronger signal - should replace
    propagate(contact, signal('value3', 0.7))
    console.log(`After stronger: value=${contact.signal.value}, strength=${formatStrength(contact.signal.strength)}`)
    
    // Signal within hysteresis - should be ignored (0.7 + 0.01 = 0.71)
    propagate(contact, signal('value4', 0.705))
    console.log(`Within hysteresis: value=${contact.signal.value}, strength=${formatStrength(contact.signal.strength)}`)
    
    // Signal beyond hysteresis - should replace
    propagate(contact, signal('value5', 0.72))
    console.log(`Beyond hysteresis: value=${contact.signal.value}, strength=${formatStrength(contact.signal.strength)}`)
  }
  
  // Test 2: Transistor attenuation
  console.log('\n' + '=' .repeat(50))
  console.log('\nTest 2: Transistor attenuation')
  {
    const transistor = createTransistor('t1')
    const input = transistor.contacts.get('input')!
    const control = transistor.contacts.get('control')!
    const output = transistor.contacts.get('output')!
    
    // Connect output to a receiver
    const receiver = createGadget('receiver')
    const receiverContact = createContact('in', receiver)
    wire(output, receiverContact)
    
    // Send signal through transistor
    propagate(input, signal('data', 0.8))
    // Apply negative control for attenuation
    propagate(control, signal(-4000, 1.0))  // Reduce by 4000 units
    
    console.log(`Input: strength=${formatStrength(input.signal.strength)}`)
    console.log(`Control: ${control.signal.value} units`)
    console.log(`Output: strength=${formatStrength(output.signal.strength)}`)
    console.log(`Receiver: strength=${formatStrength(receiverContact.signal.strength)}`)
  }
  
  // Test 3: Transistor amplification with gain
  console.log('\n' + '=' .repeat(50))
  console.log('\nTest 3: Transistor amplification with gain')
  {
    clearReceipts()
    const transistor = createTransistor('amp1')
    const input = transistor.contacts.get('input')!
    const control = transistor.contacts.get('control')!
    const output = transistor.contacts.get('output')!
    
    // Add gain to transistor
    transistor.gainPool = 3000  // 0.3 worth of gain
    
    // Set input signal
    propagate(input, signal('data', 0.3))
    
    // Apply amplification (control now additive, not multiplicative)
    propagate(control, signal(3000, 1.0))  // Boost by 3000 units
    
    console.log(`Input: strength=${formatStrength(input.signal.strength)}`)
    console.log(`Control: value=${control.signal.value} units`)
    console.log(`Output: strength=${formatStrength(output.signal.strength)}`)
    console.log(`Remaining gain: ${transistor.gainPool} units`)
    console.log(`Receipts generated: ${getAllReceipts().length}`)
    if (getAllReceipts().length > 0) {
      console.log(`Receipt details:`, getAllReceipts()[0])
    }
  }
  
  // Test 4: Primitive gadget with MIN strength
  console.log('\n' + '=' .repeat(50))
  console.log('\nTest 4: Adder with MIN strength')
  {
    const adder = createAdder('add1')
    const a = adder.contacts.get('a')!
    const b = adder.contacts.get('b')!
    const output = adder.contacts.get('output')!
    
    // Set inputs with different strengths
    propagate(a, signal(5, 0.9))
    propagate(b, signal(3, 0.4))
    
    console.log(`Input A: value=${a.signal.value}, strength=${a.signal.strength}`)
    console.log(`Input B: value=${b.signal.value}, strength=${b.signal.strength}`)
    console.log(`Output: value=${output.signal.value}, strength=${output.signal.strength}`)
    console.log(`Note: Output strength is MIN(0.9, 0.4) = 0.4`)
  }
  
  // Test 5: Complex network with trust building
  console.log('\n' + '=' .repeat(50))
  console.log('\nTest 5: Trust-based attenuation network')
  {
    // Create a "TCP input" gadget
    const tcpInput = createGadget('tcp-peer')
    const tcpOut = createContact('output', tcpInput)
    tcpInput.contacts.set('output', tcpOut)
    
    // Create trust gate (transistor)
    const trustGate = createTransistor('trust-gate', 0.1) // Start with low trust
    const gateInput = trustGate.contacts.get('input')!
    const gateControl = trustGate.contacts.get('control')!
    const gateOutput = trustGate.contacts.get('output')!
    
    // Wire TCP to trust gate
    wire(tcpOut, gateInput)
    
    // Create final receiver
    const network = createGadget('network')
    const networkIn = createContact('data', network)
    network.contacts.set('data', networkIn)
    wire(gateOutput, networkIn)
    
    // Simulate incoming data with high strength (but untrusted source)
    propagate(tcpOut, signal('peer-data', 1.0))
    console.log(`TCP signal: strength=${formatStrength(tcpOut.signal.strength)}`)
    
    // Start with attenuation (negative control)
    propagate(gateControl, signal(-9000, 1.0))  // Reduce by 90%
    console.log(`After trust gate (10% trust): strength=${formatStrength(networkIn.signal.strength)}`)
    
    // Increase trust (less attenuation)
    propagate(gateControl, signal(-5000, 1.1))  // Reduce by 50%
    console.log(`After trust increase (50% trust): strength=${formatStrength(networkIn.signal.strength)}`)
    
    // Full trust (no attenuation)
    propagate(gateControl, signal(0, 1.2))  // Pass through
    console.log(`After full trust (100%): strength=${formatStrength(networkIn.signal.strength)}`)
  }
  
  console.log('\n' + '=' .repeat(50))
  console.log('\nAll tests completed!')
}

// Run tests
test()