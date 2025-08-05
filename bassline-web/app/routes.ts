import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("simple-editor", "routes/simple-editor.tsx"),
  route("worker-test", "routes/worker-test.tsx"),
  route("demo", "routes/demo.tsx"),
  route("api/demo", "routes/api.demo.tsx"),
  // route("editor", "routes/editor.tsx") // Disabled - needs refactor
] satisfies RouteConfig;
