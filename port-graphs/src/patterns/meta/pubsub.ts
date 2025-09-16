import _ from "lodash";
import { createGadget, Gadget } from "../../core";
import { changed, noop } from "../../effects";

type PublisherArgs = {
    topics: string[];
    changed: any;
}
export const publisher = createGadget<PublisherArgs, Record<string, any>>(
    (current, incoming) => {
        const changed = incoming['changed'];
        if (changed) {
            return { action: 'publish', context: { topics: current.topics, data: changed } };
        }
        return null;
    },
    {
        'publish': (gadget, { topics, data }) => {
            gadget.update({ topics, changed: data });
            return { publish: { topics, data } };
        }
    });

type PubSubArgs = {
    publish: {
        topics: string[];
        data: any;
    },
    subscribe: {
        topics: string[];
        source: Gadget;
    }
}

type PubSubState = Record<string, Gadget[]>;

export const pubsub = createGadget<PubSubState, Partial<PubSubArgs>>(
    (_current, incoming) => {
        const { publish, subscribe } = incoming;
        if (publish) {
            const { topics, data } = publish;
            return { action: 'publish', context: { topics, data } };
        }
        if (subscribe) {
            const { topics, source } = subscribe;
            return { action: 'subscribe', context: { topics, source } };
        }
        return null;
    },
    {
        'publish': (gadget, { topics, data }) => {
            const state = gadget.current();
            topics.forEach((topic: string) => {
                state[topic]?.forEach(gadget => {
                    gadget.receive(data);
                });
            })
            return noop();
        },
        'subscribe': (gadget, { topics, source }) => {
            const state = gadget.current();
            topics.forEach((topic: string) => {
                state[topic] = _.union(state[topic] ?? [], [source]);
            })
            gadget.update(state);
            return changed(state);
        }
    }
)