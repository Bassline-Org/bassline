const { createSpawner, signal } = require('./dist/index.js');

const spawner = createSpawner('test');
console.log('Spawner gain pool:', spawner.gainPool);

const template = {
  tag: 'template',
  value: {
    spec: {
      structure: {
        contacts: {
          'input': { direction: 'input' },
          'output': { direction: 'output' }
        }
      }
    }
  }
};

const inputs = new Map([
  ['template', signal(template, 1.0)],
  ['trigger', signal(true, 1.0)]
]);

const outputs = spawner.compute(inputs);
console.log('Outputs:', outputs);
console.log('Instance:', outputs.get('instance'));
