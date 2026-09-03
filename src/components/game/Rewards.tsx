import { useCallback, useEffect, useState } from "react";
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
  unequipSkin,
  type CrateResult,
  type QuestState,
  type Rarity,
  type SkinState,
} from "@/game/rewards";

const RARITY_RING: Record<Rarity, string> = {
  field: "border-hud-line",
  regiment: "border-sky-500/70",
  veteran: "border-amber-500/80",
  paramvir: "border-fuchsia-500/80",
};

export function RewardsPanel({ onChanged }: { onChanged: () => void }) {
  const [skins, setSkins] = useState<SkinState>({ owned: [], equipped: {}, keys: 0 });
  const [quests, setQuests] = useState<QuestState>({ week: 0, progress: {}, claimed: [] });
  const [drop, setDrop] = useState<CrateResult | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(() => {
    setSkins(getSkinState());
    setQuests(getQuests());
  }, []);
  useEffect(reload, [reload]);

  const pull = async (crateId: string) => {
    if (busy) return;
    setBusy(true);
    const result = await openCrate(crateId);
    setBusy(false);
    if (!result) {
      setDrop(null);
      return;
    }
    setDrop(result);
    reload();
    onChanged();
  };

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
        {drop && (
          <div className="mt-3 rounded-lg border border-primary bg-primary/10 p-4 text-center">
            <p className="font-display text-xl text-foreground">{drop.skin.name}</p>
            <p className="text-xs uppercase tracking-[0.25em] text-primary">{RARITY_LABEL[drop.skin.rarity]}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {drop.duplicate ? `Duplicate — ₹${drop.refund} refunded to your account.` : "Added to your armoury."}
            </p>
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Weapon wraps</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {SKINS.map((s) => {
            const owned = skins.owned.includes(s.id);
            const equipped = skins.equipped[s.weapon] === s.id;
            return (
              <button
                key={s.id}
                disabled={!owned}
                onClick={() => {
                  setSkins(equipped ? unequipSkin(s.weapon) : equipSkin(s.id));
                  onChanged();
                }}
                className={`rounded-lg border p-4 text-left transition active:scale-95 ${RARITY_RING[s.rarity]} ${
                  equipped ? "bg-primary/15" : "bg-hud-panel"
                } ${owned ? "hover:bg-primary/10" : "opacity-40"}`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-5 w-5 rounded-sm border border-hud-line"
                    style={{ background: `linear-gradient(135deg, ${s.color}, ${s.accent})` }}
                  />
                  <span className="font-display text-base text-foreground">{s.name}</span>
                </div>
                <p className="mt-2 text-xs uppercase tracking-[0.2em] text-primary">{RARITY_LABEL[s.rarity]}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {s.weapon.toUpperCase()} · {equipped ? "equipped — tap to remove" : owned ? "tap to equip" : "locked"}
                </p>
              </button>
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
