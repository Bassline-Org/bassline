import { describe, it, expect } from 'vitest';
import { basslineGadget, getInstance } from './bassline';
import { withTaps } from '../core/typed';
import { maxCell, lastCell } from '../patterns/cells/typed-cells';
import { sliderGadget } from '../patterns/ui/typed-ui';

describe('Bassline - A gadget that builds relations', () => {
  describe('bassline as a gadget', () => {
    it('should be a proper gadget with input and effects', () => {
      const bassline = withTaps(basslineGadget({
        max: maxCell,
        last: lastCell
      }));

      // Can tap its effects
      const events: any[] = [];
      bassline.tap((effect) => {
        events.push(effect);
      });

      // Define a factory
      bassline.receive({ define: { name: 'slider', factory: sliderGadget } });
      expect(events[events.length - 1]).toEqual({ defined: { name: 'slider' } });

      // Create an instance
      bassline.receive({ create: { id: 'a', type: 'max', args: [10] } });
      expect(events[events.length - 1]).toEqual({ created: { id: 'a', type: 'max' } });

      // Wire gadgets
      bassline.receive({ create: { id: 'b', type: 'last', args: [5] } });
      bassline.receive({ wire: { id: 'link', from: 'a', to: 'b' } });
      expect(events[events.length - 1]).toEqual({ wired: { id: 'link', from: 'a', to: 'b' } });

      // Verify wiring works
      const a = getInstance(bassline, 'a') as any;
      const b = getInstance(bassline, 'b') as any;
      a.receive(20);
      expect(b.current()).toBe(20);
    });

    it('should handle partial information over time', () => {
      const bassline = withTaps(basslineGadget());

      // Can add definitions later
      bassline.receive({ define: { name: 'max', factory: maxCell } });
      bassline.receive({ define: { name: 'last', factory: lastCell } });

      // Create instances
      bassline.receive({ create: { id: 'x', type: 'max', args: [0] } });
      bassline.receive({ create: { id: 'y', type: 'last', args: [0] } });

      // Wire them
      bassline.receive({ wire: { id: 'xy', from: 'x', to: 'y' } });

      // Add more definitions and instances
      bassline.receive({ define: { name: 'slider', factory: sliderGadget } });
      bassline.receive({ create: { id: 'z', type: 'slider', args: [50, 0, 100, 1] } });

      // Wire to existing network
      bassline.receive({ wire: { id: 'zx', from: 'z', to: 'x' } });

      // Test the full network
      const z = getInstance(bassline, 'z') as any;
      const y = getInstance(bassline, 'y') as any;
      z.receive({ set: 75 });
      expect(y.current()).toBe(75);
    });
  });

  describe('wiring patterns', () => {
    it('should support field extraction', () => {
      const bassline = withTaps(basslineGadget({
        last: lastCell,
        max: maxCell
      }));

      bassline.receive({ create: { id: 'a', type: 'last', args: [5] } });
      bassline.receive({ create: { id: 'b', type: 'max', args: [0] } });

      // Wire with field extraction
      bassline.receive({
        wire: {
          id: 'link',
          from: 'a',
          to: 'b',
          field: 'changed'
        }
      });

      const a = getInstance(bassline, 'a') as any;
      const b = getInstance(bassline, 'b') as any;

      a.receive(15);
      expect(b.current()).toBe(15);
    });

    it('should support transform functions', () => {
      const bassline = withTaps(basslineGadget({
        last: lastCell,
        max: maxCell
      }));

      bassline.receive({ create: { id: 'a', type: 'last', args: [10] } });
      bassline.receive({ create: { id: 'b', type: 'max', args: [0] } });

      // Wire with transform
      bassline.receive({
        wire: {
          id: 'link',
          from: 'a',
          to: 'b',
          field: 'changed',
          transform: (x: number) => x * 2
        }
      });

      const a = getInstance(bassline, 'a') as any;
      const b = getInstance(bassline, 'b') as any;

      a.receive(5);
      expect(b.current()).toBe(10); // 5 * 2
    });

    it('should support arbitrary metadata', () => {
      const bassline = withTaps(basslineGadget({
        last: lastCell
      }));

      bassline.receive({ create: { id: 'a', type: 'last', args: [0] } });
      bassline.receive({ create: { id: 'b', type: 'last', args: [0] } });

      // Wire with custom metadata
      bassline.receive({
        wire: {
          id: 'link',
          from: 'a',
          to: 'b',
          priority: 'high',
          author: 'test',
          timestamp: Date.now()
        }
      });

      // Metadata is stored but doesn't affect basic wiring
      const a = getInstance(bassline, 'a') as any;
      const b = getInstance(bassline, 'b') as any;

      a.receive(42);
      expect(b.current()).toBe(42);
    });
  });

  describe('lifecycle operations', () => {
    it('should unwire connections', () => {
      const bassline = withTaps(basslineGadget({
        last: lastCell,
        max: maxCell
      }));

      bassline.receive({ create: { id: 'a', type: 'last', args: [5] } });
      bassline.receive({ create: { id: 'b', type: 'max', args: [0] } });
      bassline.receive({ wire: { id: 'link', from: 'a', to: 'b' } });

      const a = getInstance(bassline, 'a') as any;
      const b = getInstance(bassline, 'b') as any;

      // Verify wiring works
      a.receive(10);
      expect(b.current()).toBe(10);

      // Unwire
      bassline.receive({ unwire: 'link' });

      // Verify wiring no longer works
      a.receive(20);
      expect(b.current()).toBe(10); // Still 10
    });

    it('should destroy instances and clean up edges', () => {
      const bassline = withTaps(basslineGadget({
        last: lastCell,
        max: maxCell
      }));

      const events: any[] = [];
      bassline.tap((effect) => events.push(effect));

      bassline.receive({ create: { id: 'hub', type: 'last', args: [1] } });
      bassline.receive({ create: { id: 'spoke1', type: 'max', args: [0] } });
      bassline.receive({ create: { id: 'spoke2', type: 'max', args: [0] } });

      bassline.receive({ wire: { id: 'edge1', from: 'hub', to: 'spoke1' } });
      bassline.receive({ wire: { id: 'edge2', from: 'hub', to: 'spoke2' } });

      // Destroy hub
      bassline.receive({ destroy: 'hub' });

      expect(events[events.length - 1]).toEqual({ destroyed: { id: 'hub' } });

      // Verify instance is gone
      expect(getInstance(bassline, 'hub')).toBeUndefined();
      expect(getInstance(bassline, 'spoke1')).toBeDefined();
      expect(getInstance(bassline, 'spoke2')).toBeDefined();

      // Try to wire to destroyed instance
      bassline.receive({ wire: { id: 'edge3', from: 'spoke1', to: 'hub' } });
      expect(events[events.length - 1]).toEqual({ notFound: { instance: 'hub' } });
    });

    it('should emit notFound effects for invalid operations', () => {
      const bassline = withTaps(basslineGadget());

      const events: any[] = [];
      bassline.tap((effect) => events.push(effect));

      // Try to create with unknown type
      bassline.receive({ create: { id: 'test', type: 'unknown', args: [] } });
      expect(events[events.length - 1]).toEqual({ notFound: { type: 'unknown' } });

      // Try to wire non-existent gadgets
      bassline.receive({ wire: { id: 'conn', from: 'missing', to: 'alsoMissing' } });
      expect(events[events.length - 1]).toEqual({ notFound: { instance: 'missing' } });

      // Try to destroy non-existent instance
      bassline.receive({ destroy: 'ghost' });
      expect(events[events.length - 1]).toEqual({ notFound: { instance: 'ghost' } });
    });
  });

  describe('bassline composition', () => {
    it('should allow basslines to manage other basslines', () => {
      // Create a meta-bassline
      const metaBassline = withTaps(basslineGadget());

      // Define bassline as a factory
      metaBassline.receive({
        define: {
          name: 'bassline',
          factory: basslineGadget
        }
      });

      // Create two sub-basslines
      metaBassline.receive({ create: { id: 'ui', type: 'bassline', args: [{ slider: sliderGadget }] } });
      metaBassline.receive({ create: { id: 'data', type: 'bassline', args: [{ max: maxCell, last: lastCell }] } });

      // Get the sub-basslines
      const uiBassline = getInstance(metaBassline, 'ui') as any;
      const dataBassline = getInstance(metaBassline, 'data') as any;

      // They should work independently
      uiBassline.receive({ create: { id: 's1', type: 'slider', args: [50, 0, 100, 1] } });
      dataBassline.receive({ create: { id: 'm1', type: 'max', args: [10] } });

      expect(getInstance(uiBassline, 's1')).toBeDefined();
      expect(getInstance(dataBassline, 'm1')).toBeDefined();
    });

    it('should enable meta-coordination patterns', () => {
      const bassline1 = withTaps(basslineGadget({ last: lastCell }));
      const bassline2 = withTaps(basslineGadget({ max: maxCell }));

      // Bassline1 creates instances
      bassline1.receive({ create: { id: 'source', type: 'last', args: [5] } });

      // Bassline2 observes bassline1's creations and mirrors them
      bassline1.tap(({ created }) => {
        if (created) {
          bassline2.receive({
            define: { name: created.type, factory: lastCell }
          });
          bassline2.receive({
            create: {
              id: `mirror-${created.id}`,
              type: created.type,
              args: [0]
            }
          });
        }
      });

      // Create another in bassline1
      bassline1.receive({ create: { id: 'another', type: 'last', args: [10] } });

      // Check bassline2 mirrored it
      expect(getInstance(bassline2, 'mirror-another')).toBeDefined();
    });
  });
});