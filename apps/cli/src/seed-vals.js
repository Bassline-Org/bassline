/**
 * Seed example vals for baltown demo
 */

export default async function seedVals(bl) {
  console.log('Seeding example vals...')

  // Example 1: Simple propagator val - double a number
  await bl.put(
    'bl:///vals/examples/double',
    {},
    {
      description: 'Double the input value',
      valType: 'propagator',
      definition: {
        inputs: ['bl:///cells/input'],
        output: 'bl:///cells/doubled',
        handler: ['multiply', { value: 2 }],
      },
      tags: ['math', 'simple'],
    }
  )

  // Example 2: Handler composition - celsius to fahrenheit
  await bl.put(
    'bl:///vals/examples/celsius-to-fahrenheit',
    {},
    {
      description: 'Convert Celsius to Fahrenheit: (C * 9/5) + 32',
      valType: 'handler',
      definition: [
        'pipe',
        ['multiply', { value: 9 }],
        ['divide', { value: 5 }],
        ['add', { value: 32 }],
      ],
      tags: ['conversion', 'temperature'],
    }
  )

  // Example 3: Cell val - shared counter
  await bl.put(
    'bl:///vals/examples/counter-cell',
    {},
    {
      description: 'A counter cell that only goes up',
      valType: 'cell',
      definition: {
        lattice: 'counter',
        initial: 0,
      },
      tags: ['state', 'counter'],
    }
  )

  // Example 4: Recipe val - counter widget template
  await bl.put(
    'bl:///vals/examples/counter-widget',
    {},
    {
      description: 'A complete counter widget with value and doubled display',
      valType: 'recipe',
      definition: {
        params: {
          name: { required: true, description: 'Name for the counter' },
        },
        resources: [
          {
            id: 'counter',
            uri: 'bl:///cells/${name}',
            body: { lattice: 'counter' },
            init: 0,
          },
          {
            id: 'doubled',
            uri: 'bl:///cells/${name}-doubled',
            body: { lattice: 'maxNumber' },
          },
          {
            id: 'doubler',
            uri: 'bl:///propagators/${name}-doubler',
            body: {
              inputs: ['${ref.counter}'],
              output: '${ref.doubled}',
              handler: ['multiply', { value: 2 }],
            },
          },
        ],
      },
      tags: ['widget', 'counter', 'recipe'],
    }
  )

  // Example 5: Propagator val - sum two cells
  await bl.put(
    'bl:///vals/examples/sum-cells',
    {},
    {
      description: 'Sum two cell values into a third',
      valType: 'propagator',
      definition: {
        inputs: ['bl:///cells/a', 'bl:///cells/b'],
        output: 'bl:///cells/sum',
        handler: 'sum',
      },
      tags: ['math', 'aggregation'],
    }
  )

  // Example 6: Handler composition - format as currency
  await bl.put(
    'bl:///vals/examples/format-currency',
    {},
    {
      description: 'Format a number as USD currency',
      valType: 'handler',
      definition: ['format', { template: '$${value}.00' }],
      tags: ['formatting', 'currency'],
    }
  )

  // Example 7: Recipe val - simple monitor
  await bl.put(
    'bl:///vals/examples/status-checker',
    {},
    {
      description: 'A recipe that creates a cell to track status values',
      valType: 'recipe',
      definition: {
        params: {
          name: { required: true, description: 'Status name' },
        },
        resources: [
          {
            id: 'status',
            uri: 'bl:///cells/status-${name}',
            body: { lattice: 'lww' },
            init: { status: 'unknown', lastChecked: null },
          },
        ],
      },
      tags: ['monitoring', 'status', 'recipe'],
    }
  )

  console.log('  vals: seeded 7 examples')
}
