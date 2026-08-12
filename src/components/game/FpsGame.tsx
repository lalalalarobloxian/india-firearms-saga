import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Game, type GameOptions, type HudState } from "@/game/engine";
import { ALL_WEAPONS, CHARACTERS, MAPS, STARTER_CHARACTER_IDS, STARTER_MAP_IDS, STARTER_WEAPON_IDS } from "@/game/config";
import { MISSIONS } from "@/game/missions";
import { DEFAULT_SETTINGS, getProfile, getUnlocked, purchaseItem, saveSettings, type GameSettings } from "@/game/economy";
import { Multiplayer, randomRoomCode, type LobbyMember } from "@/game/multiplayer";
import { Hud } from "./Hud";

const CONTROLS: [string, string][] = [
  ["W A S D", "Move"],
  ["Shift", "Sprint"],
  ["Ctrl / C", "Crouch"],
  ["Space", "Jump"],
  ["Left click", "Fire / throw"],
  ["Right click", "Aim down sights"],
  ["1 – 9 / wheel", "Switch weapon"],
  ["V / G", "Melee / grenade"],
  ["R", "Reload"],
  ["B", "Buy menu (between waves)"],
  ["Esc", "Release mouse"],
];

type Tab = "deploy" | "armoury" | "squad" | "settings";

