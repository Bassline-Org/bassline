/**
 * Query visualization example
 *
 * This demonstrates how to visualize query results, showing only
 * the quads that match a specific pattern.
 */

import { useState, useEffect, useMemo } from 'react';
import { WatchedGraph } from '@bassline/parser/algebra/watch';
import { instrument } from '@bassline/parser/algebra/instrument';
import { pattern, patternQuad, matchGraph } from '@bassline/parser/algebra/pattern';
import { QueryVisualization } from '@bassline/parser-react';
import { quad as q } from '@bassline/parser/algebra/quad';
import { word as w, variable as v, WC } from '@bassline/parser/types';

export function QueryExample() {
    const [graph] = useState(() => new WatchedGraph());
    const [events] = useState(() => instrument(graph));

    // Add initial data
    useEffect(() => {
        // Add people with ages
        graph.add(q(w('alice'), w('age'), 30, w('demo')));
        graph.add(q(w('alice'), w('city'), w('nyc'), w('demo')));
        graph.add(q(w('alice'), w('friend'), w('bob'), w('demo')));

        graph.add(q(w('bob'), w('age'), 25, w('demo')));
        graph.add(q(w('bob'), w('city'), w('sf'), w('demo')));

        graph.add(q(w('carol'), w('age'), 35, w('demo')));
        graph.add(q(w('carol'), w('city'), w('la'), w('demo')));

        // Add more data without age
        graph.add(q(w('dave'), w('city'), w('boston'), w('demo')));
        graph.add(q(w('eve'), w('status'), w('active'), w('demo')));
    }, [graph]);

    // Define pattern: find all people with ages
    const agePattern = useMemo(() =>
        pattern(patternQuad(v('person'), w('age'), v('age'), WC)),
        []
    );

    // Match pattern against graph
    const results = useMemo(() =>
        matchGraph(graph, agePattern),
        [graph, agePattern]
    );

    return (
        <div style={{ width: '100vw', height: '100vh' }}>
            <div style={{
                position: 'absolute',
                top: 10,
                left: 10,
                padding: 10,
                background: 'white',
                borderRadius: 5,
                boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
                zIndex: 1000
            }}>
                <h3 style={{ margin: 0, marginBottom: 5 }}>Query Results</h3>
                <p style={{ margin: 0 }}>Pattern: <code>?person age ?age</code></p>
                <p style={{ margin: 0 }}>Matches: {results.length}</p>
            </div>

            <QueryVisualization
                graph={graph}
                events={events}
                queryResults={results}
            />
        </div>
    );
}

export default QueryExample;
