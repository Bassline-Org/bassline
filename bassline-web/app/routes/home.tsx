import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Bassline" },
    { name: "description", content: "Propagation networks" },
  ];
}

export default function Home() {
  return (
    <div>
      <h1>Bassline</h1>
    </div>
  );
}