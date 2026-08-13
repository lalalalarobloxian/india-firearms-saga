import { ROUND_SHOP, type HudState } from "@/game/engine";

export function Hud({ hud, onBuy }: { hud: HudState; onBuy: (id: string) => void }) {
  const bar = (v: number, max: number, cls: string) => (
    <div className="h-1.5 w-32 overflow-hidden rounded bg-hud-line/60">
      <div className={`h-full ${cls}`} style={{ width: `${Math.max(0, Math.min(100, (v / max) * 100))}%` }} />
    </div>
  );

  return (
    <div className="pointer-events-none absolute inset-0 select-none">
      {/* damage vignette */}
      <div
        className="absolute inset-0 transition-opacity"
        style={{ boxShadow: "inset 0 0 140px 40px hsl(0 80% 35% / 0.9)", opacity: hud.lowHealth }}
      />

      {/* crosshair / scope */}
      {hud.scoped ? (
        <div className="absolute inset-0 flex items-center justify-center bg-background">
          <div className="relative h-[86vh] w-[86vh] rounded-full border-2 border-hud-line bg-transparent shadow-[0_0_0_100vmax_hsl(0_0%_0%/0.95)]">
            <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-foreground/70" />
            <div className="absolute top-1/2 left-0 h-px w-full -translate-y-1/2 bg-foreground/70" />
          </div>
        </div>
      ) : (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="relative h-6 w-6">
            <span className="absolute left-1/2 top-0 h-2 w-[2px] -translate-x-1/2 bg-primary" />
            <span className="absolute left-1/2 bottom-0 h-2 w-[2px] -translate-x-1/2 bg-primary" />
            <span className="absolute top-1/2 left-0 h-[2px] w-2 -translate-y-1/2 bg-primary" />
            <span className="absolute top-1/2 right-0 h-[2px] w-2 -translate-y-1/2 bg-primary" />
          </div>
          {hud.hitmark > 0 && (
            <div className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rotate-45">
              <span className="absolute left-1/2 top-0 h-full w-[2px] bg-destructive" />
              <span className="absolute top-1/2 left-0 h-[2px] w-full bg-destructive" />
            </div>
          )}
        </div>
      )}

      {/* top bar */}
      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground md:px-6 md:py-4 md:text-xs md:tracking-[0.28em]">
        <div className="max-w-[35%] rounded border border-hud-line bg-hud-panel px-2 py-1.5 md:max-w-none md:px-4 md:py-2">
          <div className="text-primary">{hud.mission}</div>
          <div className="mt-1 hidden text-[10px] normal-case tracking-normal sm:block">{hud.objective}</div>
        </div>
        <div className="text-center">
          <div className="font-display text-lg tracking-[0.2em] text-foreground md:text-2xl">
            WAVE {hud.wave}
            {hud.waveTotal ? ` / ${hud.waveTotal}` : ""}
          </div>
          <div className="mt-1">{hud.enemies} hostiles · {hud.kills} down</div>
          {hud.buyPhase && <div className="mt-1 text-primary">Buy phase {hud.buyTime}s · press B</div>}
        </div>
        <div className="rounded border border-hud-line bg-hud-panel px-2 py-1.5 text-right md:px-4 md:py-2">
          <div className="font-display text-base text-primary md:text-lg">₹{hud.cash}</div>
          <div className="mt-1 text-[10px]">Score {hud.score}</div>
          {hud.showFps && <div className="text-[10px]">{hud.fps} fps</div>}
        </div>
      </div>

      {/* squad */}
      <div className="absolute left-3 top-1/4 hidden space-y-1 text-[11px] uppercase tracking-[0.2em] sm:block md:left-6 md:top-1/3">
        {hud.teammates.map((t) => (
          <div
            key={t.name + t.character}
            className={`flex items-center gap-2 rounded border border-hud-line bg-hud-panel px-3 py-1 ${
              t.down ? "opacity-40" : ""
            }`}
          >
            <span className={t.self ? "text-primary" : "text-foreground"}>{t.name}</span>
            {bar(t.hp, 100, "bg-primary")}
            <span className="text-muted-foreground">{t.kills}</span>
          </div>
        ))}
      </div>

      {/* kill feed */}
      <div className="absolute right-6 top-24 space-y-1 text-right text-[11px] uppercase tracking-[0.2em]">
        {hud.killfeed.map((k) => (
          <div key={k.id} className={k.head ? "text-primary" : "text-muted-foreground"}>
            {k.text}
            {k.head ? " ⌖" : ""}
          </div>
        ))}
      </div>

      {/* banner */}
      {hud.banner && (
        <div className="absolute inset-x-0 top-1/4 text-center">
          <span className="font-display text-4xl tracking-[0.24em] text-primary drop-shadow">{hud.banner}</span>
        </div>
      )}

      {/* bottom bar */}
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between px-3 pb-48 md:px-6 md:pb-5">
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
            <span>HP</span>
            {bar(hud.hp, 100, "bg-primary")}
            <span className="font-display text-xl text-foreground">{hud.hp}</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
            <span>ARM</span>
            {bar(hud.armor, 100, "bg-accent")}
            <span className="font-display text-xl text-foreground">{hud.armor}</span>
          </div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">{hud.character}</div>
        </div>

        <div className="flex items-end gap-4">
          <div className="hidden space-y-1 text-right text-[10px] uppercase tracking-[0.25em] md:block">
            {hud.slots.map((s, i) => (
              <div key={s.id} className={s.active ? "text-primary" : "text-muted-foreground/70"}>
                {i + 1} · {s.name} {s.grenade ? `×${s.ammo}` : s.melee && s.reserve === 0 ? "" : `${s.ammo}`}
              </div>
            ))}
          </div>
          <div className="text-right whitespace-nowrap">
            <div className="hidden text-[10px] uppercase tracking-[0.3em] text-primary md:block">{hud.weaponEra}</div>
            <div className="font-display text-sm tracking-[0.1em] text-foreground md:text-xl">{hud.weapon}</div>
            <div className="font-display text-2xl text-foreground md:text-4xl">
              {hud.ammo}
              <span className="text-sm text-muted-foreground md:text-lg"> / {hud.reserve}</span>
            </div>
            {hud.reloading && <div className="text-[11px] uppercase tracking-[0.3em] text-primary">Reloading…</div>}
          </div>
        </div>
      </div>

      {/* buy menu */}
      {hud.buyPhase && (
        <BuyMenu hud={hud} onBuy={onBuy} />
      )}
    </div>
  );
}

function BuyMenu({ hud, onBuy }: { hud: HudState; onBuy: (id: string) => void }) {
  return (
    <div
      className="pointer-events-auto absolute inset-x-0 top-20 flex gap-2 overflow-x-auto px-3 pb-1 md:inset-x-auto md:bottom-28 md:left-1/2 md:top-auto md:-translate-x-1/2 md:justify-center md:overflow-visible md:px-0"
      data-buy
    >
      {ROUND_SHOP.map((item) => (
        <button
          key={item.id}
          onClick={() => onBuy(item.id)}
          disabled={hud.cash < item.price}
          className="w-28 shrink-0 rounded border border-hud-line bg-hud-panel px-3 py-2 text-left transition hover:border-primary disabled:opacity-35 md:w-32"
        >
          <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-foreground">{item.label}</div>
          <div className="mt-0.5 text-[10px] text-muted-foreground">{item.detail}</div>
          <div className="mt-1 text-[11px] text-primary">₹{item.price}</div>
        </button>
      ))}
    </div>
  );
}
