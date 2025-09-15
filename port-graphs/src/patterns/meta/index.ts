/**
 * Meta-Gadgets
 *
 * These are gadgets that manage other gadgets - routing, subscriptions, etc.
 * They demonstrate that meta-level operations follow the same protocol as regular gadgets.
 * The network builds itself using the same mechanism it uses to process data!
 */

export * from './router';
export * from './pubsub';

// Example of composing meta-gadgets:
//
// import { createRouter, registerGadget, createPubSub, connectPubSubToRouter } from './meta';
// import { maxCell } from '../cells/numeric';
//
// // Create the infrastructure
// const router = createRouter();
// const pubsub = createPubSub();
//
// // Connect pubsub to router (layered meta-gadgets!)
// connectPubSubToRouter(pubsub, router);
//
// // Create some regular gadgets
// const sensor1 = maxCell(0);
// const sensor2 = maxCell(0);
// const display = createGadget(...);
//
// // Register gadgets with the router
// registerGadget(router, 'sensor1', sensor1);
// registerGadget(router, 'sensor2', sensor2);
// registerGadget(router, 'display', display);
// registerGadget(router, 'temperatures', display); // Topic name maps to display
//
// // Subscribe to topics
// pubsub.receive({ type: 'subscribe', topic: 'temperatures', subscriber: 'display' });
//
// // Publish data
// pubsub.receive({ type: 'publish', topic: 'temperatures', data: 25 });
// // This emits a routing command to the router, which delivers to display!