import { Gadget, Network } from './gadgets'

// Create a simple test network
const network = new Network('test-network')

// Test gadget that will use connection limits
class TestGadget extends Gadget {
  constructor(id: string) {
    super(id, network)
    
    // Test the new interface with connection limits
    // Use the receive method to send control commands
    this.receive('control', ['setInterface', {
      inputs: [
        { name: 'input1', connectionLimit: 1 },     // Only 1 connection allowed
        { name: 'input2', connectionLimit: 2 }      // Up to 2 connections
      ],
      outputs: [
        { name: 'output1', connectionLimit: 3 },    // Max 3 connections
        { name: 'output2', connectionLimit: null }  // Unlimited connections
      ]
    }])
  }
}

// Test function
function testConnectionLimits() {
  console.log('🧪 Testing connection limits...')
  
  const gadget = new TestGadget('test-gadget')
  
  // Check that ports were created with correct limits
  const input1 = gadget.getPort('input1')
  const input2 = gadget.getPort('input2')
  const output1 = gadget.getPort('output1')
  const output2 = gadget.getPort('output2')
  
  console.log('✅ Ports created:', {
    input1: input1?.name,
    input2: input2?.name,
    output1: output1?.name,
    output2: output2?.name
  })
  
  // Test that we can access the interface
  const interface_ = gadget.getInterface()
  console.log('\n📋 Interface access test:')
  if (interface_) {
    console.log('✅ Interface retrieved successfully')
    console.log('  Inputs:', interface_.inputs.map(p => ({ name: p.name, connectionLimit: p.connectionLimit })))
    console.log('  Outputs:', interface_.outputs.map(p => ({ name: p.name, connectionLimit: p.connectionLimit })))
  } else {
    console.log('❌ Failed to retrieve interface')
  }
  
  // Test connection limits by trying to connect multiple times
  console.log('\n🔌 Testing connection limits...')
  
  // Test input1 (limit: 1)
  try {
    input1?.connectTo(['gadget1', 'out'])
    console.log('✅ First connection to input1 successful')
    
    input1?.connectTo(['gadget2', 'out'])
    console.log('❌ Second connection to input1 should have failed')
  } catch (error: any) {
    console.log('✅ Second connection to input1 correctly rejected:', error.message)
  }
  
  // Test input2 (limit: 2)
  try {
    input2?.connectTo(['gadget1', 'out'])
    console.log('✅ First connection to input2 successful')
    
    input2?.connectTo(['gadget2', 'out'])
    console.log('✅ Second connection to input2 successful')
    
    input2?.connectTo(['gadget3', 'out'])
    console.log('❌ Third connection to input2 should have failed')
  } catch (error: any) {
    console.log('✅ Third connection to input2 correctly rejected:', error.message)
  }
  
  // Test output1 (limit: 3)
  try {
    output1?.connectTo(['gadget1', 'in'])
    output1?.connectTo(['gadget2', 'in'])
    output1?.connectTo(['gadget3', 'in'])
    console.log('✅ Three connections to output1 successful')
    
    output1?.connectTo(['gadget4', 'in'])
    console.log('❌ Fourth connection to output1 should have failed')
  } catch (error: any) {
    console.log('✅ Fourth connection to output1 correctly rejected:', error.message)
  }
  
  // Test output2 (unlimited)
  try {
    for (let i = 1; i <= 5; i++) {
      output2?.connectTo([`gadget${i}`, 'in'])
    }
    console.log('✅ Five connections to output2 successful (unlimited)')
  } catch (error: any) {
    console.log('❌ Unlimited connections should not fail:', error.message)
  }
  
  console.log('\n🎉 Connection limit test completed!')
}

// Run the test
if (require.main === module) {
  testConnectionLimits()
}

export { testConnectionLimits }
