import { useCallback, useEffect, useRef, useState } from "react";
import { Game, type HudState } from "@/game/engine";
import { MAPS, WEAPONS } from "@/game/weapons";
import { Hud } from "./Hud";

const CONTROLS: [string, string][] = [
  ["W A S D", "Move"],
  ["Shift", "Sprint"],
  ["Ctrl / C", "Crouch"],
  ["Space", "Jump"],
  ["Left click", "Fire"],
  ["Right click", "Aim down sights"],
  ["1 – 5 / wheel", "Switch weapon"],
  ["R", "Reload"],
  ["Esc", "Release mouse"],
];

export default function FpsGame() {
  const mount = useRef<HTMLDivElement>(null);
  const game = useRef<Game | null>(null);
  const [hud, setHud] = useState<HudState | null>(null);
  const [mapId, setMapId] = useState(MAPS[0]!.id);
  const [started, setStarted] = useState(false);
  const [locked, setLocked] = useState(false);

  const onHud = useCallback((s: HudState) => setHud(s), []);

  useEffect(() => {
    if (!started || !mount.current) return;
    const g = new Game(mount.current, mapId, onHud);
    game.current = g;
    g.lock();
    const onLockChange = () => setLocked(document.pointerLockElement === mount.current?.firstChild);
    document.addEventListener("pointerlockchange", onLockChange);
    return () => {
      document.removeEventListener("pointerlockchange", onLockChange);
      g.dispose();
      game.current = null;
    };
  }, [started, mapId, onHud]);

  const map = MAPS.find((m) => m.id === mapId)!;

  return (
    <div className="relative h-[100svh] w-full overflow-hidden bg-background">
      <div ref={mount} className="absolute inset-0" />
      {hud && started && <Hud hud={hud} />}

      {/* pause / click-to-play overlay */}
      {started && !locked && !hud?.dead && (
        <button
          onClick={() => game.current?.lock()}
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/70 backdrop-blur-md"
        >
          <span className="font-display text-4xl tracking-[0.2em] text-primary">PAUSED</span>
          <span className="text-sm uppercase tracking-[0.35em] text-muted-foreground">
            Click to resume the defence
          </span>
        </button>
      )}

      {/* death screen */}
      {started && hud?.dead && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-background/85 backdrop-blur-md">
          <div className="text-center">
            <h2 className="font-display text-5xl tracking-[0.18em] text-destructive">THE FORT HAS FALLEN</h2>
            <p className="mt-3 text-sm uppercase tracking-[0.35em] text-muted-foreground">
              {map.name} · {map.year}
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-x-12 gap-y-3 rounded-lg border border-hud-line bg-hud-panel px-10 py-6 text-center sm:grid-cols-4">
            {[
              ["Waves held", hud.wave - 1],
              ["Eliminations", hud.kills],
              ["Headshots", hud.headshots],
              ["Accuracy", `${hud.accuracy}%`],
            ].map(([k, v]) => (
              <div key={String(k)}>
                <dd className="font-display text-3xl text-primary">{v}</dd>
                <dt className="mt-1 text-[10px] uppercase tracking-[0.3em] text-muted-foreground">{k}</dt>
              </div>
            ))}
          </dl>
          <div className="flex gap-3">
            <button
              onClick={() => {
                game.current?.restart();
                game.current?.lock();
              }}
              className="rounded-md bg-primary px-7 py-3 text-sm font-semibold uppercase tracking-[0.25em] text-primary-foreground transition hover:brightness-110"
            >
              Redeploy
            </button>
            <button
              onClick={() => setStarted(false)}
              className="rounded-md border border-hud-line px-7 py-3 text-sm font-semibold uppercase tracking-[0.25em] text-foreground transition hover:bg-hud-panel"
            >
              Change theatre
            </button>
          </div>
        </div>
      )}

      {/* main menu */}
      {!started && (
        <div className="absolute inset-0 overflow-y-auto bg-menu">
          <div className="mx-auto flex min-h-full max-w-6xl flex-col gap-10 px-6 py-14">
            <header className="text-center">
              <p className="text-[11px] uppercase tracking-[0.55em] text-primary">Operation Itihaas</p>
              <h1 className="mt-3 font-display text-5xl leading-tight tracking-[0.06em] text-foreground sm:text-7xl">
                ASTRA<span className="text-primary">·</span>SHASTRA
              </h1>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                A tactical first-person shooter across four centuries of Indian arms — from Mughal
                matchlocks on sandstone ramparts to the AK-203 rolling out of Korwa. Hold the fort,
                wave after wave.
              </p>
            </header>

            <section>
              <h2 className="mb-3 text-[11px] uppercase tracking-[0.4em] text-muted-foreground">
                Select theatre
              </h2>
              <div className="grid gap-4 md:grid-cols-3">
                {MAPS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setMapId(m.id)}
                    className={`group relative overflow-hidden rounded-lg border p-5 text-left transition ${
                      m.id === mapId
                        ? "border-primary bg-primary/10"
                        : "border-hud-line bg-hud-panel hover:border-primary/50"
                    }`}
                  >
                    <div
                      className="absolute inset-x-0 top-0 h-1"
                      style={{
                        background: `linear-gradient(90deg, #${m.accent.toString(16).padStart(6, "0")}, #${m.stone
                          .toString(16)
                          .padStart(6, "0")})`,
                      }}
                    />
                    <div className="font-display text-xl text-foreground">{m.name}</div>
                    <div className="mt-1 text-[11px] uppercase tracking-[0.3em] text-primary">{m.year}</div>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{m.blurb}</p>
                  </button>
                ))}
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-[11px] uppercase tracking-[0.4em] text-muted-foreground">
                Armoury · five weapons, four centuries
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {WEAPONS.map((w, i) => (
                  <div key={w.id} className="rounded-lg border border-hud-line bg-hud-panel p-4">
                    <div className="flex items-baseline justify-between">
                      <span className="font-display text-base text-foreground">{w.name}</span>
                      <span className="text-[10px] text-muted-foreground">{i + 1}</span>
                    </div>
                    <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-primary">{w.era}</div>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{w.desc}</p>
                    <dl className="mt-3 space-y-1 text-[11px] text-muted-foreground">
                      {[
                        ["Calibre", w.caliber],
                        ["Damage", String(w.damage)],
                        ["RPM", String(w.rpm)],
                        ["Mag", String(w.magSize)],
                      ].map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-2">
                          <dt>{k}</dt>
                          <dd className="text-foreground/80">{v}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ))}
              </div>
            </section>

            <section className="grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
              <div>
                <h2 className="mb-3 text-[11px] uppercase tracking-[0.4em] text-muted-foreground">
                  Controls
                </h2>
                <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-sm sm:grid-cols-3">
                  {CONTROLS.map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between gap-3 border-b border-hud-line pb-1.5">
                      <span className="font-mono text-xs text-primary">{k}</span>
                      <span className="text-muted-foreground">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
              <button
                onClick={() => setStarted(true)}
                className="w-full rounded-md bg-primary px-10 py-5 font-display text-xl tracking-[0.25em] text-primary-foreground transition hover:brightness-110 md:w-auto"
              >
                DEPLOY
              </button>
            </section>

            <p className="pb-4 text-center text-[11px] text-muted-foreground">
              Desktop, mouse + keyboard. Best played fullscreen with sound on.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}