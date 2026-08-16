import { useCallback, useEffect, useState } from "react";
import {
  claimAll,
  claimTier,
  getBattlePass,
  levelFromXp,
  rankFor,
  TIERS,
  type BattlePassState,
} from "@/game/battlepass";

export function XpBar({ state }: { state: BattlePassState }) {
  const { level, into, need } = levelFromXp(state.xp);
  return (
    <div className="mx-auto mt-4 w-full max-w-md">
      <div className="flex items-baseline justify-between text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
        <span className="text-primary">{rankFor(level)}</span>
        <span>Lv {level}</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full border border-hud-line bg-hud-panel">
        <div
          className="h-full bg-primary transition-[width] duration-500"
          style={{ width: `${Math.min(100, (into / need) * 100)}%` }}
        />
      </div>
      <div className="mt-1 text-right text-[10px] text-muted-foreground">
        {into} / {need} XP
      </div>
    </div>
  );
}

export function BattlePassPanel({ onChanged }: { onChanged: () => void }) {
  const [state, setState] = useState<BattlePassState>({ xp: 0, claimed: [] });
  const [pop, setPop] = useState<number | null>(null);

  const reload = useCallback(() => setState(getBattlePass()), []);
  useEffect(reload, [reload]);

  const { level, into, need } = levelFromXp(state.xp);
  const pending = TIERS.filter((t) => t.tier <= level && !state.claimed.includes(t.tier));

  const claim = async (tier: number) => {
    if (!(await claimTier(tier))) return;
    setPop(tier);
    window.setTimeout(() => setPop(null), 700);
    reload();
    onChanged();
  };

  return (
    <div className="space-y-5">
      <header className="rounded-lg border border-hud-line bg-hud-panel p-5 text-center">
        <p className="text-[10px] uppercase tracking-[0.45em] text-primary">Operation Itihaas · Battle Pass</p>
        <h2 className="mt-2 font-display text-3xl text-foreground">
          {rankFor(level)} <span className="text-primary">· Level {level}</span>
        </h2>
        <div className="mx-auto mt-4 h-3 w-full max-w-xl overflow-hidden rounded-full border border-hud-line bg-background">
          <div
            className="h-full bg-primary transition-[width] duration-700"
            style={{ width: `${Math.min(100, (into / need) * 100)}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {into} / {need} XP to Level {level + 1} · {state.xp} XP earned in total
        </p>
        <button
          disabled={!pending.length}
          onClick={async () => {
            const n = await claimAll();
            if (n) {
              setPop(-1);
              window.setTimeout(() => setPop(null), 800);
              reload();
              onChanged();
            }
          }}
          className="mt-4 rounded-md bg-primary px-8 py-3 font-display text-base tracking-[0.25em] text-primary-foreground transition active:scale-95 disabled:opacity-35"
        >
          {pending.length ? `CLAIM ${pending.length} REWARD${pending.length > 1 ? "S" : ""}` : "ALL CLAIMED"}
        </button>
        {pop === -1 && <p className="mt-2 text-sm text-primary">Rewards banked, jawan!</p>}
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {TIERS.map((t) => {
          const claimed = state.claimed.includes(t.tier);
          const unlocked = t.tier <= level;
          return (
            <button
              key={t.tier}
              disabled={!unlocked || claimed}
              onClick={() => void claim(t.tier)}
              className={`rounded-lg border p-4 text-left transition active:scale-95 ${
                claimed
                  ? "border-hud-line bg-hud-panel opacity-55"
                  : unlocked
                    ? "border-primary bg-primary/10 hover:bg-primary/20"
                    : "border-hud-line bg-hud-panel opacity-45"
              } ${pop === t.tier ? "ring-2 ring-primary" : ""}`}
            >
              <div className="flex items-baseline justify-between">
                <span className="font-display text-lg text-foreground">Tier {t.tier}</span>
                <span className="text-[10px] uppercase tracking-[0.2em] text-primary">
                  {claimed ? "claimed" : unlocked ? "claim" : `Lv ${t.tier}`}
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{t.reward.label}</p>
            </button>
          );
        })}
      </div>
      <p className="text-center text-xs text-muted-foreground">
        XP comes from kills, cleared waves, score and completed operations — every run pushes the rank ladder from
        Sipahi to Field Marshal.
      </p>
    </div>
  );
}
