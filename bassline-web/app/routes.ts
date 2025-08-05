import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("simple-editor", "routes/simple-editor.tsx"),
  route("worker-test", "routes/worker-test.tsx"),
  route("demo", "routes/demo.tsx"),
  route("api/demo", "routes/api.demo.tsx"),
  route("editor-v2/:groupId?", "routes/editor-v2.tsx"),
  route("api/editor-v2/actions", "routes/api.editor-v2.actions.tsx"),
  // route("editor", "routes/editor.tsx") // Disabled - needs refactor
] satisfies RouteConfig;
