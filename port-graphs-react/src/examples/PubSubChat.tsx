/**
 * Example: Chat application using PubSub gadgets
 *
 * Demonstrates how the pubsub system works in React with multiple components
 */

import React, { useEffect, useState } from 'react';
import { PubSubProvider, useGadget, useRegistry } from '../index';
import { createGadget } from 'port-graphs';

// Create a message collector gadget that accumulates messages
const createMessageCollector =
  createGadget<string[], string>(
    (messages, newMessage) => {
      return { action: 'add', context: { messages, newMessage } };
    },
    {
      add: (gadget, { messages, newMessage }) => {
        const updated = [...messages, newMessage];
        gadget.update(updated);
        return { changed: updated };
      }
    }
  );

interface ChatWidgetProps {
  userId: string;
  topic: string;
}

function ChatWidget({ userId, topic }: ChatWidgetProps) {
  const [input, setInput] = useState('');

  // Create a message collector for this widget
  const [messages, messageSend, messageCollector] = useGadget(
    createMessageCollector,
    []
  );
  const { publish, subscribe } = useRegistry(messageCollector, userId);
  useEffect(() => {
    subscribe(topic);
  }, [subscribe, topic])

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
          onKeyPress={(e) => e.key === 'Enter' && messageSend(input)}
          placeholder="Type a message..."
          style={{ flex: 1, padding: '5px' }}
        />
        <button onClick={() => messageSend(input)}>Send</button>
      </div>
    </div>
  );
}

export function PubSubChatExample() {
  return (
    <PubSubProvider>
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
    </PubSubProvider>
  );
}