import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createBassline } from '../src/setup.js';

describe('HTTPServerMirror', () => {
  let bl;
  let server;
  const PORT = 9876;

  beforeEach(() => {
    bl = createBassline();
  });

  afterEach(() => {
    if (server) {
      server.dispose();
    }
    bl.dispose();
  });

  it('should start and stop server', () => {
    server = bl.resolve(`bl:///server/http?port=${PORT}`);
    expect(server.read().running).toBe(false);

    server.write({ action: 'start' });
    expect(server.read().running).toBe(true);

    server.write({ action: 'stop' });
    expect(server.read().running).toBe(false);
  });

  it('should handle GET requests for cells', async () => {
    bl.write('bl:///cell/test', 42);

    server = bl.resolve(`bl:///server/http?port=${PORT}`);
    server.write({ action: 'start' });

    const res = await fetch(`http://localhost:${PORT}/bl/cell/test`);
    expect(res.ok).toBe(true);

    const text = await res.text();
    expect(text).toBe('42');
  });

  it('should handle PUT requests for cells', async () => {
    server = bl.resolve(`bl:///server/http?port=${PORT}`);
    server.write({ action: 'start' });

    const res = await fetch(`http://localhost:${PORT}/bl/cell/counter`, {
      method: 'PUT',
      body: '99'
    });
    expect(res.ok).toBe(true);
    expect(await res.text()).toBe('ok');

    expect(bl.read('bl:///cell/counter')).toBe(99);
  });

  it('should return JSON for objects', async () => {
    bl.write('bl:///cell/user', { name: 'alice', age: 30 });

    server = bl.resolve(`bl:///server/http?port=${PORT}`);
    server.write({ action: 'start' });

    const res = await fetch(`http://localhost:${PORT}/bl/cell/user`);
    expect(res.headers.get('content-type')).toContain('application/json');

    const data = await res.json();
    expect(data).toEqual({ name: 'alice', age: 30 });
  });

  it('should respect Accept: application/json header', async () => {
    bl.write('bl:///cell/num', 42);

    server = bl.resolve(`bl:///server/http?port=${PORT}`);
    server.write({ action: 'start' });

    const res = await fetch(`http://localhost:${PORT}/bl/cell/num`, {
      headers: { 'Accept': 'application/json' }
    });

    const data = await res.json();
    expect(data).toEqual({ value: 42 });
  });

  it('should handle JSON body in PUT', async () => {
    server = bl.resolve(`bl:///server/http?port=${PORT}`);
    server.write({ action: 'start' });

    const res = await fetch(`http://localhost:${PORT}/bl/cell/data`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ foo: 'bar' })
    });
    expect(res.ok).toBe(true);

    expect(bl.read('bl:///cell/data')).toEqual({ foo: 'bar' });
  });

  it('should handle boolean values', async () => {
    server = bl.resolve(`bl:///server/http?port=${PORT}`);
    server.write({ action: 'start' });

    await fetch(`http://localhost:${PORT}/bl/cell/flag`, {
      method: 'PUT',
      body: 'true'
    });

    expect(bl.read('bl:///cell/flag')).toBe(true);
  });

  it('should return 404 for non-/bl/ paths', async () => {
    server = bl.resolve(`bl:///server/http?port=${PORT}`);
    server.write({ action: 'start' });

    const res = await fetch(`http://localhost:${PORT}/other/path`);
    expect(res.status).toBe(404);
  });

  it('should handle CORS preflight', async () => {
    server = bl.resolve(`bl:///server/http?port=${PORT}`);
    server.write({ action: 'start' });

    const res = await fetch(`http://localhost:${PORT}/bl/cell/test`, {
      method: 'OPTIONS'
    });
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });
});

