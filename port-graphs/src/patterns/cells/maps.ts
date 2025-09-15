import { createGadget } from "../../core";
import _ from "lodash";
import { changed } from "../../effects";

export const clean = (...objs: Record<string, any>[]) => objs.map(x => _.omitBy(x, _.isNil));

export const firstMap = createGadget<Record<string, any>, Partial<Record<string, any>>>(
  (current, incoming) => {
    // Check if we should ignore
    if (!_.isPlainObject(incoming) || _.isEmpty(incoming) || _.isEqual(incoming, current)) {
      return null;
    }
    // Clean and merge once
    const [cleanedCurrent, cleanedIncoming] = clean(current, incoming);
    const result = { ...cleanedIncoming, ...cleanedCurrent };
    return { action: 'merge', context: { result } };
  },
  {
    'merge': (gadget, { result }) => {
      gadget.update(result);
      return changed(result);
    }
  }
);

export const lastMap = createGadget<Record<string, any>, Partial<Record<string, any>>>(
  (current, incoming) => {
    // Check if we should ignore
    if (!_.isPlainObject(incoming) || _.isEmpty(incoming) || _.isEqual(incoming, current)) {
      return null;
    }
    // Clean and merge once
    const [cleanedCurrent, cleanedIncoming] = clean(current, incoming);
    const result = { ...cleanedCurrent, ...cleanedIncoming };
    return { action: 'merge', context: { result } };
  },
  {
    'merge': (gadget, { result }) => {
      gadget.update(result);
      return changed(result);
    }
  }
);

export const unionMap = createGadget<Record<string, any[]>, Partial<Record<string, any[]>>>(
  (current, incoming) => {
    // Check if we should ignore
    if (!_.isPlainObject(incoming) || _.isEmpty(incoming) || _.isEqual(incoming, current)) {
      return null;
    }
    // Clean and merge once
    const [cleanedCurrent, cleanedIncoming] = clean(current, incoming);
    const result = _.mergeWith(cleanedCurrent, cleanedIncoming, (a: any[], b: any[]) => {
      return _.union(a, b);
    });
    if (!result) {
      return null;
    }
    return { action: 'merge', context: { result } };
  },
  {
    'merge': (gadget, { result }) => {
      gadget.update(result);
      return changed(result);
    }
  }
);