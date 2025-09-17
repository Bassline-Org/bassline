import { createGadget, Gadget } from "../../core";
import { changed, noop } from "../../effects";
import { createConnection, Socket } from "net";
import * as readline from "readline";

/**
 * Network-transparent choreography support
 *
 * Allows participants to be remote gadgets accessed over network
 */

export type RemoteEndpoint =
  | { type: 'tcp'; host: string; port: number }
  | { type: 'ws'; url: string }
  | { type: 'http'; url: string }
  | { type: 'local'; gadget: Gadget };

export interface RemoteParticipant {
  role: string;
  endpoint: RemoteEndpoint;
  connection?: any; // Socket, WebSocket, etc.
}

/**
 * Create a proxy gadget for a remote participant
 */
export function createRemoteProxy(endpoint: RemoteEndpoint): Gadget {
  switch (endpoint.type) {
    case 'tcp':
      return createTCPProxy(endpoint.host, endpoint.port);
    case 'local':
      return endpoint.gadget;
    default:
      throw new Error(`Unsupported endpoint type: ${endpoint.type}`);
  }
}

/**
 * TCP proxy gadget - forwards messages over TCP
 */
function createTCPProxy(host: string, port: number): Gadget {
  let socket: Socket | null = null;
  let connected = false;

  const proxy = createGadget<
    { connected: boolean; queued: any[] },
    any
  >(
    (current, incoming) => {
      if (!current.connected) {
        return { action: 'queue', context: { message: incoming } };
      }
      return { action: 'send', context: { message: incoming } };
    },
    {
      'queue': (gadget, { message }) => {
        const state = gadget.current();
        state.queued.push(message);
        gadget.update(state);
        return noop();
      },

      'send': (_gadget, { message }) => {
        if (socket && connected) {
          socket.write(JSON.stringify(message) + '\n');
        }
        return changed({ sent: message });
      }
    }
  )({ connected: false, queued: [] });

  // Establish TCP connection
  socket = createConnection(port, host, () => {
    console.log(`[TCP Proxy] Connected to ${host}:${port}`);
    connected = true;

    // Update proxy state
    const state = proxy.current();
    state.connected = true;

    // Send queued messages
    state.queued.forEach(msg => {
      socket!.write(JSON.stringify(msg) + '\n');
    });
    state.queued = [];

    proxy.update(state);
  });

  // Handle incoming messages
  const rl = readline.createInterface({
    input: socket,
    crlfDelay: Infinity
  });

  rl.on('line', (line) => {
    try {
      const data = JSON.parse(line);
      proxy.emit(changed({ received: data }));
    } catch (e) {
      console.error('[TCP Proxy] Failed to parse:', line);
    }
  });

  socket.on('error', (err) => {
    console.error(`[TCP Proxy] Error:`, err.message);
    connected = false;
  });

  socket.on('close', () => {
    console.log(`[TCP Proxy] Disconnected from ${host}:${port}`);
    connected = false;
  });

  return proxy;
}

/**
 * Network-aware choreography builder
 */
export interface NetworkChoreography {
  localParticipants: Record<string, Gadget>;
  remoteParticipants: Record<string, RemoteParticipant>;
  proxies: Record<string, Gadget>;
}

export const networkChoreography = createGadget<
  NetworkChoreography,
  | { addLocal: { role: string; gadget: Gadget } }
  | { addRemote: { role: string; endpoint: RemoteEndpoint } }
  | { connect: string }
  | { wireAll: true }
>(
  (current, incoming) => {
    if ('addLocal' in incoming) {
      return { action: 'addLocal', context: incoming.addLocal };
    }

    if ('addRemote' in incoming) {
      return { action: 'addRemote', context: incoming.addRemote };
    }

    if ('connect' in incoming) {
      return { action: 'connectRemote', context: { role: incoming.connect } };
    }

    if ('wireAll' in incoming) {
      return { action: 'wireAll' };
    }

    return null;
  },
  {
    'addLocal': (gadget, { role, gadget: localGadget }) => {
      const state = gadget.current();
      state.localParticipants[role] = localGadget;
      gadget.update(state);
      return changed({ localAdded: role });
    },

    'addRemote': (gadget, { role, endpoint }) => {
      const state = gadget.current();
      state.remoteParticipants[role] = { role, endpoint };
      gadget.update(state);
      return changed({ remoteAdded: role });
    },

    'connectRemote': (gadget, { role }) => {
      const state = gadget.current();
      const remote = state.remoteParticipants[role];

      if (!remote) {
        return changed({ connectFailed: `Role ${role} not found` });
      }

      // Create proxy for remote participant
      const proxy = createRemoteProxy(remote.endpoint);
      state.proxies[role] = proxy;
      gadget.update(state);

      return changed({ connected: role });
    },

    'wireAll': (gadget) => {
      const state = gadget.current();

      // Get all participants (local + proxies)
      const allParticipants: Record<string, Gadget> = {
        ...state.localParticipants,
        ...state.proxies
      };

      // In a real implementation, would wire based on relationships
      // For now, just report what we have
      return changed({
        wired: {
          local: Object.keys(state.localParticipants),
          remote: Object.keys(state.proxies),
          total: Object.keys(allParticipants).length
        }
      });
    }
  }
);

/**
 * Distributed choreography instantiator
 */
export async function instantiateDistributed(
  spec: {
    roles: Array<{ name: string; location?: RemoteEndpoint }>;
    relationships: Array<{ from: string; to: string; type: string }>;
  }
): Promise<Record<string, Gadget>> {
  const participants: Record<string, Gadget> = {};

  // Create participants (local or remote)
  for (const role of spec.roles) {
    if (role.location) {
      // Remote participant
      participants[role.name] = createRemoteProxy(role.location);
    } else {
      // Local participant (default)
      participants[role.name] = createGadget(
        (_s, data) => ({ action: 'pass', context: { data } }),
        { 'pass': (_g, { data }) => changed(data) }
      )({});
    }
  }

  // Wire them (would use wireParticipants from wiring.ts)
  // ... wiring logic ...

  return participants;
}

/**
 * Service discovery integration
 */
export function createDiscoverableParticipant(
  role: string,
  gadget: Gadget,
  registryEndpoint: RemoteEndpoint
) {
  // Register with discovery service
  const registry = createRemoteProxy(registryEndpoint);

  registry.receive({
    name: role,
    endpoint: {
      type: 'tcp',
      host: 'localhost', // Would get actual host
      port: 3000 + Math.floor(Math.random() * 1000)
    },
    metadata: { role, capabilities: [] }
  });

  return gadget;
}