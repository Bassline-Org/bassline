import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("editor/:groupId?", "routes/editor.tsx"),
  route("api/editor/actions", "routes/api.editor.actions.tsx"),
  route("editor-v2/:groupId?", "routes/editor-v2.tsx"), // Keep for backward compatibility
  route("api/editor-v2/actions", "routes/api.editor-v2.actions.tsx"), // Keep for backward compatibility
  route("api/bassline/export", "routes/api.bassline.export.ts"),
  route("api/bassline/import", "routes/api.bassline.import.ts"),
  route("bassline-browser", "routes/bassline-browser.tsx"),
  route("demo", "routes/demo.tsx"),
  route("api/demo", "routes/api.demo.tsx"),
  route("worker-test", "routes/worker-test.tsx"),
  route("ws-test", "routes/ws-test.tsx"),
  route("test-sounds", "routes/test-sounds.tsx"),
] satisfies RouteConfig;
