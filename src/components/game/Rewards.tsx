import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CRATES,
  QUESTS,
  RARITY_LABEL,
  SKINS,
  claimQuest,
  equipSkin,
  getQuests,
  getSkinState,
  openCrate,
  questDone,
  skinById,
  unequipSkin,
  type CrateResult,
  type QuestState,
  type Rarity,
  type Skin,
  type SkinState,
} from "@/game/rewards";
import { SkinPreview } from "./SkinPreview";

const RARITY_RING: Record<Rarity, string> = {
  field: "border-hud-line",
  regiment: "border-sky-500/70",
  veteran: "border-amber-500/80",
  paramvir: "border-fuchsia-500/80",
};

const RARITY_GLOW: Record<Rarity, string> = {
  field: "shadow-[0_0_18px_hsl(0_0%_60%/0.35)]",
  regiment: "shadow-[0_0_22px_hsl(205_90%_55%/0.55)]",
  veteran: "shadow-[0_0_26px_hsl(38_95%_55%/0.6)]",
  paramvir: "shadow-[0_0_34px_hsl(300_90%_60%/0.7)]",
};

const RARITY_BAR: Record<Rarity, string> = {
  field: "bg-muted",
  regiment: "bg-sky-500",
  veteran: "bg-amber-500",
  paramvir: "bg-fuchsia-500",
};

const RARITY_ODDS: Record<Rarity, string> = {
  field: "common",
  regiment: "uncommon",
  veteran: "rare",
  paramvir: "legendary",
};

const REEL_LENGTH = 44;
const WINNER_INDEX = 38;
const ITEM_W = 116; // px, incl. gap

