/**
 * Basic test to verify strength-based propagation behavior
 */

import {
  createGadget,
  createContact,
  createSignal,
  wire,
  propagate,
  createTransistor,
  createModulator,
  createAdder,
  getAllReceipts,
  clearReceipts
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
    propagate(contact, createSignal('value1', 0.5))
    console.log(`Initial: value=${contact.signal.value}, strength=${contact.signal.strength}`)
    
    // Weaker signal - should be ignored
    propagate(contact, createSignal('value2', 0.4))
    console.log(`After weaker: value=${contact.signal.value}, strength=${contact.signal.strength}`)
    
    // Stronger signal - should replace
    propagate(contact, createSignal('value3', 0.7))
    console.log(`After stronger: value=${contact.signal.value}, strength=${contact.signal.strength}`)
    
    // Signal within hysteresis - should be ignored
    propagate(contact, createSignal('value4', 0.705))
    console.log(`Within hysteresis: value=${contact.signal.value}, strength=${contact.signal.strength}`)
    
    // Signal beyond hysteresis - should replace
    propagate(contact, createSignal('value5', 0.72))
    console.log(`Beyond hysteresis: value=${contact.signal.value}, strength=${contact.signal.strength}`)
  }
  
  // Test 2: Transistor attenuation
  console.log('\n' + '=' .repeat(50))
  console.log('\nTest 2: Transistor attenuation')
  {
    const transistor = createTransistor('t1', 0.5)
    const input = transistor.contacts.get('input')!
    const output = transistor.contacts.get('output')!
    
    // Connect output to a receiver
    const receiver = createGadget('receiver')
    const receiverContact = createContact('in', receiver)
    wire(output, receiverContact)
    
    // Send signal through transistor
    propagate(input, createSignal('data', 0.8))
    console.log(`Input: strength=${input.signal.strength}`)
    console.log(`Output: strength=${output.signal.strength} (attenuated by 0.5)`)
    console.log(`Receiver: strength=${receiverContact.signal.strength}`)
  }
  
  // Test 3: Modulator amplification with receipts
  console.log('\n' + '=' .repeat(50))
  console.log('\nTest 3: Modulator amplification')
  {
    clearReceipts()
    const modulator = createModulator('m1')
    const input = modulator.contacts.get('input')!
    const boost = modulator.contacts.get('boost')!
    const output = modulator.contacts.get('output')!
    
    // Set input signal
    propagate(input, createSignal('data', 0.3))
    
    // Apply boost
    propagate(boost, createSignal(0.4, 1.0))
    
    console.log(`Input: strength=${input.signal.strength}`)
    console.log(`Boost: value=${boost.signal.value}`)
    console.log(`Output: strength=${output.signal.strength} (boosted to 0.7)`)
    console.log(`Receipts generated: ${getAllReceipts().length}`)
    console.log(`Receipt details:`, getAllReceipts()[0])
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
    propagate(a, createSignal(5, 0.9))
    propagate(b, createSignal(3, 0.4))
    
    console.log(`Input A: value=${a.signal.value}, strength=${a.signal.strength}`)
    console.log(`Input B: value=${b.signal.value}, strength=${b.signal.strength}`)
    console.log(`Output: value=${output.signal.value}, strength=${output.signal.strength}`)
    console.log(`Note: Output strength is MIN(0.9, 0.4) = 0.4`)
  }
  
  // Test 5: Complex network with trust building
  console.log('\n' + '=' .repeat(50))
  console.log('\nTest 5: Trust-based amplification network')
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
    propagate(tcpOut, createSignal('peer-data', 1.0))
    console.log(`TCP signal: strength=${tcpOut.signal.strength}`)
    console.log(`After trust gate (10% trust): strength=${networkIn.signal.strength}`)
    
    // Increase trust
    propagate(gateControl, createSignal(0.5, 1.0))
    propagate(tcpOut, createSignal('peer-data-2', 1.0))
    console.log(`After trust increase (50% trust): strength=${networkIn.signal.strength}`)
    
    // Full trust
    propagate(gateControl, createSignal(1.0, 1.0))
    propagate(tcpOut, createSignal('peer-data-3', 1.0))
    console.log(`After full trust (100%): strength=${networkIn.signal.strength}`)
  }
  
  console.log('\n' + '=' .repeat(50))
  console.log('\nAll tests completed!')
}

// Run tests
test()