export default function FpsGame() {
  const mount = useRef<HTMLDivElement>(null);
  const game = useRef<Game | null>(null);
  const net = useRef<Multiplayer | null>(null);
  const [hud, setHud] = useState<HudState | null>(null);
  const [tab, setTab] = useState<Tab>("deploy");
  const [mapId, setMapId] = useState(MAPS[0]!.id);
  const [characterId, setCharacterId] = useState(CHARACTERS[0]!.id);
  const [loadout, setLoadout] = useState<string[]>(["insas", "katta", "grenade36"]);
  const [mode, setMode] = useState<"survival" | "mission">("survival");
  const [missionId, setMissionId] = useState(MISSIONS[0]!.id);
  const [started, setStarted] = useState(false);
  const [locked, setLocked] = useState(false);
  const [currency, setCurrency] = useState(0);
  const [unlocked, setUnlocked] = useState({ weapon: STARTER_WEAPON_IDS, character: STARTER_CHARACTER_IDS, map: STARTER_MAP_IDS });
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const [name, setName] = useState("Jawan");
  const [room, setRoom] = useState(randomRoomCode());
  const [lobby, setLobby] = useState<LobbyMember[]>([]);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);

  const onHud = useCallback((s: HudState) => setHud(s), []);

  const refresh = useCallback(async () => {
    const [profile, unlocks] = await Promise.all([getProfile(), getUnlocked()]);
    setCurrency(profile.currency);
    setSettings({ ...DEFAULT_SETTINGS, ...profile.settings });
    setUnlocked({
      weapon: [...new Set([...STARTER_WEAPON_IDS, ...unlocks.weapon])],
      character: [...new Set([...STARTER_CHARACTER_IDS, ...unlocks.character])],
      map: [...new Set([...STARTER_MAP_IDS, ...unlocks.map])],
    });
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!started || !mount.current) return;
    const opts: GameOptions = {
      mapId: mode === "mission" ? (MISSIONS.find((m) => m.id === missionId)?.mapId ?? mapId) : mapId,
      characterId,
      loadout,
      settings,
      mode,
      missionId,
      net: net.current,
      playerName: name,
    };
    const g = new Game(mount.current, opts, onHud);
    game.current = g;
    if (net.current) net.current["opts"].onEvent = (e) => g.handleNetEvent(e);
    g.lock();
    const onLockChange = () => setLocked(document.pointerLockElement !== null);
    document.addEventListener("pointerlockchange", onLockChange);
    return () => {
      document.removeEventListener("pointerlockchange", onLockChange);
      g.dispose();
      game.current = null;
      void refresh();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started]);

  const map = useMemo(
    () => MAPS.find((m) => m.id === (mode === "mission" ? MISSIONS.find((x) => x.id === missionId)?.mapId : mapId)) ?? MAPS[0]!,
    [mapId, mode, missionId],
  );

  const toggleWeapon = (id: string) => {
    setLoadout((cur) =>
      cur.includes(id) ? cur.filter((w) => w !== id) : cur.length >= 5 ? cur : [...cur, id],
    );
  };

  const buy = async (type: "weapon" | "character" | "map", id: string, price: number) => {
    setBusy(true);
    const ok = await purchaseItem(type, id, price);
    if (ok) await refresh();
    setBusy(false);
  };

  const joinRoom = async () => {
    if (net.current) await net.current.leave();
    const mp = new Multiplayer({
      room,
      name,
      character: characterId,
      mapId,
      onLobby: setLobby,
      onStart: () => setStarted(true),
    });
    net.current = mp;
    await mp.join();
    setConnected(true);
  };

  const leaveRoom = async () => {
    await net.current?.leave();
    net.current = null;
    setConnected(false);
    setLobby([]);
  };

  useEffect(() => () => void net.current?.leave(), []);

  return (
    <div className="relative h-[100svh] w-full overflow-hidden bg-background">
      <div ref={mount} className="absolute inset-0" />
      {hud && started && <Hud hud={hud} onBuy={(id) => game.current?.buy(id)} />}

      {started && !locked && !hud?.dead && !hud?.won && (
        <button
          onClick={() => game.current?.lock()}
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/70 backdrop-blur-md"
        >
          <span className="font-display text-4xl tracking-[0.2em] text-primary">PAUSED</span>
          <span className="text-sm uppercase tracking-[0.35em] text-muted-foreground">Click to resume</span>
        </button>
      )}

      {started && (hud?.dead || hud?.won) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-background/85 backdrop-blur-md">
          <h2 className={`font-display text-5xl tracking-[0.18em] ${hud.won ? "text-primary" : "text-destructive"}`}>
            {hud.won ? "OBJECTIVE SECURED" : "THE FORT HAS FALLEN"}
          </h2>
          <p className="text-sm uppercase tracking-[0.35em] text-muted-foreground">
            {map.name} · {map.year}
          </p>
          <dl className="grid grid-cols-2 gap-x-12 gap-y-3 rounded-lg border border-hud-line bg-hud-panel px-10 py-6 text-center sm:grid-cols-5">
            {[
              ["Waves", hud.wave - 1],
              ["Kills", hud.kills],
              ["Headshots", hud.headshots],
              ["Accuracy", `${hud.accuracy}%`],
              ["Earned", `₹${hud.earned}`],
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
              className="rounded-md bg-primary px-7 py-3 text-sm font-semibold uppercase tracking-[0.25em] text-primary-foreground"
            >
              Redeploy
            </button>
            <button
              onClick={() => setStarted(false)}
              className="rounded-md border border-hud-line px-7 py-3 text-sm font-semibold uppercase tracking-[0.25em] text-foreground"
            >
              Base camp
            </button>
          </div>
        </div>
      )}

      {!started && (
        <div className="absolute inset-0 overflow-y-auto bg-menu">
          <div className="mx-auto flex min-h-full max-w-6xl flex-col gap-8 px-6 py-12">
            <header className="text-center">
              <p className="text-[11px] uppercase tracking-[0.55em] text-primary">Operation Itihaas</p>
              <h1 className="mt-3 font-display text-5xl leading-tight tracking-[0.06em] text-foreground sm:text-7xl">
                ASTRA<span className="text-primary">·</span>SHASTRA
              </h1>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                Tactical FPS across four centuries of Indian arms — matchlocks to the AK-203. Fight solo or
                co-op through real operations, spend your round economy, unlock fighters and theatres.
              </p>
              <p className="mt-4 font-display text-xl text-primary">₹{currency} banked</p>
            </header>

            <nav className="flex flex-wrap justify-center gap-2">
              {(["deploy", "armoury", "squad", "settings"] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`rounded-md border px-5 py-2 text-[11px] uppercase tracking-[0.3em] ${
                    tab === t ? "border-primary bg-primary/10 text-primary" : "border-hud-line text-muted-foreground"
                  }`}
                >
                  {t}
                </button>
              ))}
            </nav>

            {tab === "deploy" && (
              <>
                <div className="flex justify-center gap-2">
                  {(["survival", "mission"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      className={`rounded border px-4 py-2 text-[11px] uppercase tracking-[0.25em] ${
                        mode === m ? "border-primary text-primary" : "border-hud-line text-muted-foreground"
                      }`}
                    >
                      {m === "survival" ? "Endless defence" : "War operations"}
                    </button>
                  ))}
                </div>

                {mode === "mission" ? (
                  <div className="grid gap-4 md:grid-cols-3">
                    {MISSIONS.map((ms) => {
                      const locked = !unlocked.map.includes(ms.mapId);
                      return (
                        <button
                          key={ms.id}
                          disabled={locked}
                          onClick={() => setMissionId(ms.id)}
                          className={`rounded-lg border p-5 text-left transition disabled:opacity-40 ${
                            missionId === ms.id ? "border-primary bg-primary/10" : "border-hud-line bg-hud-panel"
                          }`}
                        >
                          <div className="font-display text-lg text-foreground">{ms.name}</div>
                          <div className="mt-1 text-[11px] uppercase tracking-[0.3em] text-primary">{ms.year}</div>
                          <p className="mt-2 text-sm text-muted-foreground">{ms.brief}</p>
                          <p className="mt-2 text-[11px] text-muted-foreground">
                            {ms.waves} waves · reward ₹{ms.reward}
                            {locked ? " · map locked" : ""}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-4">
                    {MAPS.map((m) => {
                      const own = unlocked.map.includes(m.id);
                      return (
                        <button
                          key={m.id}
                          onClick={() => (own ? setMapId(m.id) : void buy("map", m.id, m.price))}
                          disabled={busy}
                          className={`rounded-lg border p-4 text-left transition ${
                            m.id === mapId && own ? "border-primary bg-primary/10" : "border-hud-line bg-hud-panel"
                          }`}
                        >
                          <div className="font-display text-base text-foreground">{m.name}</div>
                          <div className="mt-1 text-[10px] uppercase tracking-[0.3em] text-primary">{m.year}</div>
                          <p className="mt-2 text-xs text-muted-foreground">{m.blurb}</p>
                          {!own && <p className="mt-2 text-[11px] text-primary">Unlock ₹{m.price}</p>}
                        </button>
                      );
                    })}
                  </div>
                )}

                <section className="grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
                  <div>
                    <h2 className="mb-3 text-[11px] uppercase tracking-[0.4em] text-muted-foreground">Controls</h2>
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
                    onClick={() => {
                      if (net.current) net.current.startMatch(mapId, missionId);
                      else setStarted(true);
                    }}
                    className="w-full rounded-md bg-primary px-10 py-5 font-display text-xl tracking-[0.25em] text-primary-foreground md:w-auto"
                  >
                    DEPLOY
                  </button>
                </section>
              </>
            )}

            {tab === "armoury" && (
              <>
                <h2 className="text-[11px] uppercase tracking-[0.4em] text-muted-foreground">
                  Loadout · tap to equip (max 5)
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {ALL_WEAPONS.map((w) => {
                    const own = unlocked.weapon.includes(w.id);
                    const equipped = loadout.includes(w.id);
                    return (
                      <button
                        key={w.id}
                        disabled={busy}
                        onClick={() => (own ? toggleWeapon(w.id) : void buy("weapon", w.id, w.price))}
                        className={`rounded-lg border p-4 text-left transition ${
                          equipped ? "border-primary bg-primary/10" : "border-hud-line bg-hud-panel"
                        } ${own ? "" : "opacity-70"}`}
                      >
                        <div className="flex items-baseline justify-between">
                          <span className="font-display text-base text-foreground">{w.name}</span>
                          <span className="text-[10px] uppercase text-primary">{w.category}</span>
                        </div>
                        <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-primary">{w.era}</div>
                        <p className="mt-2 text-xs text-muted-foreground">{w.desc}</p>
                        <div className="mt-2 text-[11px] text-muted-foreground">
                          DMG {w.damage} · RPM {w.rpm} · MAG {w.magSize}
                        </div>
                        {!own && <div className="mt-1 text-[11px] text-primary">Unlock ₹{w.price}</div>}
                      </button>
                    );
                  })}
                </div>

                <h2 className="mt-4 text-[11px] uppercase tracking-[0.4em] text-muted-foreground">Fighters</h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {CHARACTERS.map((c) => {
                    const own = unlocked.character.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        disabled={busy}
                        onClick={() => (own ? setCharacterId(c.id) : void buy("character", c.id, c.price))}
                        className={`rounded-lg border p-4 text-left transition ${
                          characterId === c.id && own ? "border-primary bg-primary/10" : "border-hud-line bg-hud-panel"
                        }`}
                      >
                        <div className="font-display text-base text-foreground">{c.name}</div>
                        <div className="mt-1 text-[10px] uppercase tracking-[0.25em] text-primary">{c.title}</div>
                        <p className="mt-2 text-xs text-muted-foreground">{c.era} — {c.desc}</p>
                        {!own && <div className="mt-1 text-[11px] text-primary">Unlock ₹{c.price}</div>}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {tab === "squad" && (
              <div className="mx-auto w-full max-w-xl space-y-4">
                <h2 className="text-[11px] uppercase tracking-[0.4em] text-muted-foreground">Co-op war room</h2>
                <label className="block text-xs uppercase tracking-[0.25em] text-muted-foreground">
                  Callsign
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value.slice(0, 14))}
                    className="mt-1 w-full rounded border border-hud-line bg-hud-panel px-3 py-2 text-base normal-case tracking-normal text-foreground"
                  />
                </label>
                <label className="block text-xs uppercase tracking-[0.25em] text-muted-foreground">
                  Room code
                  <input
                    value={room}
                    onChange={(e) => setRoom(e.target.value.toUpperCase().slice(0, 6))}
                    className="mt-1 w-full rounded border border-hud-line bg-hud-panel px-3 py-2 font-mono text-lg tracking-[0.3em] text-foreground"
                  />
                </label>
                <div className="flex gap-3">
                  <button
                    onClick={() => void (connected ? leaveRoom() : joinRoom())}
                    className="flex-1 rounded-md bg-primary px-6 py-3 text-sm uppercase tracking-[0.25em] text-primary-foreground"
                  >
                    {connected ? "Leave room" : "Join room"}
                  </button>
                  <button
                    onClick={() => setRoom(randomRoomCode())}
                    className="rounded-md border border-hud-line px-6 py-3 text-sm uppercase tracking-[0.25em] text-foreground"
                  >
                    New code
                  </button>
                </div>
                <div className="rounded-lg border border-hud-line bg-hud-panel p-4">
                  <div className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
                    {connected ? `In room ${room}` : "Not connected"}
                  </div>
                  <ul className="mt-3 space-y-1 text-sm text-foreground">
                    {lobby.map((m) => (
                      <li key={m.id} className="flex justify-between">
                        <span>
                          {m.name} {m.host ? "· host" : ""}
                        </span>
                        <span className="text-muted-foreground">
                          {CHARACTERS.find((c) => c.id === m.character)?.name ?? m.character}
                        </span>
                      </li>
                    ))}
                    {!lobby.length && <li className="text-muted-foreground">Share the code with your squad.</li>}
                  </ul>
                </div>
                <p className="text-xs text-muted-foreground">
                  Everyone in the room deploys together when the host presses DEPLOY on the Deploy tab. Teammates
                  appear in-world with live vitals, shared kill feed and synced waves.
                </p>
              </div>
            )}

            {tab === "settings" && (
              <div className="mx-auto w-full max-w-xl space-y-4">
                {(
                  [
                    ["graphics", ["low", "medium", "high", "ultra"]],
                  ] as const
                ).map(([key, values]) => (
                  <div key={key}>
                    <div className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Graphics</div>
                    <div className="mt-2 flex gap-2">
                      {values.map((v) => (
                        <button
                          key={v}
                          onClick={() => setSettings((s) => ({ ...s, [key]: v }))}
                          className={`rounded border px-4 py-2 text-xs uppercase tracking-[0.2em] ${
                            settings.graphics === v ? "border-primary text-primary" : "border-hud-line text-muted-foreground"
                          }`}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                {(
                  [
                    ["shadows", "Shadows"],
                    ["postProcessing", "Post-processing"],
                    ["bloom", "Bloom"],
                    ["volumetric", "Atmospherics"],
                    ["showFps", "Show FPS"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="flex items-center justify-between border-b border-hud-line pb-2 text-sm text-foreground">
                    {label}
                    <input
                      type="checkbox"
                      checked={settings[key]}
                      onChange={(e) => setSettings((s) => ({ ...s, [key]: e.target.checked }))}
                    />
                  </label>
                ))}
                {(
                  [
                    ["sensitivity", "Sensitivity", 0.2, 3, 0.05],
                    ["fov", "Field of view", 70, 110, 1],
                    ["masterVolume", "Master volume", 0, 1, 0.05],
                    ["sfxVolume", "SFX volume", 0, 1, 0.05],
                  ] as const
                ).map(([key, label, min, max, step]) => (
                  <label key={key} className="block text-sm text-foreground">
                    <span className="flex justify-between">
                      {label}
                      <span className="text-muted-foreground">{settings[key].toFixed(2)}</span>
                    </span>
                    <input
                      type="range"
                      min={min}
                      max={max}
                      step={step}
                      value={settings[key]}
                      onChange={(e) => setSettings((s) => ({ ...s, [key]: Number(e.target.value) }))}
                      className="mt-1 w-full accent-primary"
                    />
                  </label>
                ))}
                <button
                  onClick={() => void saveSettings(settings)}
                  className="rounded-md bg-primary px-6 py-3 text-sm uppercase tracking-[0.25em] text-primary-foreground"
                >
                  Save settings
                </button>
              </div>
            )}

            <p className="pb-4 text-center text-[11px] text-muted-foreground">
              Desktop, mouse + keyboard. Best played fullscreen with sound on.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
