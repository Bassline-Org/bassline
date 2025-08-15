/**
 * Pico-Bassline Combinators
 * Algebraic patterns for composing groups
 */

import { Group, WireMode } from './core'
import { Properties } from './types'

/**
 * Loop combinator - creates a feedback circuit
 * Input flows to body, body output flows to output and feeds back to body
 */
export function loop(id: string, bodyProps: Properties, parent?: Group): Group {
  const group = new Group(id, {}, parent)
  
  // Create boundary contacts with appropriate permissions
  const input = group.createContact('input', undefined, {
    boundary: true,
    internal: 'read',   // Internal can read from input
    external: 'write'   // External can write to input
  })
  
  const output = group.createContact('output', undefined, {
    boundary: true,
    internal: 'write',  // Internal can write to output
    external: 'read'    // External can read from output
  })
  
  // Create the body group
  const body = group.createGroup('body', bodyProps)
  
  // Ensure body has required contacts
  if (!body.contacts.has('input')) {
    body.createContact('input')
  }
  if (!body.contacts.has('output')) {
    body.createContact('output')
  }
  if (!body.contacts.has('feedback')) {
    body.createContact('feedback')
  }
  
  // Wire the loop: input → body.input
  const bodyInput = body.contacts.get('input')
  const bodyOutput = body.contacts.get('output')
  const bodyFeedback = body.contacts.get('feedback')
  
  if (bodyInput && bodyOutput && bodyFeedback) {
    input.wireTo(bodyInput, WireMode.FORWARD_ONLY)
    bodyOutput.wireTo(output, WireMode.FORWARD_ONLY)
    output.wireTo(bodyFeedback, WireMode.FORWARD_ONLY)  // Feedback loop
  }
  
  return group
}

/**
 * Sequence combinator - chains operations linearly
 * Input flows through each stage in order to output
 */
export function sequence(id: string, stages: Properties[], parent?: Group): Group {
  const group = new Group(id, {}, parent)
  
  // Create boundary contacts
  const input = group.createContact('input', undefined, {
    boundary: true,
    internal: 'read',
    external: 'write'
  })
  
  const output = group.createContact('output', undefined, {
    boundary: true,
    internal: 'write',
    external: 'read'
  })
  
  // Chain stages together
  let previous = input
  
  for (let i = 0; i < stages.length; i++) {
    const stage = group.createGroup(`stage${i}`, stages[i])
    
    // Ensure stage has input/output
    if (!stage.contacts.has('input')) {
      stage.createContact('input')
    }
    if (!stage.contacts.has('output')) {
      stage.createContact('output')
    }
    
    const stageInput = stage.contacts.get('input')
    const stageOutput = stage.contacts.get('output')
    
    if (stageInput && stageOutput) {
      previous.wireTo(stageInput, WireMode.FORWARD_ONLY)
      previous = stageOutput
    }
  }
  
  // Connect last stage to output
  previous.wireTo(output, WireMode.FORWARD_ONLY)
  
  return group
}

/**
 * Parallel combinator - splits computation into parallel branches
 * Input is sent to all branches, each branch has its own output
 */
export function parallel(id: string, branches: Properties[], parent?: Group): Group {
  const group = new Group(id, {}, parent)
  
  // Create input boundary
  const input = group.createContact('input', undefined, {
    boundary: true,
    internal: 'read',
    external: 'write'
  })
  
  // Create a branch and output for each parallel computation
  for (let i = 0; i < branches.length; i++) {
    const branch = group.createGroup(`branch${i}`, branches[i])
    
    // Create output for this branch
    const output = group.createContact(`output${i}`, undefined, {
      boundary: true,
      internal: 'write',
      external: 'read'
    })
    
    // Ensure branch has input/output
    if (!branch.contacts.has('input')) {
      branch.createContact('input')
    }
    if (!branch.contacts.has('output')) {
      branch.createContact('output')
    }
    
    const branchInput = branch.contacts.get('input')
    const branchOutput = branch.contacts.get('output')
    
    if (branchInput && branchOutput) {
      input.wireTo(branchInput, WireMode.FORWARD_ONLY)
      branchOutput.wireTo(output, WireMode.FORWARD_ONLY)
    }
  }
  
  return group
}

/**
 * Fork-Join combinator - split, process in parallel, then join
 * Input → splitter → branches → joiner → output
 */
export function forkJoin(
  id: string,
  splitter: Properties,
  branches: Properties[],
  joiner: Properties,
  parent?: Group
): Group {
  const group = new Group(id, {}, parent)
  
  // Create boundary contacts
  const input = group.createContact('input', undefined, {
    boundary: true,
    internal: 'read',
    external: 'write'
  })
  
  const output = group.createContact('output', undefined, {
    boundary: true,
    internal: 'write',
    external: 'read'
  })
  
  // Create splitter and joiner
  const split = group.createGroup('splitter', splitter)
  const join = group.createGroup('joiner', joiner)
  
  // Ensure splitter has input
  if (!split.contacts.has('input')) {
    split.createContact('input')
  }
  
  // Wire input to splitter
  const splitInput = split.contacts.get('input')
  if (splitInput) {
    input.wireTo(splitInput, WireMode.FORWARD_ONLY)
  }
  
  // Create branches and wire them
  for (let i = 0; i < branches.length; i++) {
    const branch = group.createGroup(`branch${i}`, branches[i])
    
    // Ensure splitter has output for this branch
    if (!split.contacts.has(`output${i}`)) {
      split.createContact(`output${i}`)
    }
    
    // Ensure branch has input/output
    if (!branch.contacts.has('input')) {
      branch.createContact('input')
    }
    if (!branch.contacts.has('output')) {
      branch.createContact('output')
    }
    
    // Ensure joiner has input for this branch
    if (!join.contacts.has(`input${i}`)) {
      join.createContact(`input${i}`)
    }
    
    const splitOutput = split.contacts.get(`output${i}`)
    const branchInput = branch.contacts.get('input')
    const branchOutput = branch.contacts.get('output')
    const joinInput = join.contacts.get(`input${i}`)
    
    if (splitOutput && branchInput && branchOutput && joinInput) {
      splitOutput.wireTo(branchInput, WireMode.FORWARD_ONLY)
      branchOutput.wireTo(joinInput, WireMode.FORWARD_ONLY)
    }
  }
  
  // Wire joiner to output
  if (!join.contacts.has('output')) {
    join.createContact('output')
  }
  
  const joinOutput = join.contacts.get('output')
  if (joinOutput) {
    joinOutput.wireTo(output, WireMode.FORWARD_ONLY)
  }
  
  return group
}