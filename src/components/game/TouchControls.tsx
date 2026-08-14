import { useEffect, useRef } from "react";
import type { Game, HudState } from "@/game/engine";

interface Props {
  getGame: () => Game | null;
  hud: HudState;
}

const STICK_RADIUS = 58;

/**
 * On-screen controls for phones/tablets: left thumb stick to move, right side
 * of the screen to look, and action buttons for fire, aim, jump, crouch,
 * reload, grenade, melee and weapon switching.
 */
export function TouchControls({ getGame, hud }: Props) {
  const stick = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  const stickId = useRef<number | null>(null);
  const lookId = useRef<number | null>(null);
  const lookLast = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const g = getGame();
    return () => {
      g?.setMoveAxis(0, 0);
      g?.setFire(false);
    };
  }, [getGame]);

  const moveKnob = (dx: number, dy: number) => {
    if (knob.current) knob.current.style.transform = `translate(${dx}px, ${dy}px)`;
  };

  const onStickStart = (e: React.PointerEvent) => {
    e.preventDefault();
    stickId.current = e.pointerId;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onStickMove = (e: React.PointerEvent) => {
    if (stickId.current !== e.pointerId || !stick.current) return;
    const r = stick.current.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2);
    let dy = e.clientY - (r.top + r.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > STICK_RADIUS) {
      dx = (dx / len) * STICK_RADIUS;
      dy = (dy / len) * STICK_RADIUS;
    }
    moveKnob(dx, dy);
    const g = getGame();
    if (g) {
      g.touchActive = true;
      g.setMoveAxis(dx / STICK_RADIUS, dy / STICK_RADIUS);
    }
  };

  const onStickEnd = (e: React.PointerEvent) => {
    if (stickId.current !== e.pointerId) return;
    stickId.current = null;
    moveKnob(0, 0);
    const g = getGame();
    if (g) {
      g.touchActive = false;
      g.setMoveAxis(0, 0);
    }
  };

  const onLookStart = (e: React.PointerEvent) => {
    lookId.current = e.pointerId;
    lookLast.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onLookMove = (e: React.PointerEvent) => {
    if (lookId.current !== e.pointerId) return;
    const dx = e.clientX - lookLast.current.x;
    const dy = e.clientY - lookLast.current.y;
    lookLast.current = { x: e.clientX, y: e.clientY };
    getGame()?.lookDelta(dx, dy);
  };

  const onLookEnd = (e: React.PointerEvent) => {
    if (lookId.current === e.pointerId) lookId.current = null;
  };

  const btn =
    "pointer-events-auto flex items-center justify-center rounded-full border border-hud-line bg-hud-panel/80 text-[10px] font-semibold uppercase tracking-[0.15em] text-foreground backdrop-blur-sm active:border-primary active:text-primary";

  /**
   * Held buttons capture the pointer so sliding a finger off the button still
   * releases the input (otherwise fire/aim/crouch could stick on).
   */
  const hold = (on: () => void, off: () => void) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        /* capture unsupported — plain up/cancel still releases */
      }
      on();
    },
    onPointerUp: off,
    onPointerCancel: off,
    onLostPointerCapture: off,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  return (
    <div className="pointer-events-none absolute inset-0 z-20 select-none touch-none">
      {/* look surface */}
      <div
        className="pointer-events-auto absolute inset-y-0 right-0 left-1/3"
        onPointerDown={onLookStart}
        onPointerMove={onLookMove}
        onPointerUp={onLookEnd}
        onPointerCancel={onLookEnd}
      />

      {/* movement stick */}
      <div
        ref={stick}
        onPointerDown={onStickStart}
        onPointerMove={onStickMove}
        onPointerUp={onStickEnd}
        onPointerCancel={onStickEnd}
        className="pointer-events-auto absolute bottom-24 left-6 h-32 w-32 rounded-full border border-hud-line bg-hud-panel/50 backdrop-blur-sm"
      >
        <div
          ref={knob}
          className="absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/70 bg-primary/25"
        />
      </div>

      {/* right-hand action cluster */}
      <div className="absolute bottom-24 right-5 flex flex-col items-end gap-3">
        <div className="flex gap-3">
          <button
            className={`${btn} h-12 w-12`}
            {...hold(
              () => getGame()?.setCrouch(true),
              () => getGame()?.setCrouch(false),
            )}
          >
            Duck
          </button>
          <button className={`${btn} h-12 w-12`} onPointerDown={() => getGame()?.jump()}>
            Jump
          </button>
          <button className={`${btn} h-12 w-12`} onPointerDown={() => getGame()?.reloadNow()}>
            Rel
          </button>
        </div>
        <div className="flex items-end gap-3">
          <button
            className={`${btn} h-12 w-12`}
            onPointerDown={() => getGame()?.equipCategory("melee")}
          >
            Melee
          </button>
          <button
            className={`${btn} h-12 w-12`}
            onPointerDown={() => getGame()?.equipCategory("grenade")}
          >
            Nade
          </button>
          <button
            className={`${btn} h-16 w-16`}
            {...hold(
              () => getGame()?.setAds(true),
              () => getGame()?.setAds(false),
            )}
          >
            Aim
          </button>
          <button
            className={`${btn} h-20 w-20 border-primary/70 bg-primary/25 text-xs`}
            {...hold(
              () => getGame()?.setFire(true),
              () => getGame()?.setFire(false),
            )}
          >
            Fire
          </button>
        </div>
      </div>

      {/* weapon wheel */}
      <div className="pointer-events-auto absolute right-4 top-1/2 flex -translate-y-1/2 flex-col gap-1.5">
        {hud.slots.map((s, i) => (
          <button
            key={s.id}
            onPointerDown={() => getGame()?.selectSlot(i)}
            className={`rounded border px-2 py-1 text-[9px] uppercase tracking-[0.1em] backdrop-blur-sm ${
              s.active ? "border-primary bg-primary/20 text-primary" : "border-hud-line bg-hud-panel/70 text-muted-foreground"
            }`}
          >
            {s.name.split(" ")[0]}
          </button>
        ))}
      </div>
    </div>
  );
}
