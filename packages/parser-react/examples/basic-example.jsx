/**
 * Basic example of using @bassline/parser-react
 *
 * This demonstrates real-time graph visualization with React Flow.
 *
 * To run this example:
 * 1. Set up a React app with Vite or Create React App
 * 2. Import this component
 * 3. Render it in a full-viewport container
 */

import { useState, useEffect } from 'react';
import { WatchedGraph } from '@bassline/parser/algebra/watch';
import { instrument } from '@bassline/parser/algebra/instrument';
import { GraphVisualization } from '@bassline/parser-react';
import { quad as q } from '@bassline/parser/algebra/quad';
import { word as w } from '@bassline/parser/types';

export function BasicExample() {
    const [graph] = useState(() => new WatchedGraph());
    const [events] = useState(() => instrument(graph));

    // Add initial data
    useEffect(() => {
        // Add some entities and relationships
        graph.add(q(w('alice'), w('age'), 30, w('demo')));
        graph.add(q(w('alice'), w('city'), w('nyc'), w('demo')));
        graph.add(q(w('alice'), w('friend'), w('bob'), w('demo')));

        graph.add(q(w('bob'), w('age'), 25, w('demo')));
        graph.add(q(w('bob'), w('city'), w('sf'), w('demo')));
        graph.add(q(w('bob'), w('friend'), w('carol'), w('demo')));

        graph.add(q(w('carol'), w('age'), 35, w('demo')));
        graph.add(q(w('carol'), w('city'), w('la'), w('demo')));

        // Add more data over time to demonstrate real-time updates
        const timer = setTimeout(() => {
            graph.add(q(w('alice'), w('status'), w('admin'), w('demo')));
            graph.add(q(w('carol'), w('friend'), w('alice'), w('demo')));
        }, 2000);

        return () => clearTimeout(timer);
    }, [graph]);

    return (
        <div style={{ width: '100vw', height: '100vh' }}>
            <GraphVisualization graph={graph} events={events} />
        </div>
    );
}

export default BasicExample;
