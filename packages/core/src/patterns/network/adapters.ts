/**
 * Protocol-Generic Transport Adapters
 *
 * Adapters are thin forwarding layers between transports and gadgets.
 * They have ZERO business logic - just mechanical data forwarding.
 *
 * Key principle: Adapters are generic over protocols - they work with
 * ANY gadget implementing a behavioral contract.
 */

import { Implements, ProtocolShape } from '../../core/context';
import { Protocols } from '../../';

// ================================================
// Generic Adapter (Works with Any Protocol)
// ================================================

/**
 * Generic WebSocket adapter for any gadget with serializable protocol.
 *
 * This is the universal adapter - works with ANY gadget implementing
 * a ProtocolShape<I, E>. Just provide codecs if custom serialization needed.
 *
 * @example
 * ```typescript
 * const cell = withTaps(quick(unionProto<number>(), new Set()));
 *
 * wsAdapter(socket, cell, {
 *   serialize: (set) => Array.from(set),
 *   deserialize: (arr) => new Set(arr)
 * });
 * ```
 */
export function wsAdapter<I, E extends Record<string, any>>(
  socket: any, // WebSocket | any - works with any WebSocket-like interface
  gadget: Implements<ProtocolShape<I, E>>,
  codec?: {
    serialize?: (input: I) => any;
    deserialize?: (data: any) => I;
  }
): () => void {
  const serialize = codec?.serialize ?? ((x: I) => x);
  const deserialize = codec?.deserialize ?? ((x: any) => x as I);

  // Transport → Gadget (incoming messages)
  const handleMessage = (data: any) => {
    try {
      const raw = typeof data === 'string' ? data : data.toString();
      const parsed = JSON.parse(raw);
      gadget.receive(deserialize(parsed));
    } catch (e) {
      console.error('[wsAdapter] Failed to parse message:', e);
    }
  };

  // Gadget → Transport (outgoing effects)
  const cleanup = gadget.tap((effects) => {
    try {
      socket.send(JSON.stringify(effects));
    } catch (e) {
      console.error('[wsAdapter] Failed to send effects:', e);
    }
  });

  // Wire up transport listeners
  socket.on?.('message', handleMessage) ?? socket.addEventListener?.('message', (e: any) => handleMessage(e.data));

  // Cleanup on disconnect
  const handleClose = () => cleanup();
  socket.on?.('close', handleClose) ?? socket.addEventListener?.('close', handleClose);

  return cleanup;
}

// ================================================
// Protocol-Specific Adapters (Higher-Level)
// ================================================

/**
 * Adapter for Valued<T> protocol gadgets.
 *
 * Valued gadgets emit { changed: T } and accept T as input.
 * This adapter handles the protocol automatically.
 *
 * @example
 * ```typescript
 * const cell = withTaps(quick(lastProto<number>(), 0));
 * wsValuedAdapter(socket, cell);
 *
 * // With Set codec
 * const unionCell = withTaps(quick(unionProto<number>(), new Set()));
 * wsValuedAdapter(socket, unionCell, {
 *   serialize: (set) => Array.from(set),
 *   deserialize: (arr) => new Set(arr)
 * });
 * ```
 */
export function wsValuedAdapter<T>(
  socket: any,
  gadget: Implements<Protocols.Valued<T>>,
  codec?: {
    serialize?: (value: T) => any;
    deserialize?: (data: any) => T;
  }
): () => void {
  return wsAdapter(socket, gadget, codec);
}

/**
 * Adapter for Transform<In, Out> protocol gadgets.
 *
 * Transform gadgets emit { computed: Out } and accept In as input.
 *
 * @example
 * ```typescript
 * const doubler = withTaps(quick(
 *   transformProto((x: number) => x * 2),
 *   undefined
 * ));
 * wsTransformAdapter(socket, doubler);
 * ```
 */
export function wsTransformAdapter<In, Out>(
  socket: any,
  gadget: Implements<Protocols.Transform<In, Out>>,
  codec?: {
    serializeInput?: (input: In) => any;
    deserializeInput?: (data: any) => In;
  }
): () => void {
  return wsAdapter(socket, gadget, codec ? {
    serialize: codec.serializeInput,
    deserialize: codec.deserializeInput
  } : undefined);
}

