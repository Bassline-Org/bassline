import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createConnection } from 'net';
import { createBassline } from '../src/setup.js';

// Helper to create a TCP client that sends/receives BL/T messages
function createClient(port) {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ port }, () => {
      const client = {
        socket,
        buffer: '',
        responses: [],
        waiters: [],

        // Send a line
        send(line) {
          socket.write(line + '\n');
        },

        // Wait for next response
        async receive() {
          if (this.responses.length > 0) {
            return this.responses.shift();
          }
          return new Promise((res) => {
            this.waiters.push(res);
          });
        },

        // Close connection
        close() {
          socket.end();
        }
      };

      socket.on('data', (data) => {
        client.buffer += data.toString();
        let idx;
        while ((idx = client.buffer.indexOf('\n')) !== -1) {
          const line = client.buffer.slice(0, idx);
          client.buffer = client.buffer.slice(idx + 1);
          if (client.waiters.length > 0) {
            client.waiters.shift()(line);
          } else {
            client.responses.push(line);
          }
        }
      });

      resolve(client);
    });
    socket.on('error', reject);
  });
}

describe('TCP Server (BL/T Protocol)', () => {
  let bl;
  let server;
  const PORT = 9877;

  beforeEach(() => {
    bl = createBassline();
    server = bl.resolve(`bl:///server/tcp?port=${PORT}`);
    server.write({ action: 'start' });
  });

  afterEach(() => {
    server.dispose();
    bl.dispose();
  });

  describe('Basic Operations', () => {
    it('should respond to VERSION', async () => {
      const client = await createClient(PORT);
      client.send('VERSION BL/1.0');
      const response = await client.receive();
      expect(response).toBe('VERSION BL/1.0');
      client.close();
    });

    it('should handle READ after WRITE', async () => {
      const client = await createClient(PORT);

      client.send('WRITE bl:///cell/counter 42');
      expect(await client.receive()).toBe('OK');

      client.send('READ bl:///cell/counter');
      expect(await client.receive()).toBe('OK 42');

      client.close();
    });

    it('should handle WRITE with JSON object', async () => {
      const client = await createClient(PORT);

      client.send('WRITE bl:///cell/user {"name":"alice","age":30}');
      expect(await client.receive()).toBe('OK');

      client.send('READ bl:///cell/user');
      const response = await client.receive();
      expect(response).toBe('OK {"name":"alice","age":30}');

      client.close();
    });

    it('should handle INFO request', async () => {
      const client = await createClient(PORT);

      // First create the cell
      client.send('WRITE bl:///cell/test 0');
      await client.receive();

      client.send('INFO bl:///cell/test');
      const response = await client.receive();
      expect(response).toMatch(/^OK \{.*"readable":true.*"writable":true.*"ordering":"causal".*\}$/);

      client.close();
    });

    it('should handle INFO for fold (ordering: none)', async () => {
      const client = await createClient(PORT);

      client.send('INFO bl:///fold/sum');
      const response = await client.receive();
      expect(response).toMatch(/^OK \{.*"ordering":"none".*\}$/);

      client.close();
    });
  });

  describe('Tags', () => {
    it('should echo tags in responses', async () => {
      const client = await createClient(PORT);

      client.send('WRITE bl:///cell/x 10 @req1');
      expect(await client.receive()).toBe('OK @req1');

      client.send('READ bl:///cell/x @req2');
      expect(await client.receive()).toBe('OK 10 @req2');

      client.close();
    });
  });

  describe('Subscriptions', () => {
    it('should create subscription and receive events', async () => {
      const client = await createClient(PORT);

      // Set initial value
      client.send('WRITE bl:///cell/counter 0');
      await client.receive();

      // Subscribe
      client.send('SUBSCRIBE bl:///cell/counter');

      // Should receive current value as EVENT
      const event1 = await client.receive();
      expect(event1).toBe('EVENT s1 0');

      // Should receive STREAM response
      const stream = await client.receive();
      expect(stream).toBe('STREAM s1');

      // Write from another client
      const client2 = await createClient(PORT);
      client2.send('WRITE bl:///cell/counter 100');
      await client2.receive();
      client2.close();

      // First client should receive event
      const event2 = await client.receive();
      expect(event2).toBe('EVENT s1 100');

      client.close();
    });

    it('should handle UNSUBSCRIBE', async () => {
      const client = await createClient(PORT);

      client.send('WRITE bl:///cell/x 0');
      await client.receive();

      client.send('SUBSCRIBE bl:///cell/x');
      await client.receive(); // EVENT
      await client.receive(); // STREAM

      client.send('UNSUBSCRIBE s1');
      expect(await client.receive()).toBe('OK');

      client.close();
    });

    it('should return error for unknown stream', async () => {
      const client = await createClient(PORT);

      client.send('UNSUBSCRIBE s999');
      const response = await client.receive();
      expect(response).toBe('ERROR 404 stream not found');

      client.close();
    });
  });

  describe('Errors', () => {
    it('should return error for unknown operation', async () => {
      const client = await createClient(PORT);

      client.send('INVALID bl:///cell/x');
      const response = await client.receive();
      expect(response).toBe('ERROR 400 unknown operation');

      client.close();
    });
  });

  describe('Folds', () => {
    it('should compute fold values', async () => {
      const client = await createClient(PORT);

      client.send('WRITE bl:///cell/a 10');
      await client.receive();

      client.send('WRITE bl:///cell/b 20');
      await client.receive();

      client.send('READ bl:///fold/sum?sources=bl:///cell/a,bl:///cell/b');
      expect(await client.receive()).toBe('OK 30');

      client.close();
    });
  });

  describe('Multiple Clients', () => {
    it('should handle concurrent connections', async () => {
      const client1 = await createClient(PORT);
      const client2 = await createClient(PORT);

      client1.send('WRITE bl:///cell/shared 1');
      await client1.receive();

      client2.send('READ bl:///cell/shared');
      expect(await client2.receive()).toBe('OK 1');

      client2.send('WRITE bl:///cell/shared 2');
      await client2.receive();

      client1.send('READ bl:///cell/shared');
      expect(await client1.receive()).toBe('OK 2');

      client1.close();
      client2.close();
    });
  });

  describe('Server Status', () => {
    it('should report status via read()', () => {
      const status = server.read();
      expect(status.port).toBe(PORT);
      expect(status.running).toBe(true);
    });
  });
});