/** CS-style horizontal reel that decelerates onto the won wrap. */
function CrateReel({ pool, result, onDone }: { pool: Skin[]; result: Skin; onDone: () => void }) {
  const [offset, setOffset] = useState(0);
  const [settled, setSettled] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  const reel = useMemo(() => {
    const items: Skin[] = [];
    for (let i = 0; i < REEL_LENGTH; i++) {
      items.push(i === WINNER_INDEX ? result : pool[Math.floor(Math.random() * pool.length)] ?? result);
    }
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result.id]);

  useEffect(() => {
    setSettled(false);
    const width = box.current?.clientWidth ?? 600;
    const jitter = (Math.random() - 0.5) * (ITEM_W * 0.4);
    const target = WINNER_INDEX * ITEM_W - width / 2 + ITEM_W / 2 + jitter;
    setOffset(0);
    const raf = requestAnimationFrame(() => setOffset(target));
    const timer = window.setTimeout(() => {
      setSettled(true);
      onDone();
    }, 4300);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result.id]);

  return (
    <div ref={box} className="relative overflow-hidden rounded-lg border border-hud-line bg-background/80 py-4">
      <div className="pointer-events-none absolute inset-y-0 left-1/2 z-10 w-[3px] -translate-x-1/2 bg-primary shadow-[0_0_16px_hsl(var(--primary))]" />
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-background to-transparent" />
      <div
        className="flex gap-1"
        style={{
          transform: `translateX(${-offset}px)`,
          transition: "transform 4.2s cubic-bezier(0.12, 0.72, 0.02, 1)",
        }}
      >
        {reel.map((s, i) => (
          <div
            key={`${s.id}-${i}`}
            className={`flex h-24 w-[112px] shrink-0 flex-col justify-between rounded border-2 bg-hud-panel p-1.5 ${
              RARITY_RING[s.rarity]
            } ${settled && i === WINNER_INDEX ? `scale-105 ${RARITY_GLOW[s.rarity]}` : ""} transition-transform`}
          >
            <SkinPreview skin={s} className="h-10 w-full" />
            <div className={`h-1 w-full rounded ${RARITY_BAR[s.rarity]}`} />
            <span className="truncate text-[9px] uppercase tracking-[0.15em] text-muted-foreground">{s.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RewardsPanel({ onChanged }: { onChanged: () => void }) {
  const [skins, setSkins] = useState<SkinState>({ owned: [], equipped: {}, keys: 0 });
  const [quests, setQuests] = useState<QuestState>({ week: 0, progress: {}, claimed: [] });
  const [drop, setDrop] = useState<CrateResult | null>(null);
  const [rollingCrate, setRollingCrate] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Skin>(SKINS[0]!);

  const reload = useCallback(() => {
    setSkins(getSkinState());
    setQuests(getQuests());
  }, []);
  useEffect(reload, [reload]);

  const pull = async (crateId: string) => {
    if (busy) return;
    setBusy(true);
    setRevealed(false);
    setDrop(null);
    const result = await openCrate(crateId);
    if (!result) {
      setBusy(false);
      setRollingCrate(null);
      return;
    }
    setRollingCrate(crateId);
    setDrop(result);
    setPreview(result.skin);
    reload();
    onChanged();
  };

  const crate = CRATES.find((c) => c.id === rollingCrate);
  const pool = useMemo(
    () => (crate ? crate.pool.map(skinById).filter((s): s is Skin => !!s) : SKINS),
    [crate],
  );

  return (
    <div className="space-y-5">
      <header className="rounded-lg border border-hud-line bg-hud-panel p-5 text-center">
        <p className="text-[10px] uppercase tracking-[0.45em] text-primary">Quartermaster</p>
        <h2 className="mt-2 font-display text-3xl text-foreground">
          Supply Depot <span className="text-primary">· {skins.keys} keys</span>
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {skins.owned.length} / {SKINS.length} weapon wraps recovered
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-2 text-[10px] uppercase tracking-[0.2em]">
          {(Object.keys(RARITY_LABEL) as Rarity[]).map((r) => (
            <span key={r} className={`flex items-center gap-1.5 rounded border px-2 py-1 ${RARITY_RING[r]}`}>
              <span className={`h-2 w-2 rounded-full ${RARITY_BAR[r]}`} />
              <span className="text-foreground">{RARITY_LABEL[r]}</span>
              <span className="text-muted-foreground">{RARITY_ODDS[r]}</span>
            </span>
          ))}
        </div>
      </header>

      <section>
        <h3 className="mb-2 text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Crates</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {CRATES.map((c) => (
            <button
              key={c.id}
              disabled={busy}
              onClick={() => void pull(c.id)}
              className="rounded-lg border border-primary/60 bg-primary/10 p-4 text-left transition hover:bg-primary/20 active:scale-95 disabled:opacity-50"
            >
              <div className="flex items-baseline justify-between">
                <span className="font-display text-lg text-foreground">{c.name}</span>
                <span className="text-[10px] uppercase tracking-[0.2em] text-primary">
                  {skins.keys > 0 ? "1 key" : `₹${c.price}`}
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{c.desc}</p>
            </button>
          ))}
        </div>

        {drop && crate && (
          <div className="mt-3 space-y-3">
            <CrateReel
              pool={pool}
              result={drop.skin}
              onDone={() => {
                setRevealed(true);
                setBusy(false);
              }}
            />
            {revealed && (
              <div
                className={`animate-scale-in rounded-lg border-2 bg-primary/10 p-4 text-center ${RARITY_RING[drop.skin.rarity]} ${RARITY_GLOW[drop.skin.rarity]}`}
              >
                <SkinPreview skin={drop.skin} className="mx-auto h-16 w-56" />
                <p className="mt-1 font-display text-xl text-foreground">{drop.skin.name}</p>
                <p className="text-xs uppercase tracking-[0.25em] text-primary">{RARITY_LABEL[drop.skin.rarity]}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {drop.duplicate ? `Duplicate — ₹${drop.refund} refunded to your account.` : "Added to your armoury."}
                </p>
                <button
                  onClick={() => void pull(crate.id)}
                  className="mt-3 rounded-md bg-primary px-5 py-2 font-display text-xs tracking-[0.25em] text-primary-foreground transition active:scale-95"
                >
                  ROLL AGAIN
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-hud-line bg-hud-panel p-4">
        <h3 className="mb-3 text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Preview</h3>
        <div className="flex flex-col items-center gap-2">
          <SkinPreview skin={preview} className="h-24 w-full max-w-md" />
          <p className="font-display text-lg text-foreground">{preview.name}</p>
          <p className="text-[10px] uppercase tracking-[0.25em] text-primary">
            {RARITY_LABEL[preview.rarity]} · {preview.weapon.toUpperCase()}
          </p>
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Weapon wraps</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {SKINS.map((s) => {
            const owned = skins.owned.includes(s.id);
            const equipped = skins.equipped[s.weapon] === s.id;
            return (
              <div
                key={s.id}
                className={`rounded-lg border p-4 transition ${RARITY_RING[s.rarity]} ${
                  equipped ? `bg-primary/15 ${RARITY_GLOW[s.rarity]}` : "bg-hud-panel"
                } ${owned ? "" : "opacity-45"}`}
              >
                <button className="w-full text-left" onClick={() => setPreview(s)}>
                  <SkinPreview skin={s} className="h-12 w-full" />
                  <div className="mt-2 flex items-center gap-2">
                    <span
                      className="h-4 w-4 rounded-sm border border-hud-line"
                      style={{ background: `linear-gradient(135deg, ${s.color}, ${s.accent})` }}
                    />
                    <span className="font-display text-base text-foreground">{s.name}</span>
                  </div>
                  <div className={`mt-2 h-1 w-full rounded ${RARITY_BAR[s.rarity]}`} />
                  <p className="mt-1.5 text-[10px] uppercase tracking-[0.2em] text-primary">{RARITY_LABEL[s.rarity]}</p>
                </button>
                <button
                  disabled={!owned}
                  onClick={() => {
                    setSkins(equipped ? unequipSkin(s.weapon) : equipSkin(s.id));
                    onChanged();
                  }}
                  className="mt-2 w-full rounded-md border border-hud-line px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-foreground transition active:scale-95 disabled:opacity-40"
                >
                  {s.weapon.toUpperCase()} · {equipped ? "equipped" : owned ? "equip" : "locked"}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Weekly orders</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {QUESTS.map((q) => {
            const have = Math.min(q.target, quests.progress[q.id] ?? 0);
            const done = questDone(quests, q);
            const claimed = quests.claimed.includes(q.id);
            return (
              <div key={q.id} className="rounded-lg border border-hud-line bg-hud-panel p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm text-foreground">{q.label}</span>
                  <span className="text-[10px] uppercase tracking-[0.2em] text-primary">
                    {q.xp} XP · ₹{q.cash}
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full border border-hud-line bg-background">
                  <div className="h-full bg-primary transition-[width] duration-500" style={{ width: `${(have / q.target) * 100}%` }} />
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {have} / {q.target}
                  </span>
                  <button
                    disabled={!done || claimed}
                    onClick={async () => {
                      if (await claimQuest(q.id)) {
                        reload();
                        onChanged();
                      }
                    }}
                    className="rounded-md bg-primary px-4 py-1.5 font-display text-xs tracking-[0.2em] text-primary-foreground transition active:scale-95 disabled:opacity-35"
                  >
                    {claimed ? "CLAIMED" : "CLAIM"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Orders reset every week. Progress banks automatically as you clear waves and finish operations.
        </p>
      </section>
    </div>
  );
}
