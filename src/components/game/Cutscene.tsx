import { useEffect, useState } from "react";
import { cutsceneBeats } from "@/game/historyContent";

/**
 * Mission intro cutscene — one beat at a time over a darkened field, with a
 * skip so replays are never a wall. Calls onDone when the last beat is passed.
 */
export function Cutscene({
  missionId,
  missionName,
  year,
  onDone,
}: {
  missionId: string;
  missionName: string;
  year: string;
  onDone: () => void;
}) {
  const beats = cutsceneBeats(missionId, missionName, year);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setIndex((i) => {
        if (i + 1 >= beats.length) {
          onDone();
          return i;
        }
        return i + 1;
      });
    }, 4200);
    return () => window.clearTimeout(id);
  }, [index, beats.length, onDone]);

  const beat = beats[Math.min(index, beats.length - 1)]!;

  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-background px-6 text-center">
      <div className="pointer-events-none absolute inset-0 opacity-40" style={{ background: "radial-gradient(circle at 50% 40%, hsl(var(--primary) / 0.18), transparent 60%)" }} />
      <div key={index} className="animate-fade-in max-w-3xl">
        <p className="text-[11px] uppercase tracking-[0.45em] text-primary">{beat.caption}</p>
        <p className="mt-6 font-display text-2xl leading-relaxed text-foreground sm:text-4xl">{beat.line}</p>
      </div>

      <div className="absolute bottom-10 flex flex-col items-center gap-4">
        <div className="flex gap-1.5">
          {beats.map((b, i) => (
            <span
              key={b.caption + i}
              className={`h-1 w-8 rounded ${i <= index ? "bg-primary" : "bg-hud-line"}`}
            />
          ))}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => (index + 1 >= beats.length ? onDone() : setIndex(index + 1))}
            className="rounded border border-hud-line px-5 py-2 text-[10px] uppercase tracking-[0.3em] text-muted-foreground"
          >
            Next
          </button>
          <button
            onClick={onDone}
            className="rounded bg-primary px-6 py-2 text-[10px] uppercase tracking-[0.3em] text-primary-foreground"
          >
            Skip to briefing
          </button>
        </div>
      </div>
    </div>
  );
}
