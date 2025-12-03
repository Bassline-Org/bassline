import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { parse, serialize, Op, read, write, subscribe, info, ok, error, event } from '../src/protocol/text.js';
import { createBassline } from '../src/setup.js';

describe('BL/T Protocol Parser', () => {
  describe('parse', () => {
    it('should parse READ', () => {
      const msg = parse('READ bl:///cell/counter');
      expect(msg.op).toBe('READ');
      expect(msg.ref).toBe('bl:///cell/counter');
    });

    it('should parse WRITE with primitive value', () => {
      const msg = parse('WRITE bl:///cell/counter 42');
      expect(msg.op).toBe('WRITE');
      expect(msg.ref).toBe('bl:///cell/counter');
      expect(msg.value).toBe(42);
    });

    it('should parse WRITE with boolean', () => {
      expect(parse('WRITE bl:///cell/flag true').value).toBe(true);
      expect(parse('WRITE bl:///cell/flag false').value).toBe(false);
    });

    it('should parse WRITE with null', () => {
      expect(parse('WRITE bl:///cell/x null').value).toBe(null);
    });

    it('should parse WRITE with JSON object', () => {
      const msg = parse('WRITE bl:///cell/user {"name":"alice","age":30}');
      expect(msg.value).toEqual({ name: 'alice', age: 30 });
    });

    it('should parse WRITE with JSON array', () => {
      const msg = parse('WRITE bl:///cell/list [1,2,3]');
      expect(msg.value).toEqual([1, 2, 3]);
    });

    it('should parse SUBSCRIBE', () => {
      const msg = parse('SUBSCRIBE bl:///cell/counter');
      expect(msg.op).toBe('SUBSCRIBE');
      expect(msg.ref).toBe('bl:///cell/counter');
    });

    it('should parse UNSUBSCRIBE', () => {
      const msg = parse('UNSUBSCRIBE s1');
      expect(msg.op).toBe('UNSUBSCRIBE');
      expect(msg.stream).toBe('s1');
    });

    it('should parse INFO', () => {
      const msg = parse('INFO bl:///fold/sum');
      expect(msg.op).toBe('INFO');
      expect(msg.ref).toBe('bl:///fold/sum');
    });

    it('should parse VERSION', () => {
      const msg = parse('VERSION BL/1.0 T,B');
      expect(msg.op).toBe('VERSION');
      expect(msg.version).toBe('BL/1.0');
      expect(msg.formats).toEqual(['T', 'B']);
    });

    it('should parse OK without value', () => {
      const msg = parse('OK');
      expect(msg.op).toBe('OK');
      expect(msg.value).toBe(null);
    });

    it('should parse OK with value', () => {
      const msg = parse('OK 42');
      expect(msg.op).toBe('OK');
      expect(msg.value).toBe(42);
    });

    it('should parse OK with JSON value', () => {
      const msg = parse('OK {"status":"success"}');
      expect(msg.value).toEqual({ status: 'success' });
    });

    it('should parse ERROR', () => {
      const msg = parse('ERROR 404 not found');
      expect(msg.op).toBe('ERROR');
      expect(msg.code).toBe('404');
      expect(msg.message).toBe('not found');
    });

    it('should parse EVENT', () => {
      const msg = parse('EVENT s1 43');
      expect(msg.op).toBe('EVENT');
      expect(msg.stream).toBe('s1');
      expect(msg.value).toBe(43);
    });

    it('should parse STREAM', () => {
      const msg = parse('STREAM s1');
      expect(msg.op).toBe('STREAM');
      expect(msg.stream).toBe('s1');
    });

    it('should parse optional tag', () => {
      const msg = parse('READ bl:///cell/counter @req1');
      expect(msg.op).toBe('READ');
      expect(msg.ref).toBe('bl:///cell/counter');
      expect(msg.tag).toBe('req1');
    });

    it('should parse OK with tag', () => {
      const msg = parse('OK 42 @req1');
      expect(msg.value).toBe(42);
      expect(msg.tag).toBe('req1');
    });

    it('should return null for empty lines', () => {
      expect(parse('')).toBe(null);
      expect(parse('   ')).toBe(null);
    });

    it('should return null for comments', () => {
      expect(parse('# this is a comment')).toBe(null);
    });
  });

  describe('serialize', () => {
    it('should serialize READ', () => {
      expect(serialize({ op: 'READ', ref: 'bl:///cell/counter' }))
        .toBe('READ bl:///cell/counter');
    });

    it('should serialize WRITE with primitive', () => {
      expect(serialize({ op: 'WRITE', ref: 'bl:///cell/counter', value: 42 }))
        .toBe('WRITE bl:///cell/counter 42');
    });

    it('should serialize WRITE with object', () => {
      expect(serialize({ op: 'WRITE', ref: 'bl:///cell/x', value: { a: 1 } }))
        .toBe('WRITE bl:///cell/x {"a":1}');
    });

    it('should serialize OK', () => {
      expect(serialize({ op: 'OK', value: 42 })).toBe('OK 42');
      expect(serialize({ op: 'OK' })).toBe('OK');
    });

    it('should serialize ERROR', () => {
      expect(serialize({ op: 'ERROR', code: '404', message: 'not found' }))
        .toBe('ERROR 404 not found');
    });

    it('should serialize EVENT', () => {
      expect(serialize({ op: 'EVENT', stream: 's1', value: 43 }))
        .toBe('EVENT s1 43');
    });

    it('should serialize with tag', () => {
      expect(serialize({ op: 'READ', ref: 'bl:///cell/x', tag: 'req1' }))
        .toBe('READ bl:///cell/x @req1');
    });

    it('should quote strings with spaces', () => {
      expect(serialize({ op: 'OK', value: 'hello world' }))
        .toBe('OK "hello world"');
    });
  });

  describe('round-trip', () => {
    const messages = [
      'READ bl:///cell/counter',
      'WRITE bl:///cell/counter 42',
      'WRITE bl:///cell/data {"name":"alice"}',
      'SUBSCRIBE bl:///cell/counter',
      'UNSUBSCRIBE s1',
      'INFO bl:///fold/sum',
      'OK 42',
      'OK {"status":"success"}',
      'ERROR 404 not found',
      'EVENT s1 100',
      'STREAM s1',
      'READ bl:///cell/x @req1',
      'OK 42 @req1'
    ];

    for (const msg of messages) {
      it(`should round-trip: ${msg}`, () => {
        const parsed = parse(msg);
        const serialized = serialize(parsed);
        expect(serialized).toBe(msg);
      });
    }
  });

  describe('helper functions', () => {
    it('read() creates READ message', () => {
      expect(read('bl:///cell/x', 'req1')).toEqual({
        op: 'READ', ref: 'bl:///cell/x', tag: 'req1'
      });
    });

    it('write() creates WRITE message', () => {
      expect(write('bl:///cell/x', 42)).toEqual({
        op: 'WRITE', ref: 'bl:///cell/x', value: 42, tag: undefined
      });
    });

    it('subscribe() creates SUBSCRIBE message', () => {
      expect(subscribe('bl:///cell/x')).toEqual({
        op: 'SUBSCRIBE', ref: 'bl:///cell/x', tag: undefined
      });
    });

    it('info() creates INFO message', () => {
      expect(info('bl:///fold/sum')).toEqual({
        op: 'INFO', ref: 'bl:///fold/sum', tag: undefined
      });
    });

    it('ok() creates OK message', () => {
      expect(ok(42, 'req1')).toEqual({
        op: 'OK', value: 42, tag: 'req1'
      });
    });

    it('error() creates ERROR message', () => {
      expect(error('404', 'not found')).toEqual({
        op: 'ERROR', code: '404', message: 'not found', tag: undefined
      });
    });

    it('event() creates EVENT message', () => {
      expect(event('s1', 43)).toEqual({
        op: 'EVENT', stream: 's1', value: 43
      });
    });
  });
});

