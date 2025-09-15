/**
 * Example: Chat application using PubSub gadgets
 *
 * Demonstrates how the pubsub system works in React with multiple components
 */

import React, { useState, useCallback } from 'react';
import { useGadget, useGadgetEffect, useStableGadget } from '../index';
import { createPubSubSystem } from 'port-graphs/dist/patterns/meta/routing';
import { createGadget } from 'port-graphs/dist/core';
import type { Gadget } from 'port-graphs';

// Create a message collector gadget that accumulates messages
const createMessageCollector = (initial: string[]) =>
  createGadget<string[], string>(
    (messages, newMessage) => {
      return { action: 'add', context: newMessage };
    },
    {
      add: (gadget, message) => {
        const updated = [...gadget.current(), message];
        gadget.update(updated);
        return { changed: updated };
      }
    }
  )(initial);

interface ChatWidgetProps {
  userId: string;
  topic: string;
}

function ChatWidget({ userId, topic }: ChatWidgetProps) {
  const [input, setInput] = useState('');

  // Create a message collector for this widget
  const [messages, messageCollector] = useGadget(
    () => createMessageCollector([]),
    []
  );

  // Get the global pubsub system (in a real app, this might come from context)
  const pubsubSystem = React.useContext(PubSubContext);

  // Subscribe this widget's collector to the topic
  React.useEffect(() => {
    if (!pubsubSystem || !messageCollector) return;

    // Register our message collector
    pubsubSystem.registry.receive({ [userId]: messageCollector });

    // Subscribe to the topic
    pubsubSystem.subscriptions.receive({
      type: 'subscribe',
      topic,
      subscriber: userId
    });

    // Cleanup on unmount
    return () => {
      pubsubSystem.subscriptions.receive({
        type: 'unsubscribe',
        topic,
        subscriber: userId
      });
    };
  }, [pubsubSystem, messageCollector, userId, topic]);

  const sendMessage = () => {
    if (!input.trim() || !pubsubSystem) return;

    const message = `[${userId}]: ${input}`;

    // Publish to the topic
    pubsubSystem.pubsub.receive({
      command: {
        type: 'publish',
        topic,
        data: message
      }
    });

    setInput('');
  };

  return (
    <div style={{
      border: '1px solid #ddd',
      borderRadius: '8px',
      padding: '15px',
      width: '300px'
    }}>
      <h3>{userId} - Topic: {topic}</h3>

      <div style={{
        height: '200px',
        overflowY: 'auto',
        border: '1px solid #eee',
        padding: '10px',
        marginBottom: '10px',
        backgroundColor: '#f9f9f9'
      }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ marginBottom: '5px' }}>{msg}</div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '5px' }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Type a message..."
          style={{ flex: 1, padding: '5px' }}
        />
        <button onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
}

// Context for sharing pubsub system
const PubSubContext = React.createContext<ReturnType<typeof createPubSubSystem> | null>(null);

export function PubSubChatExample() {
  // Create the pubsub system at the app level
  const { state: pubsubState, gadget: pubsubSystem } = useStableGadget(
    () => {
      const system = createPubSubSystem();
      // Return a composite gadget that holds the whole system
      return createGadget(
        () => ({ action: 'noop' }),
        { noop: () => null }
      )(system);
    },
    createPubSubSystem()
  );

  return (
    <PubSubContext.Provider value={pubsubState}>
      <div style={{ padding: '20px' }}>
        <h2>PubSub Chat Example</h2>
        <p>Multiple chat widgets sharing topics through the gadget pubsub system</p>

        <div style={{ display: 'flex', gap: '20px', marginTop: '20px' }}>
          <ChatWidget userId="Alice" topic="general" />
          <ChatWidget userId="Bob" topic="general" />
        </div>

        <div style={{ display: 'flex', gap: '20px', marginTop: '20px' }}>
          <ChatWidget userId="Charlie" topic="tech" />
          <ChatWidget userId="Dana" topic="tech" />
        </div>
      </div>
    </PubSubContext.Provider>
  );
}