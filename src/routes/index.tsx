import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/")({
  component: IndexRedirect,
});

function IndexRedirect() {
  useEffect(() => {
    window.location.replace("/web3brasil.html");
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 text-center text-foreground">
      <a className="text-sm font-medium underline" href="/web3brasil.html">
        Abrir WEB3BRASIL
      </a>
    </main>
  );
}