describe('Mirror Ordering', () => {
  let bl;

  beforeEach(() => {
    bl = createBassline();
  });

  afterEach(() => {
    bl.dispose();
  });

  it('cells should have causal ordering', () => {
    const cell = bl.resolve('bl:///cell/test');
    expect(cell.ordering).toBe('causal');
  });

  it('folds should have none ordering (order-independent)', () => {
    const fold = bl.resolve('bl:///fold/sum');
    expect(fold.ordering).toBe('none');
  });

  it('all fold types should have none ordering', () => {
    const foldTypes = ['sum', 'max', 'min', 'avg', 'count', 'first', 'last', 'concat', 'list'];
    for (const type of foldTypes) {
      const fold = bl.resolve(`bl:///fold/${type}`);
      expect(fold.ordering).toBe('none');
    }
  });
});

describe('INFO HTTP Endpoint', () => {
  let bl;
  let server;
  const PORT = 9880;

  beforeEach(() => {
    bl = createBassline();
    bl.write('bl:///cell/counter', 0);
    server = bl.resolve(`bl:///server/http?port=${PORT}`);
    server.write({ action: 'start' });
  });

  afterEach(() => {
    server.dispose();
    bl.dispose();
  });

  it('should return cell capabilities', async () => {
    const res = await fetch(`http://localhost:${PORT}/bl/info/cell/counter`);
    const info = await res.json();

    expect(info.readable).toBe(true);
    expect(info.writable).toBe(true);
    expect(info.ordering).toBe('causal');
  });

  it('should return fold capabilities', async () => {
    const res = await fetch(`http://localhost:${PORT}/bl/info/fold/sum`);
    const info = await res.json();

    expect(info.readable).toBe(true);
    expect(info.writable).toBe(false);
    expect(info.ordering).toBe('none');
  });
});
