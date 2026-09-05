import { useEffect, useMemo, useState } from "react";
import {
  buyEventItem,
  EVENT_CATALOGUE,
  EVENT_NAME,
  EVENT_TAGLINE,
  eventActive,
  eventTimeLeft,
  formatCountdown,
  getEventState,
  type EventItem,
} from "@/game/event";
import { RARITY_LABEL, skinById } from "@/game/rewards";
import { SkinPreview } from "./SkinPreview";

const KIND_LABEL: Record<EventItem["kind"], string> = {
  map: "Theatre",
  weapon: "Weapon",
  skin: "Wrap",
  key: "Crate keys",
};

export function EventPanel({ onChanged }: { onChanged?: () => void }) {
  const [state, setState] = useState(() => getEventState());
  const [left, setLeft] = useState(() => eventTimeLeft());
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setLeft(eventTimeLeft()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const open = eventActive();
  const owned = useMemo(() => new Set(state.owned), [state.owned]);

  const buy = async (item: EventItem) => {
    const ok = await buyEventItem(item.id);
    setState(getEventState());
    setNote(ok ? `${item.name} unlocked — yours forever.` : "Not enough confetti for that.");
    if (ok) onChanged?.();
  };

  return (
    <section className="space-y-5">
      <header className="rounded-lg border border-primary/50 bg-primary/5 p-5 text-center">
        <p className="text-[11px] uppercase tracking-[0.4em] text-primary">Limited time</p>
        <h2 className="mt-2 font-display text-3xl tracking-[0.08em] text-foreground">{EVENT_NAME}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{EVENT_TAGLINE}</p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-6 text-[11px] uppercase tracking-[0.3em]">
          <span className="text-muted-foreground">
            Buying closes in <span className="font-display text-base text-primary">{formatCountdown(left)}</span>
          </span>
          <span className="text-muted-foreground">
            🎉 <span className="font-display text-base text-accent">{state.confetti}</span> confetti
          </span>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Pick confetti up during runs. Anything bought stays usable after the window shuts.
        </p>
      </header>

      {note && <p className="text-center text-[11px] uppercase tracking-[0.25em] text-primary">{note}</p>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {EVENT_CATALOGUE.map((item) => {
          const skin = item.kind === "skin" ? skinById(item.ref) : undefined;
          const have = owned.has(item.id);
          const afford = state.confetti >= item.price;
          return (
            <article
              key={item.id}
              className={`flex flex-col rounded-lg border bg-hud-panel p-4 ${
                have ? "border-primary/70" : "border-hud-line"
              }`}
            >
              <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                {KIND_LABEL[item.kind]}
                {skin ? ` · ${RARITY_LABEL[skin.rarity]}` : ""}
              </p>
              <h3 className="mt-1 font-display text-lg text-foreground">{item.name}</h3>
              {skin && (
                <div className="mt-3">
                  <SkinPreview skin={skin} />
                </div>
              )}
              <p className="mt-2 flex-1 text-xs leading-relaxed text-muted-foreground">{item.desc}</p>
              <button
                onClick={() => void buy(item)}
                disabled={have || !open || !afford}
                className={`mt-4 rounded-md px-4 py-2 text-[11px] uppercase tracking-[0.25em] ${
                  have
                    ? "border border-primary/60 text-primary"
                    : open && afford
                      ? "bg-primary text-primary-foreground"
                      : "border border-hud-line text-muted-foreground/60"
                }`}
              >
                {have ? "Owned" : !open ? "Window closed" : `🎉 ${item.price}`}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
