import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createBassline } from '../src/setup.js';

describe('RegistryMirror', () => {
  let bl;

  beforeEach(() => {
    bl = createBassline();
  });

  afterEach(() => {
    bl.dispose();
  });

  describe('basic queries', () => {
    it('should list resolvers', () => {
      const resolvers = bl.read('bl:///registry/resolvers');
      expect(resolvers).toContain('/cell');
      expect(resolvers).toContain('/ui');
      expect(resolvers).toContain('/schema');
    });

    it('should list mirrors', () => {
      bl.write('bl:///cell/a', 1);
      bl.write('bl:///cell/b', 2);
      const mirrors = bl.read('bl:///registry/mirrors');
      expect(mirrors).toContain('bl:///cell/a');
      expect(mirrors).toContain('bl:///cell/b');
    });

    it('should exclude registry mirrors from listing', () => {
      const mirrors = bl.read('bl:///registry/mirrors');
      expect(mirrors.some(uri => uri.startsWith('bl:///registry'))).toBe(false);
    });
  });

  describe('query param: type', () => {
    it('should filter by mirror type', () => {
      bl.write('bl:///cell/a', 1);
      bl.write('bl:///cell/b', 2);
      bl.write('bl:///ui/form', { type: 'form' });
      bl.write('bl:///schema/user', { type: 'object' });

      const cells = bl.read('bl:///registry/mirrors?type=cell');
      expect(cells).toContain('bl:///cell/a');
      expect(cells).toContain('bl:///cell/b');
      expect(cells).not.toContain('bl:///ui/form');
      expect(cells).not.toContain('bl:///schema/user');
    });

    it('should filter ui mirrors by type', () => {
      bl.write('bl:///cell/x', 1);
      bl.write('bl:///ui/form', { type: 'form' });
      bl.write('bl:///ui/list', { type: 'list' });

      const uis = bl.read('bl:///registry/mirrors?type=ui');
      expect(uis).toContain('bl:///ui/form');
      expect(uis).toContain('bl:///ui/list');
      expect(uis).not.toContain('bl:///cell/x');
    });

    it('should return empty array for non-existent type', () => {
      bl.write('bl:///cell/a', 1);
      const result = bl.read('bl:///registry/mirrors?type=nonexistent');
      expect(result).toEqual([]);
    });
  });

  describe('query param: pattern', () => {
    it('should filter by URI pattern with wildcard', () => {
      bl.write('bl:///ui/form1', { type: 'form' });
      bl.write('bl:///ui/form2', { type: 'form' });
      bl.write('bl:///ui/list', { type: 'list' });
      bl.write('bl:///cell/x', 1);

      const forms = bl.read('bl:///registry/mirrors?pattern=ui/form*');
      expect(forms).toContain('bl:///ui/form1');
      expect(forms).toContain('bl:///ui/form2');
      expect(forms).not.toContain('bl:///ui/list');
      expect(forms).not.toContain('bl:///cell/x');
    });

    it('should filter all ui paths', () => {
      bl.write('bl:///ui/form', { type: 'form' });
      bl.write('bl:///ui/list', { type: 'list' });
      bl.write('bl:///cell/x', 1);

      const uis = bl.read('bl:///registry/mirrors?pattern=ui/*');
      expect(uis).toHaveLength(2);
      expect(uis.every(u => u.startsWith('bl:///ui/'))).toBe(true);
    });

    it('should support single char wildcard', () => {
      bl.write('bl:///cell/a1', 1);
      bl.write('bl:///cell/a2', 2);
      bl.write('bl:///cell/a12', 12);

      const result = bl.read('bl:///registry/mirrors?pattern=cell/a?');
      expect(result).toContain('bl:///cell/a1');
      expect(result).toContain('bl:///cell/a2');
      expect(result).not.toContain('bl:///cell/a12');
    });
  });

  describe('query param: has', () => {
    it('should filter by property existence', () => {
      bl.write('bl:///ui/form', { type: 'form', data: { $ref: 'bl:///cell/x' } });
      bl.write('bl:///ui/simple', { type: 'form' });

      const withData = bl.read('bl:///registry/mirrors?has=data');
      expect(withData).toContain('bl:///ui/form');
      expect(withData).not.toContain('bl:///ui/simple');
    });

    it('should support nested path', () => {
      bl.write('bl:///ui/form', { type: 'form', data: { $ref: 'bl:///cell/x' } });
      bl.write('bl:///ui/noref', { type: 'form', data: { value: 1 } });

      const withRef = bl.read('bl:///registry/mirrors?has=data.$ref');
      expect(withRef).toContain('bl:///ui/form');
      expect(withRef).not.toContain('bl:///ui/noref');
    });

    it('should exclude non-readable mirrors', () => {
      bl.write('bl:///cell/a', { prop: true });
      // Cell is readable, so it should be included
      const result = bl.read('bl:///registry/mirrors?has=prop');
      expect(result).toContain('bl:///cell/a');
    });

    it('should handle null values', () => {
      bl.write('bl:///cell/a', null);
      const result = bl.read('bl:///registry/mirrors?has=prop');
      expect(result).not.toContain('bl:///cell/a');
    });
  });

  describe('query param: where', () => {
    it('should filter by value content', () => {
      bl.write('bl:///ui/form1', { type: 'form' });
      bl.write('bl:///ui/form2', { type: 'form' });
      bl.write('bl:///ui/list', { type: 'list' });

      const forms = bl.read('bl:///registry/mirrors?where=type:form');
      expect(forms).toContain('bl:///ui/form1');
      expect(forms).toContain('bl:///ui/form2');
      expect(forms).not.toContain('bl:///ui/list');
    });

    it('should filter by nested value', () => {
      bl.write('bl:///compound/doc1', { status: { state: 'active' } });
      bl.write('bl:///compound/doc2', { status: { state: 'draft' } });

      const active = bl.read('bl:///registry/mirrors?where=status.state:active');
      expect(active).toContain('bl:///compound/doc1');
      expect(active).not.toContain('bl:///compound/doc2');
    });

    it('should convert values to strings for comparison', () => {
      bl.write('bl:///cell/a', { count: 42 });
      bl.write('bl:///cell/b', { count: 10 });

      const result = bl.read('bl:///registry/mirrors?where=count:42');
      expect(result).toContain('bl:///cell/a');
      expect(result).not.toContain('bl:///cell/b');
    });
  });

  describe('combined filters', () => {
    it('should combine type and has filters', () => {
      bl.write('bl:///ui/form', { type: 'form', data: { $ref: 'bl:///cell/x' } });
      bl.write('bl:///ui/simple', { type: 'form' });
      bl.write('bl:///cell/x', { data: true });

      const result = bl.read('bl:///registry/mirrors?type=ui&has=data');
      expect(result).toContain('bl:///ui/form');
      expect(result).not.toContain('bl:///ui/simple');
      expect(result).not.toContain('bl:///cell/x');
    });

    it('should combine pattern and where filters', () => {
      bl.write('bl:///ui/form1', { type: 'form', status: 'active' });
      bl.write('bl:///ui/form2', { type: 'form', status: 'draft' });
      bl.write('bl:///ui/list', { type: 'list', status: 'active' });

      const result = bl.read('bl:///registry/mirrors?pattern=ui/form*&where=status:active');
      expect(result).toContain('bl:///ui/form1');
      expect(result).not.toContain('bl:///ui/form2');
      expect(result).not.toContain('bl:///ui/list');
    });

    it('should combine all filters', () => {
      bl.write('bl:///ui/form1', { type: 'form', data: { $ref: 'x' }, status: 'active' });
      bl.write('bl:///ui/form2', { type: 'form', data: { $ref: 'x' }, status: 'draft' });
      bl.write('bl:///ui/form3', { type: 'form', status: 'active' });
      bl.write('bl:///schema/user', { type: 'object' });

      const result = bl.read('bl:///registry/mirrors?type=ui&has=data&where=status:active');
      expect(result).toEqual(['bl:///ui/form1']);
    });
  });

  describe('no filters', () => {
    it('should return all mirrors when no filters specified', () => {
      bl.write('bl:///cell/a', 1);
      bl.write('bl:///ui/form', { type: 'form' });

      const all = bl.read('bl:///registry/mirrors');
      expect(all).toContain('bl:///cell/a');
      expect(all).toContain('bl:///ui/form');
    });
  });
});
