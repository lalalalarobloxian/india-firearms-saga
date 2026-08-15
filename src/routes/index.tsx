import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const FpsGame = lazy(() => import("@/components/game/FpsGame"));

const title = "Astra·Shastra — FPS Shooter Through Indian Military History";
const description =
  "A CS2-style first-person shooter set across Indian history: fight with Mughal matchlocks, Lee–Enfield rifles, INSAS and the AK-203 across fort ramparts and glacier outposts.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://india-firearms-saga.lovable.app/" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://india-firearms-saga.lovable.app/" }],
  }),
  component: Index,
});

function Loading() {
  return (
    <div className="flex h-[100svh] items-center justify-center bg-background">
      <span className="font-display text-lg tracking-[0.4em] text-primary">LOADING ARMOURY…</span>
    </div>
  );
}

function Index() {
  return (
    <main>
      <h1 className="sr-only">Astra·Shastra — first-person shooter through the history of Indian arms</h1>
      <ClientOnly fallback={<Loading />}>
        <Suspense fallback={<Loading />}>
          <FpsGame />
        </Suspense>
      </ClientOnly>
    </main>
  );
}
