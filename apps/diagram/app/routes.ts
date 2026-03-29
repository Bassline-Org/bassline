import { type RouteConfig, index, route } from '@react-router/dev/routes'

export default [
  index('routes/home.tsx'),

  // Diagram with nested inspection routes
  route('diagram/:id', 'routes/diagram.$id.tsx', [
    index('routes/diagram.$id._index.tsx'),
    route('spine/:sid', 'routes/diagram.$id.spine.$sid.tsx'),
    route('handle/:hid', 'routes/diagram.$id.handle.$hid.tsx'),
    route('line/:lid', 'routes/diagram.$id.line.$lid.tsx'),
    route('ontology/:oid', 'routes/diagram.$id.ontology.$oid.tsx'),
    route('annotation/:aid', 'routes/diagram.$id.annotation.$aid.tsx'),
    route('capability/:cid', 'routes/diagram.$id.capability.$cid.tsx'),
    route('tasks', 'routes/diagram.$id.tasks.tsx'),
  ]),

  // Programmatic graph API
  route('api/graph/spines', 'routes/api.graph.spines.tsx'),
  route('api/graph/spines/:id', 'routes/api.graph.spines.$id.tsx'),
  route('api/graph/handles', 'routes/api.graph.handles.tsx'),
  route('api/graph/handles/:id', 'routes/api.graph.handles.$id.tsx'),
  route('api/graph/lines', 'routes/api.graph.lines.tsx'),
  route('api/graph/lines/:id', 'routes/api.graph.lines.$id.tsx'),
  route('api/graph/annotations', 'routes/api.graph.annotations.tsx'),
  route('api/graph/annotations/:id', 'routes/api.graph.annotations.$id.tsx'),
  route('api/graph/capabilities', 'routes/api.graph.capabilities.tsx'),

  // Task execution API
  route('api/tasks/run', 'routes/api.tasks.run.tsx'),
  route('api/tasks/queue', 'routes/api.tasks.queue.tsx'),
  route('api/tasks/pending', 'routes/api.tasks.pending.tsx'),
  route('api/tasks/failures', 'routes/api.tasks.failures.tsx'),

  // Capability endpoints (invoked by task runner)
  route('api/caps/validate-connection', 'routes/api.caps.validate-connection.tsx'),
] satisfies RouteConfig
