import { type RouteConfig, index, route } from '@react-router/dev/routes'

export default [
  index('routes/home.tsx'),
  route('diagram/:id', 'routes/diagram.$id.tsx', [
    index('routes/diagram.$id._index.tsx'),
    route('spine/:sid', 'routes/diagram.$id.spine.$sid.tsx'),
    route('handle/:hid', 'routes/diagram.$id.handle.$hid.tsx'),
    route('line/:lid', 'routes/diagram.$id.line.$lid.tsx'),
    route('ontology/:oid', 'routes/diagram.$id.ontology.$oid.tsx'),
  ]),
] satisfies RouteConfig
