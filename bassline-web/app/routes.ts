import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("simple-editor", "routes/simple-editor.tsx"),
  route("worker-test", "routes/worker-test.tsx"),
  route("demo", "routes/demo.tsx"),
  route("api/demo", "routes/api.demo.tsx"),
  route("editor-v2/:groupId?", "routes/editor-v2.tsx"),
  route("api/editor-v2/actions", "routes/api.editor-v2.actions.tsx"),
  route("api/bassline/export", "routes/api.bassline.export.ts"),
  route("api/bassline/import", "routes/api.bassline.import.ts"),
  route("bassline-browser", "routes/bassline-browser.tsx"),
  route("ws-test", "routes/ws-test.tsx"),
  // route("editor", "routes/editor.tsx") // Disabled - needs refactor
] satisfies RouteConfig;
