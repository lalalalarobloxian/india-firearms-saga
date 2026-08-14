import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * Realtime co-op / war-scenario networking.
 *
 * Transport: Lovable Cloud realtime channels.
 *  - presence -> lobby roster (who is in the room, which fighter, ready state)
 *  - broadcast "state"  -> 12 Hz player transform + vitals
 *  - broadcast "event"  -> discrete events (kill, wave, grenade, objective, chat)
 *
 * The room host (lowest joinedAt) owns wave progression so every client
 * advances the mission together.
 */

export interface PeerState {
  id: string;
  name: string;
  character: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  hp: number;
  armor: number;
  weapon: string;
  kills: number;
  down: boolean;
  moving: number;
  aiming: boolean;
  t: number;
}

export interface LobbyMember {
  id: string;
  name: string;
  character: string;
  ready: boolean;
  joinedAt: number;
  host: boolean;
}

export type NetEvent =
  | { type: "kill"; from: string; name: string; target: string; head: boolean }
  | { type: "wave"; from: string; wave: number }
  | { type: "grenade"; from: string; x: number; y: number; z: number; vx: number; vy: number; vz: number; kind: string }
  | { type: "objective"; from: string; text: string }
  | { type: "revive"; from: string; target: string }
  | { type: "down"; from: string; name: string }
  | { type: "chat"; from: string; name: string; text: string };

export interface MultiplayerOptions {
  room: string;
  name: string;
  character: string;
  mapId: string;
  onLobby?: (members: LobbyMember[]) => void;
  onEvent?: (e: NetEvent) => void;
  onStart?: (payload: StartPayload) => void;
}

export interface StartPayload {
  mapId: string;
  mission: string;
  mode: "survival" | "mission";
}

const SEND_HZ = 12;

export class Multiplayer {
  readonly id = crypto.randomUUID();
  readonly room: string;
  readonly name: string;
  private channel: RealtimeChannel | null = null;
  private opts: MultiplayerOptions;
  private joinedAt = Date.now();
  private lastSend = 0;
  private ready = false;
  private rejoinTimer: ReturnType<typeof setTimeout> | null = null;
  private left = false;
  /** last connection error, surfaced in the lobby UI */
  error: string | null = null;

  /** latest known state of every remote player */
  peers = new Map<string, PeerState>();
  members: LobbyMember[] = [];
  connected = false;

  constructor(opts: MultiplayerOptions) {
    this.opts = opts;
    this.room = opts.room.trim().toUpperCase();
    this.name = opts.name;
  }

  get isHost() {
    if (this.members.length === 0) return true;
    const sorted = [...this.members].sort((a, b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id));
    return sorted[0]?.id === this.id;
  }

  async join() {
    const channel = supabase.channel(`war:${this.room}`, {
      config: { presence: { key: this.id }, broadcast: { self: false } },
    });
    this.channel = channel;

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState<{
        name: string;
        character: string;
        ready: boolean;
        joinedAt: number;
      }>();
      const members: LobbyMember[] = [];
      for (const [key, entries] of Object.entries(state)) {
        const first = entries[0];
        if (!first) continue;
        members.push({
          id: key,
          name: first.name,
          character: first.character,
          ready: first.ready,
          joinedAt: first.joinedAt,
          host: false,
        });
      }
      members.sort((a, b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id));
      if (members[0]) members[0].host = true;
      this.members = members;
      // drop peers that left
      for (const key of [...this.peers.keys()]) {
        if (!members.some((m) => m.id === key)) this.peers.delete(key);
      }
      this.opts.onLobby?.(members);
    });

    channel.on("broadcast", { event: "state" }, ({ payload }) => {
      const s = payload as PeerState;
      if (!s || s.id === this.id) return;
      this.peers.set(s.id, s);
    });

    channel.on("broadcast", { event: "event" }, ({ payload }) => {
      const e = payload as NetEvent;
      if (!e || e.from === this.id) return;
      this.opts.onEvent?.(e);
    });

    channel.on("broadcast", { event: "start" }, ({ payload }) => {
      this.opts.onStart?.(payload as StartPayload);
    });

    await new Promise<void>((resolve) => {
      let settled = false;
      const settle = () => {
        if (!settled) {
          settled = true;
          resolve();
        }
      };
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          this.connected = true;
          this.error = null;
          void channel.track({
            name: this.name,
            character: this.opts.character,
            ready: this.ready,
            joinedAt: this.joinedAt,
          });
          settle();
          return;
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          this.connected = false;
          this.error = status;
          // never leave join() hanging, and retry in the background
          settle();
          this.scheduleRejoin();
        }
      });
      // hard timeout so the UI can't spin forever on a dead network
      setTimeout(settle, 8000);
    });
  }

  private scheduleRejoin() {
    if (this.left || this.rejoinTimer) return;
    this.rejoinTimer = setTimeout(() => {
      this.rejoinTimer = null;
      if (this.left || this.connected) return;
      void (async () => {
        try {
          if (this.channel) await supabase.removeChannel(this.channel);
          this.channel = null;
          await this.join();
        } catch {
          this.scheduleRejoin();
        }
      })();
    }, 2500);
  }

  setReady(ready: boolean) {
    this.ready = ready;
    void this.channel?.track({
      name: this.name,
      character: this.opts.character,
      ready,
      joinedAt: this.joinedAt,
    });
  }

  setCharacter(character: string) {
    this.opts.character = character;
    void this.channel?.track({
      name: this.name,
      character,
      ready: this.ready,
      joinedAt: this.joinedAt,
    });
  }

  startMatch(mapId: string, mission: string, mode: "survival" | "mission") {
    const payload: StartPayload = { mapId, mission, mode };
    void this.channel?.send({ type: "broadcast", event: "start", payload });
    this.opts.onStart?.(payload);
  }

  setOnEvent(handler: (e: NetEvent) => void) {
    this.opts.onEvent = handler;
  }

  setOnStart(handler: (payload: StartPayload) => void) {
    this.opts.onStart = handler;
  }

  sendState(s: Omit<PeerState, "id" | "name" | "character" | "t">) {
    const now = performance.now();
    if (now - this.lastSend < 1000 / SEND_HZ) return;
    this.lastSend = now;
    void this.channel?.send({
      type: "broadcast",
      event: "state",
      payload: {
        ...s,
        id: this.id,
        name: this.name,
        character: this.opts.character,
        t: now,
      } satisfies PeerState,
    });
  }

  sendEvent(e: Omit<NetEvent, "from">) {
    void this.channel?.send({
      type: "broadcast",
      event: "event",
      payload: { ...e, from: this.id },
    });
  }

  async leave() {
    this.connected = false;
    this.left = true;
    if (this.rejoinTimer) {
      clearTimeout(this.rejoinTimer);
      this.rejoinTimer = null;
    }
    this.peers.clear();
    this.members = [];
    if (this.channel) {
      await supabase.removeChannel(this.channel);
      this.channel = null;
    }
  }
}

/** Human-friendly room code. */
export function randomRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 5; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}