describe('HTTPServerMirror Auth', () => {
  let bl;
  let server;
  const PORT = 9877;

  beforeEach(() => {
    bl = createBassline();
  });

  afterEach(() => {
    if (server) {
      server.dispose();
    }
    bl.dispose();
  });

  it('should reject requests without token when auth enabled', async () => {
    bl.write('bl:///cell/_auth/tokens', ['secret-123']);
    bl.write('bl:///cell/data', 42);

    server = bl.resolve(`bl:///server/http?port=${PORT}&auth=true`);
    server.write({ action: 'start' });

    const res = await fetch(`http://localhost:${PORT}/bl/cell/data`);
    expect(res.status).toBe(401);
  });

  it('should accept requests with valid token', async () => {
    bl.write('bl:///cell/_auth/tokens', ['secret-123', 'other-token']);
    bl.write('bl:///cell/data', 42);

    server = bl.resolve(`bl:///server/http?port=${PORT}&auth=true`);
    server.write({ action: 'start' });

    const res = await fetch(`http://localhost:${PORT}/bl/cell/data`, {
      headers: { 'Authorization': 'Bearer secret-123' }
    });
    expect(res.ok).toBe(true);
    expect(await res.text()).toBe('42');
  });

  it('should reject requests with invalid token', async () => {
    bl.write('bl:///cell/_auth/tokens', ['secret-123']);
    bl.write('bl:///cell/data', 42);

    server = bl.resolve(`bl:///server/http?port=${PORT}&auth=true`);
    server.write({ action: 'start' });

    const res = await fetch(`http://localhost:${PORT}/bl/cell/data`, {
      headers: { 'Authorization': 'Bearer wrong-token' }
    });
    expect(res.status).toBe(401);
  });
});

describe('HTTPClientMirror', () => {
  let serverBl;
  let clientBl;
  let server;
  const PORT = 9878;

  beforeEach(() => {
    serverBl = createBassline();
    clientBl = createBassline();

    serverBl.write('bl:///cell/counter', 42);
    server = serverBl.resolve(`bl:///server/http?port=${PORT}`);
    server.write({ action: 'start' });
  });

  afterEach(() => {
    if (server) {
      server.dispose();
    }
    serverBl.dispose();
    clientBl.dispose();
  });

  it('should read from remote via HTTP', async () => {
    const client = clientBl.resolve(`bl:///http?url=http://localhost:${PORT}/bl/cell/counter`);
    const value = await client.readAsync();
    expect(value).toBe(42);
  });

  it('should write to remote via HTTP', async () => {
    const client = clientBl.resolve(`bl:///http?url=http://localhost:${PORT}/bl/cell/counter`);
    await client.writeAsync(100);

    expect(serverBl.read('bl:///cell/counter')).toBe(100);
  });

  it('should handle objects', async () => {
    serverBl.write('bl:///cell/user', { name: 'alice' });

    const client = clientBl.resolve(`bl:///http?url=http://localhost:${PORT}/bl/cell/user`);
    const value = await client.readAsync();
    expect(value).toEqual({ name: 'alice' });
  });

  it('should work with auth token', async () => {
    serverBl.write('bl:///cell/_auth/tokens', ['my-secret']);
    serverBl.write('bl:///cell/secure', 'secret-data');

    server.dispose();
    server = serverBl.resolve(`bl:///server/http?port=${PORT}&auth=true`);
    server.write({ action: 'start' });

    const client = clientBl.resolve(`bl:///http?url=http://localhost:${PORT}/bl/cell/secure&token=my-secret`);
    const value = await client.readAsync();
    expect(value).toBe('secret-data');
  });
});

describe('Folds over HTTP', () => {
  let bl;
  let server;
  const PORT = 9879;

  beforeEach(() => {
    bl = createBassline();
    bl.write('bl:///cell/a', 10);
    bl.write('bl:///cell/b', 20);
    server = bl.resolve(`bl:///server/http?port=${PORT}`);
    server.write({ action: 'start' });
  });

  afterEach(() => {
    if (server) {
      server.dispose();
    }
    bl.dispose();
  });

  it('should read fold results via HTTP', async () => {
    const sources = encodeURIComponent('bl:///cell/a,bl:///cell/b');
    const res = await fetch(`http://localhost:${PORT}/bl/fold/sum?sources=${sources}`);
    expect(await res.text()).toBe('30');
  });
});