/**
 * Adapter for FallibleTransform<In, Out> protocol gadgets.
 *
 * Fallible gadgets emit { computed: Out } | { failed: {...} }.
 *
 * @example
 * ```typescript
 * const parser = withTaps(quick(fallibleProto(JSON.parse), undefined));
 * wsFallibleAdapter(socket, parser);
 * ```
 */
export function wsFallibleAdapter<In, Out>(
  socket: any,
  gadget: Implements<Protocols.FallibleTransform<In, Out>>,
  codec?: {
    serializeInput?: (input: In) => any;
    deserializeInput?: (data: any) => In;
  }
): () => void {
  return wsAdapter(socket, gadget, codec ? {
    serialize: codec.serializeInput,
    deserialize: codec.deserializeInput
  } : undefined);
}

// ================================================
// Broadcast Adapter (One-to-Many)
// ================================================

/**
 * Broadcast adapter: one gadget's effects → many transports.
 *
 * Useful for server scenarios where state updates should be
 * sent to all connected clients.
 *
 * @example
 * ```typescript
 * const sharedState = createSharedState();
 * const clients = new Set<WebSocket>();
 *
 * // All clients receive state updates
 * wsBroadcastAdapter(sharedState, () => clients);
 * ```
 */
export function wsBroadcastAdapter<I, E extends Record<string, any>>(
  gadget: Implements<ProtocolShape<I, E>>,
  getSockets: () => Iterable<any>
): () => void {
  return gadget.tap((effects) => {
    const data = JSON.stringify(effects);
    for (const socket of getSockets()) {
      try {
        // Check if socket is open (works with both Node.js ws and browser WebSocket)
        const isOpen = socket.readyState === 1 || socket.readyState === socket.OPEN;
        if (isOpen) {
          socket.send(data);
        }
      } catch (e) {
        console.error('[wsBroadcastAdapter] Failed to send to client:', e);
      }
    }
  });
}

// ================================================
// HTTP Adapter (Request/Response)
// ================================================

/**
 * HTTP adapter for request/response pattern.
 *
 * Sends input to gadget, waits for first effect, responds with it.
 * One-shot operation per request.
 *
 * @example
 * ```typescript
 * app.post('/compute', (req, res) => {
 *   httpAdapter(req, res, transformGadget, {
 *     extractInput: (body) => body.value,
 *     extractOutput: (effects) => effects.computed
 *   });
 * });
 * ```
 */
export function httpAdapter<I, E extends Record<string, any>, Out>(
  req: any,
  res: any,
  gadget: Implements<ProtocolShape<I, E>>,
  config: {
    extractInput: (body: any) => I;
    extractOutput: (effects: Partial<E>) => Out | undefined;
  }
): void {
  const input = config.extractInput(req.body);
  gadget.receive(input);

  const cleanup = gadget.tap((effects) => {
    const output = config.extractOutput(effects);
    if (output !== undefined) {
      res.json({ result: output });
      cleanup();
    }
  });
}

// ================================================
// IPC Adapter (Inter-Process Communication)
// ================================================

/**
 * IPC adapter for Node.js child processes.
 *
 * Forwards messages between process and gadget bidirectionally.
 *
 * @example
 * ```typescript
 * const child = fork('./worker.js');
 * const gadget = createWorkerGadget();
 * ipcAdapter(child, gadget);
 * ```
 */
export function ipcAdapter<I, E extends Record<string, any>>(
  process: NodeJS.Process,
  gadget: Implements<ProtocolShape<I, E>>,
  codec?: {
    serialize?: (input: I) => any;
    deserialize?: (data: any) => I;
  }
): () => void {
  const serialize = codec?.serialize ?? ((x: I) => x);
  const deserialize = codec?.deserialize ?? ((x: any) => x as I);

  // Process messages → Gadget
  const handleMessage = (msg: any) => {
    try {
      gadget.receive(deserialize(msg));
    } catch (e) {
      console.error('[ipcAdapter] Failed to process message:', e);
    }
  };

  process.on('message', handleMessage);

  // Gadget effects → Process
  const cleanup = gadget.tap((effects) => {
    try {
      process.send?.(effects);
    } catch (e) {
      console.error('[ipcAdapter] Failed to send effects:', e);
    }
  });

  return () => {
    process.off('message', handleMessage);
    cleanup();
  };
}
