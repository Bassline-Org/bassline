// test.ts
import { value, need, have, isValue, Gadget, Pool, cell, G } from './protocols';
import _ from 'lodash';

// Test 1: Basic cell accumulation
console.log('=== Test 1: Cell Accumulation ===');
const sumProtocol = (() => {
  let state = 0;
  return _.cond([
    [isValue, (data: any) => {
      const old = state;
      state = old + data.value;
      console.log(`Sum: ${old} + ${data.value} = ${state}`);
      return state;
    }],
    [_.stubTrue, _.noop]
  ]);
})();

const sumGadget = new Gadget('sum-1').use(sumProtocol);
sumGadget.receive(value(5));
sumGadget.receive(value(3));
sumGadget.receive(value(10));

// Test 2: Function transformation
console.log('\n=== Test 2: Function Transformation ===');
const doublerProtocol = _.cond([
  [isValue, (data: any) => {
    const result = data.value * 2;
    console.log(`Double: ${data.value} * 2 = ${result}`);
    return result;
  }],
  [_.stubTrue, _.noop]
]);

const doublerGadget = new Gadget('doubler-1').use(doublerProtocol);
doublerGadget.receive(value(7));

// Test 3: Pool discovery and matching
console.log('\n=== Test 3: Pool Discovery ===');
const pool = new Pool('main-pool');

// Listen for matches
pool.addEventListener('match', (e: Event) => {
  const { need, have } = (e as CustomEvent).detail;
  console.log(`Match found: ${have.source} can provide '${have.tag}' to ${need.source}`);
});

// Register needs and haves
pool.receive(need('temperature', 'thermostat'));
pool.receive(need('temperature', 'display'));
pool.receive(have('temperature', 'sensor-1'));
pool.receive(have('humidity', 'sensor-2'));

// Test 4: Full propagation network
console.log('\n=== Test 4: Complete Network ===');

// Create a mini network
const network = (() => {
  const pool = new Pool('network');
  const connections = new Map<string, Set<(data: any) => void>>();
  
  // Temperature sensor
  const sensor = new Gadget('temp-sensor');
  let currentTemp = 20;
  sensor.use(_.cond([
    [_.matches({ type: 'tick' }), () => {
      currentTemp += _.random(-2, 2);
      sensor.emit('propagate', value(currentTemp));
      console.log(`Sensor: temperature = ${currentTemp}°C`);
    }],
    [_.stubTrue, _.noop]
  ]));
  
  // Max accumulator
  const maxCell = (() => {
    let maxTemp = -Infinity;
    const gadget = new Gadget('max-temp');
    gadget.use(_.cond([
      [isValue, (data: any) => {
        const old = maxTemp;
        maxTemp = Math.max(maxTemp, data.value);
        if (maxTemp !== old) {
          console.log(`MaxCell: new maximum = ${maxTemp}°C`);
          gadget.emit('propagate', value(maxTemp));
        }
      }],
      [_.stubTrue, _.noop]
    ]));
    return gadget;
  })();
  
  // Average calculator
  const avgCell = (() => {
    let sum = 0;
    let count = 0;
    const gadget = new Gadget('avg-temp');
    gadget.use(_.cond([
      [isValue, (data: any) => {
        sum += data.value;
        count++;
        const avg = sum / count;
        console.log(`AvgCell: average = ${avg.toFixed(1)}°C (${count} samples)`);
        gadget.emit('propagate', value(avg));
      }],
      [_.stubTrue, _.noop]
    ]));
    return gadget;
  })();
  
  // Set up semantic discovery
  pool.receive(have('raw-temp', 'temp-sensor'));
  pool.receive(need('raw-temp', 'max-temp'));
  pool.receive(need('raw-temp', 'avg-temp'));
  
  // Wire based on pool matches
  pool.addEventListener('match', (e: Event) => {
    const { need, have } = (e as CustomEvent).detail;
    console.log(`Wiring: ${have.source} → ${need.source}`);
    
    // Create actual connection
    if (have.source === 'temp-sensor') {
      sensor.addEventListener('propagate', (evt: Event) => {
        const data = (evt as CustomEvent).detail;
        if (need.source === 'max-temp') maxCell.receive(data);
        if (need.source === 'avg-temp') avgCell.receive(data);
      });
    }
  });
  
  return { sensor, maxCell, avgCell, pool };
})();

// Run simulation
console.log('\n=== Running Network Simulation ===');
for (let i = 0; i < 5; i++) {
  console.log(`\n--- Tick ${i + 1} ---`);
  network.sensor.receive({ type: 'tick' });
}

// Test 5: Cycles and convergence
console.log('\n\n=== Test 5: Cycles (Price Discovery) ===');

const market = (() => {
  let price = 100;
  let supply = 50;
  let demand = 50;
  
  const priceGadget = new Gadget('price');
  const supplyGadget = new Gadget('supply');
  const demandGadget = new Gadget('demand');
  
  priceGadget.use(_.cond([
    [_.matches({ demand: _.isNumber, supply: _.isNumber }), (data: any) => {
      const oldPrice = price;
      // Price goes up when demand > supply
      price = price * (1 + (data.demand - data.supply) / 100);
      price = Math.round(price * 100) / 100;
      if (price !== oldPrice) {
        console.log(`Price: $${oldPrice} → $${price}`);
        supplyGadget.receive({ price });
        demandGadget.receive({ price });
      }
    }]
  ]));
  
  supplyGadget.use(_.cond([
    [_.matches({ price: _.isNumber }), (data: any) => {
      // Supply increases with price
      supply = 50 + (data.price - 100) * 0.5;
      console.log(`Supply: ${supply.toFixed(0)} units at $${data.price}`);
      priceGadget.receive({ supply, demand });
    }]
  ]));
  
  demandGadget.use(_.cond([
    [_.matches({ price: _.isNumber }), (data: any) => {
      // Demand decreases with price  
      demand = 150 - (data.price - 100) * 0.5;
      console.log(`Demand: ${demand.toFixed(0)} units at $${data.price}`);
      priceGadget.receive({ supply, demand });
    }]
  ]));
  
  return { priceGadget };
})();

// Kick off price discovery
console.log('Starting price discovery...');
market.priceGadget.receive({ demand: 80, supply: 40 });