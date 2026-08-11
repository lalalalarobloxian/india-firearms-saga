import { useEffect, useState } from "react";
import type { HudState } from "@/game/engine";
import { WEAPONS } from "@/game/weapons";

function useFlash(at: number, ms: number) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!at) return;
    setOn(true);
    const t = setTimeout(() => setOn(false), ms);
    return () => clearTimeout(t);
  }, [at, ms]);
  return on;
}

export function Hud({ hud }: { hud: HudState }) {
  const hit = useFlash(hud.hitAt, 140);
  const kill = useFlash(hud.killAt, 220);
  const hurt = useFlash(hud.hurtAt, 260);
  const w = WEAPONS[hud.weaponIndex]!;
  const spread = hud.ads ? 3 : 9;

  return (
    <div className="pointer-events-none absolute inset-0 select-none font-hud">
      {/* damage vignette */}
      <div
        className="absolute inset-0 transition-opacity duration-200"
        style={{
          opacity: hurt ? 1 : Math.max(0, (60 - hud.health) / 90),
          background:
            "radial-gradient(circle at center, transparent 42%, color-mix(in oklab, var(--blood) 70%, transparent) 130%)",
        }}
      />

      {/* crosshair */}
      {!hud.dead && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          {hud.ads && w.scoped ? (
            <div className="relative h-[74vh] w-[74vh] rounded-full border-2 border-black/80 shadow-[0_0_0_100vmax_rgba(0,0,0,0.92)]">
              <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-black/70" />
              <div className="absolute top-1/2 left-0 h-px w-full -translate-y-1/2 bg-black/70" />
              <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/80" />
            </div>
          ) : (
            <div className="relative h-10 w-10">
              {[
                ["top-0 left-1/2 -translate-x-1/2 h-2.5 w-[2px]", `translate(-50%, -${spread}px)`],
                ["bottom-0 left-1/2 -translate-x-1/2 h-2.5 w-[2px]", `translate(-50%, ${spread}px)`],
                ["left-0 top-1/2 -translate-y-1/2 w-2.5 h-[2px]", `translate(-${spread}px, -50%)`],
                ["right-0 top-1/2 -translate-y-1/2 w-2.5 h-[2px]", `translate(${spread}px, -50%)`],
              ].map(([cls, tr], i) => (
                <span
                  key={i}
                  className={`absolute bg-crosshair shadow-[0_0_2px_rgba(0,0,0,0.9)] ${cls}`}
                  style={{ transform: tr }}
                />
              ))}
              <span className="absolute left-1/2 top-1/2 h-[2px] w-[2px] -translate-x-1/2 -translate-y-1/2 bg-crosshair" />
              {hit && (
                <span className="absolute inset-0 flex items-center justify-center text-hitmarker">
                  <svg width="26" height="26" viewBox="0 0 26 26">
                    <path d="M4 4l6 6M22 4l-6 6M4 22l6-6M22 22l-6-6" stroke="currentColor" strokeWidth="2.4" />
                  </svg>
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* top bar */}
      <div className="absolute inset-x-0 top-0 flex items-start justify-between p-5">
        <div className="rounded-md border border-hud-line bg-hud-panel px-4 py-2 backdrop-blur-sm">
          <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Wave</div>
          <div className="text-3xl font-bold leading-none text-primary">{hud.wave}</div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="rounded-md border border-hud-line bg-hud-panel px-5 py-1.5 text-center backdrop-blur-sm">
            <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Hostiles </span>
            <span className="text-lg font-bold text-destructive">{hud.enemiesLeft}</span>
          </div>
          {kill && <div className="text-xs uppercase tracking-[0.25em] text-primary">Eliminated</div>}
        </div>
        <div className="rounded-md border border-hud-line bg-hud-panel px-4 py-2 text-right backdrop-blur-sm">
          <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Score</div>
          <div className="text-3xl font-bold leading-none text-foreground">{hud.score}</div>
        </div>
      </div>

      {/* kill feed */}
      <div className="absolute right-5 top-24 flex w-64 flex-col gap-1 text-right">
        {hud.feed.map((f) => (
          <div
            key={f.id}
            className="rounded border border-hud-line bg-hud-panel px-3 py-1 text-xs tracking-wide text-foreground/90"
          >
            {f.head && <span className="mr-1 text-primary">HEADSHOT</span>}
            {f.text}
          </div>
        ))}
      </div>

      {/* wave banner */}
      {hud.waveBanner && (
        <div className="absolute inset-x-0 top-1/4 text-center">
          <div className="font-display text-6xl tracking-[0.2em] text-primary drop-shadow-[0_4px_20px_rgba(0,0,0,0.8)]">
            {hud.waveBanner}
          </div>
          <div className="mt-2 text-xs uppercase tracking-[0.45em] text-muted-foreground">
            Hold the fort
          </div>
        </div>
      )}

      {/* bottom-left vitals */}
      <div className="absolute bottom-6 left-6 w-72">
        <div className="mb-1 flex items-end justify-between">
          <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Vitals</span>
          <span className="text-3xl font-bold leading-none text-foreground">{hud.health}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-hud-line">
          <div
            className="h-full rounded-full bg-vital transition-[width] duration-200"
            style={{ width: `${hud.health}%` }}
          />
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-hud-line">
          <div
            className="h-full rounded-full bg-armor transition-[width] duration-200"
            style={{ width: `${hud.armor}%` }}
          />
        </div>
      </div>

      {/* bottom-right weapon */}
      <div className="absolute bottom-6 right-6 text-right">
        <div className="font-display text-lg tracking-wide text-foreground">{hud.weapon}</div>
        <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          {hud.caliber} · {w.era}
        </div>
        <div className="mt-1 flex items-end justify-end gap-2">
          <span className={`text-5xl font-bold leading-none ${hud.mag === 0 ? "text-destructive" : "text-foreground"}`}>
            {hud.mag}
          </span>
          <span className="pb-1 text-xl text-muted-foreground">/ {hud.reserve}</span>
        </div>
        {hud.reloading && (
          <div className="mt-1 text-xs uppercase tracking-[0.3em] text-primary">Reloading…</div>
        )}
        <div className="mt-3 flex justify-end gap-1">
          {WEAPONS.map((weapon, i) => (
            <span
              key={weapon.id}
              className={`rounded border px-2 py-1 text-[10px] tracking-widest ${
                i === hud.weaponIndex
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-hud-line bg-hud-panel text-muted-foreground"
              }`}
            >
              {i + 1}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}