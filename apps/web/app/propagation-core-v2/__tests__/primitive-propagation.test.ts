import { describe, it, expect } from 'vitest'
import { createImmediateScheduler } from '../schedulers/immediate'
import { getPrimitiveGadget } from '../primitives'
import type { Group } from '../types'

describe('Primitive Gadget Propagation', () => {
  it('should execute add gadget when inputs are provided', async () => {
    const scheduler = createImmediateScheduler()
    
    // Create root group
    await scheduler.registerGroup({
      id: 'root',
      name: 'Root',
      contactIds: [],
      wireIds: [],
      subgroupIds: [],
      boundaryContactIds: []
    })
    
    // Create add gadget group
    const addGadget = getPrimitiveGadget('add')!
    const gadgetGroup: Group = {
      id: 'add-gadget',
      name: 'Add Gadget',
      parentId: 'root',
      contactIds: [],
      wireIds: [],
      subgroupIds: [],
      boundaryContactIds: [],
      primitive: addGadget
    }
    await scheduler.registerGroup(gadgetGroup)
    
    // Add to parent
    const rootState = await scheduler.getState('root')
    rootState.group.subgroupIds.push('add-gadget')
    
    // Get the auto-created boundary contacts
    const gadgetState = await scheduler.getState('add-gadget')
    let inputA: string | undefined
    let inputB: string | undefined
    let outputSum: string | undefined
    
    gadgetState.contacts.forEach((contact, id) => {
      if (contact.isBoundary && contact.name === 'a') inputA = id
      if (contact.isBoundary && contact.name === 'b') inputB = id
      if (contact.isBoundary && contact.name === 'sum') outputSum = id
    })
    
    if (!inputA || !inputB || !outputSum) {
      throw new Error('Boundary contacts not found')
    }
    
    // Create external contacts in root
    const sourceA = await scheduler.addContact('root', {
      groupId: 'root',
      content: 5,
      blendMode: 'accept-last'
    })
    
    const sourceB = await scheduler.addContact('root', {
      groupId: 'root',
      content: 3,
      blendMode: 'accept-last'
    })
    
    const result = await scheduler.addContact('root', {
      groupId: 'root',
      blendMode: 'accept-last'
    })
    
    // Connect sources to gadget inputs
    await scheduler.connect(sourceA, inputA)
    await scheduler.connect(sourceB, inputB)
    
    // Connect gadget output to result
    await scheduler.connect(outputSum, result)
    
    // Check result
    const resultContact = await scheduler.getContact(result)
    expect(resultContact?.content).toBe(8)
  })
  
  it('should not execute gadget until all required inputs are present', async () => {
    const scheduler = createImmediateScheduler()
    
    // Create root group
    await scheduler.registerGroup({
      id: 'root',
      name: 'Root',
      contactIds: [],
      wireIds: [],
      subgroupIds: [],
      boundaryContactIds: []
    })
    
    // Create multiply gadget
    const multiplyGadget = getPrimitiveGadget('multiply')!
    await scheduler.registerGroup({
      id: 'multiply-gadget',
      name: 'Multiply Gadget',
      parentId: 'root',
      contactIds: [],
      wireIds: [],
      subgroupIds: [],
      boundaryContactIds: [],
      primitive: multiplyGadget
    })
    
    // Get the auto-created boundary contacts
    const gadgetState = await scheduler.getState('multiply-gadget')
    let inputA: string | undefined
    let inputB: string | undefined
    let outputProduct: string | undefined
    
    gadgetState.contacts.forEach((contact, id) => {
      if (contact.isBoundary && contact.name === 'a') inputA = id
      if (contact.isBoundary && contact.name === 'b') inputB = id
      if (contact.isBoundary && contact.name === 'product') outputProduct = id
    })
    
    if (!inputA || !inputB || !outputProduct) {
      throw new Error('Boundary contacts not found')
    }
    
    // Create source and result
    const sourceA = await scheduler.addContact('root', {
      groupId: 'root',
      content: 4,
      blendMode: 'accept-last'
    })
    
    const result = await scheduler.addContact('root', {
      groupId: 'root',
      blendMode: 'accept-last'
    })
    
    // Connect only one input
    await scheduler.connect(sourceA, inputA)
    await scheduler.connect(outputProduct, result)
    
    // Result should still be undefined (gadget not activated)
    let resultContact = await scheduler.getContact(result)
    expect(resultContact?.content).toBeUndefined()
    
    // Now add second input
    const sourceB = await scheduler.addContact('root', {
      groupId: 'root',
      content: 7,
      blendMode: 'accept-last'
    })
    
    await scheduler.connect(sourceB, inputB)
    
    // Now result should be computed
    resultContact = await scheduler.getContact(result)
    expect(resultContact?.content).toBe(28)
  })
  
  it('should handle chained gadgets', async () => {
    const scheduler = createImmediateScheduler()
    
    // Create root
    await scheduler.registerGroup({
      id: 'root',
      name: 'Root',
      contactIds: [],
      wireIds: [],
      subgroupIds: [],
      boundaryContactIds: []
    })
    
    // Create two add gadgets to chain: (a + b) + c
    const addGadget = getPrimitiveGadget('add')!
    
    // First add gadget
    await scheduler.registerGroup({
      id: 'add1',
      name: 'Add 1',
      parentId: 'root',
      contactIds: [],
      wireIds: [],
      subgroupIds: [],
      boundaryContactIds: [],
      primitive: addGadget
    })
    
    // Second add gadget
    await scheduler.registerGroup({
      id: 'add2',
      name: 'Add 2',
      parentId: 'root',
      contactIds: [],
      wireIds: [],
      subgroupIds: [],
      boundaryContactIds: [],
      primitive: addGadget
    })
    
    // Get the auto-created boundary contacts for first gadget
    const add1State = await scheduler.getState('add1')
    let add1_a: string | undefined
    let add1_b: string | undefined
    let add1_sum: string | undefined
    
    add1State.contacts.forEach((contact, id) => {
      if (contact.isBoundary && contact.name === 'a') add1_a = id
      if (contact.isBoundary && contact.name === 'b') add1_b = id
      if (contact.isBoundary && contact.name === 'sum') add1_sum = id
    })
    
    if (!add1_a || !add1_b || !add1_sum) {
      throw new Error('Add1 boundary contacts not found')
    }
    
    // Get the auto-created boundary contacts for second gadget
    const add2State = await scheduler.getState('add2')
    let add2_a: string | undefined
    let add2_b: string | undefined
    let add2_sum: string | undefined
    
    add2State.contacts.forEach((contact, id) => {
      if (contact.isBoundary && contact.name === 'a') add2_a = id
      if (contact.isBoundary && contact.name === 'b') add2_b = id
      if (contact.isBoundary && contact.name === 'sum') add2_sum = id
    })
    
    if (!add2_a || !add2_b || !add2_sum) {
      throw new Error('Add2 boundary contacts not found')
    }
    
    // Create sources
    const a = await scheduler.addContact('root', {
      groupId: 'root',
      content: 2,
      blendMode: 'accept-last'
    })
    
    const b = await scheduler.addContact('root', {
      groupId: 'root',
      content: 3,
      blendMode: 'accept-last'
    })
    
    const c = await scheduler.addContact('root', {
      groupId: 'root',
      content: 5,
      blendMode: 'accept-last'
    })
    
    const result = await scheduler.addContact('root', {
      groupId: 'root',
      blendMode: 'accept-last'
    })
    
    // Wire up: a -> add1.a, b -> add1.b
    await scheduler.connect(a, add1_a)
    await scheduler.connect(b, add1_b)
    
    // add1.sum -> add2.a, c -> add2.b
    await scheduler.connect(add1_sum, add2_a)
    await scheduler.connect(c, add2_b)
    
    // add2.sum -> result
    await scheduler.connect(add2_sum, result)
    
    // Check final result: (2 + 3) + 5 = 10
    const resultContact = await scheduler.getContact(result)
    expect(resultContact?.content).toBe(10)
  })
  
  it('should handle control flow gadgets', async () => {
    const scheduler = createImmediateScheduler()
    
    // Create root
    await scheduler.registerGroup({
      id: 'root',
      name: 'Root',
      contactIds: [],
      wireIds: [],
      subgroupIds: [],
      boundaryContactIds: []
    })
    
    // Create gate gadget
    const gateGadget = getPrimitiveGadget('gate')!
    await scheduler.registerGroup({
      id: 'gate1',
      name: 'Gate',
      parentId: 'root',
      contactIds: [],
      wireIds: [],
      subgroupIds: [],
      boundaryContactIds: [],
      primitive: gateGadget
    })
    
    // Get the auto-created boundary contacts
    const gateState = await scheduler.getState('gate1')
    let gateValue: string | undefined
    let gateCondition: string | undefined
    let gateOutput: string | undefined
    
    gateState.contacts.forEach((contact, id) => {
      if (contact.isBoundary && contact.name === 'value') gateValue = id
      if (contact.isBoundary && contact.name === 'condition') gateCondition = id
      if (contact.isBoundary && contact.name === 'output') gateOutput = id
    })
    
    if (!gateValue || !gateCondition || !gateOutput) {
      throw new Error('Gate boundary contacts not found')
    }
    
    // Create sources
    const value = await scheduler.addContact('root', {
      groupId: 'root',
      content: 'Hello',
      blendMode: 'accept-last'
    })
    
    const condition = await scheduler.addContact('root', {
      groupId: 'root',
      content: false,
      blendMode: 'accept-last'
    })
    
    const result = await scheduler.addContact('root', {
      groupId: 'root',
      blendMode: 'accept-last'
    })
    
    // Connect
    await scheduler.connect(value, gateValue)
    await scheduler.connect(condition, gateCondition)
    await scheduler.connect(gateOutput, result)
    
    // With false condition, result should be undefined
    let resultContact = await scheduler.getContact(result)
    expect(resultContact?.content).toBeUndefined()
    
    // Update condition to true
    await scheduler.scheduleUpdate(condition, true)
    
    // Now result should have the value
    resultContact = await scheduler.getContact(result)
    expect(resultContact?.content).toBe('Hello')
  })
})