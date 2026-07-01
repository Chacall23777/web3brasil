import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ href: "/web3brasil.html" });
  },
  component: () => null,
});
