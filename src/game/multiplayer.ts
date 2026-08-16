import Peer, { type DataConnection } from "peerjs";

/**
 * Peer-to-peer co-op / war-scenario networking (WebRTC data channels).
 *
 * Topology: star mesh. The first player in a room claims the deterministic
 * peer id `astra-shastra-<ROOM>` and becomes the host; everyone else connects
 * straight to that peer over WebRTC and the host relays traffic. No game
 * server, no database — only the public PeerJS broker is used for the initial
 * handshake, after which packets travel directly between players.
 *
 *  - "hello" / "roster" -> lobby presence (who is in, fighter, ready state)
 *  - "state"            -> 12 Hz player transform + vitals
 *  - "event"            -> discrete events (kill, wave, grenade, objective, chat)
 *  - "start"            -> host deploys the squad
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
  onConnection?: (connected: boolean, error: string | null) => void;
}

export interface StartPayload {
  mapId: string;
  mission: string;
  mode: "survival" | "mission";
}

type Packet =
  | { k: "hello"; member: LobbyMember }
  | { k: "roster"; members: LobbyMember[] }
  | { k: "state"; s: PeerState }
  | { k: "event"; e: NetEvent }
  | { k: "start"; p: StartPayload }
  | { k: "bye"; id: string };

const SEND_HZ = 12;
const BROKER_PREFIX = "astra-shastra-";

function hostPeerId(room: string) {
  return `${BROKER_PREFIX}${room.toLowerCase()}`;
}

export class Multiplayer {
  /** logical player id, stable for the whole session */
  readonly id = crypto.randomUUID();
  readonly room: string;
  readonly name: string;

  private peer: Peer | null = null;
  private opts: MultiplayerOptions;
  private joinedAt = Date.now();
  private lastSend = 0;
  private ready = false;
  private left = false;
  private rejoinTimer: ReturnType<typeof setTimeout> | null = null;
  /** host: every guest connection. guest: single uplink to the host. */
  private conns: DataConnection[] = [];
  private uplink: DataConnection | null = null;
  private host = false;

  error: string | null = null;
  peers = new Map<string, PeerState>();
  members: LobbyMember[] = [];
  connected = false;

  constructor(opts: MultiplayerOptions) {
    this.opts = opts;
    this.room = opts.room.trim().toUpperCase();
    this.name = opts.name;
  }

  get isHost() {
    return this.host;
  }

  private self(): LobbyMember {
    return {
      id: this.id,
      name: this.name,
      character: this.opts.character,
      ready: this.ready,
      joinedAt: this.joinedAt,
      host: this.host,
    };
  }

  async join() {
    this.left = false;
    this.error = null;
    this.connected = false;
    this.opts.onConnection?.(false, null);
    if (!this.room) {
      this.error = "Enter a room code";
      this.opts.onConnection?.(false, this.error);
      return;
    }
    try {
      await this.claimHost();
    } catch {
      try {
        await this.joinHost();
      } catch (error) {
        this.error = error instanceof Error ? error.message : "Could not reach the room";
        this.opts.onConnection?.(false, this.error);
        this.scheduleRejoin();
        return;
      }
    }
  }

  /** Try to own the room by taking its deterministic peer id. */
  private claimHost() {
    return new Promise<void>((resolve, reject) => {
      const peer = new Peer(hostPeerId(this.room), { debug: 0 });
      let settled = false;
      const fail = (msg: string) => {
        if (settled) return;
        settled = true;
        peer.destroy();
        reject(new Error(msg));
      };
      const timer = setTimeout(() => fail("timeout"), 9000);
      peer.on("open", () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.peer = peer;
        this.host = true;
        this.connected = true;
        this.members = [this.self()];
        this.opts.onLobby?.(this.members);
        this.opts.onConnection?.(true, null);
        peer.on("connection", (conn) => this.acceptGuest(conn));
        peer.on("disconnected", () => peer.reconnect());
        peer.on("error", () => undefined);
        resolve();
      });
      peer.on("error", (err) => fail(err.message || "peer error"));
    });
  }

  /** Room already exists — dial the host directly. */
  private joinHost() {
    return new Promise<void>((resolve, reject) => {
      const peer = new Peer({ debug: 0 });
      let settled = false;
      const fail = (msg: string) => {
        if (settled) return;
        settled = true;
        peer.destroy();
        reject(new Error(msg));
      };
      const timer = setTimeout(() => fail("Connection timed out — check your network and try again"), 12000);
      peer.on("open", () => {
        this.peer = peer;
        const conn = peer.connect(hostPeerId(this.room), { reliable: true });
        conn.on("open", () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          this.uplink = conn;
          this.host = false;
          this.connected = true;
          this.error = null;
          this.send({ k: "hello", member: this.self() });
          this.opts.onConnection?.(true, null);
          resolve();
        });
        conn.on("data", (raw) => this.onPacket(raw as Packet, null));
        conn.on("close", () => {
          this.uplink = null;
          this.connected = false;
          if (!this.left) {
            this.error = "Host left the room";
            this.opts.onConnection?.(false, this.error);
            this.scheduleRejoin();
          }
        });
        conn.on("error", () => fail("Could not connect to the host"));
      });
      peer.on("error", (err) => fail(err.message || "Could not connect to the host"));
    });
  }

  private acceptGuest(conn: DataConnection) {
    this.conns.push(conn);
    conn.on("data", (raw) => this.onPacket(raw as Packet, conn));
    const drop = () => {
      this.conns = this.conns.filter((c) => c !== conn);
      const pid = (conn as DataConnection & { playerId?: string }).playerId;
      if (pid) {
        this.members = this.members.filter((m) => m.id !== pid);
        this.peers.delete(pid);
      }
      this.broadcastRoster();
    };
    conn.on("close", drop);
    conn.on("error", drop);
  }

  private broadcastRoster() {
    if (!this.host) return;
    this.members = [...this.members].sort((a, b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id));
    this.members = this.members.map((m) => ({ ...m, host: m.id === this.id }));
    this.opts.onLobby?.(this.members);
    this.relay({ k: "roster", members: this.members }, null);
  }

  private onPacket(packet: Packet, from: DataConnection | null) {
    if (!packet || typeof packet !== "object") return;
    switch (packet.k) {
      case "hello": {
        if (!this.host) return;
        if (from) (from as DataConnection & { playerId?: string }).playerId = packet.member.id;
        this.members = [...this.members.filter((m) => m.id !== packet.member.id), { ...packet.member, host: false }];
        this.broadcastRoster();
        break;
      }
      case "roster": {
        this.members = packet.members;
        for (const key of [...this.peers.keys()]) {
          if (!packet.members.some((m) => m.id === key)) this.peers.delete(key);
        }
        this.opts.onLobby?.(packet.members);
        break;
      }
      case "state": {
        if (packet.s.id === this.id) return;
        this.peers.set(packet.s.id, packet.s);
        if (this.host) this.relay(packet, from);
        break;
      }
      case "event": {
        if (packet.e.from === this.id) return;
        if (this.host) this.relay(packet, from);
        this.opts.onEvent?.(packet.e);
        break;
      }
      case "start": {
        if (this.host) this.relay(packet, from);
        this.opts.onStart?.(packet.p);
        break;
      }
      case "bye": {
        this.peers.delete(packet.id);
        this.members = this.members.filter((m) => m.id !== packet.id);
        if (this.host) this.broadcastRoster();
        else this.opts.onLobby?.(this.members);
        break;
      }
    }
  }

  /** host -> all guests (optionally skipping the sender) */
  private relay(packet: Packet, except: DataConnection | null) {
    for (const c of this.conns) {
      if (c === except || !c.open) continue;
      try {
        c.send(packet);
      } catch {
        /* dropped frame */
      }
    }
  }

  /** send to the rest of the room, whichever side we are on */
  private send(packet: Packet) {
    if (this.host) this.relay(packet, null);
    else if (this.uplink?.open) {
      try {
        this.uplink.send(packet);
      } catch {
        /* dropped frame */
      }
    }
  }

  private scheduleRejoin() {
    if (this.left || this.rejoinTimer) return;
    this.rejoinTimer = setTimeout(() => {
      this.rejoinTimer = null;
      if (this.left || this.connected) return;
      void (async () => {
        this.peer?.destroy();
        this.peer = null;
        this.conns = [];
        this.uplink = null;
        await this.join();
      })();
    }, 2500);
  }

  setReady(ready: boolean) {
    this.ready = ready;
    this.pushSelf();
  }

  setCharacter(character: string) {
    this.opts.character = character;
    this.pushSelf();
  }

  private pushSelf() {
    if (!this.connected) return;
    if (this.host) {
      this.members = [...this.members.filter((m) => m.id !== this.id), this.self()];
      this.broadcastRoster();
    } else {
      this.send({ k: "hello", member: this.self() });
    }
  }

  startMatch(mapId: string, mission: string, mode: "survival" | "mission") {
    const payload: StartPayload = { mapId, mission, mode };
    this.send({ k: "start", p: payload });
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
    this.send({
      k: "state",
      s: { ...s, id: this.id, name: this.name, character: this.opts.character, t: now },
    });
  }

  sendEvent(e: Omit<NetEvent, "from">) {
    this.send({ k: "event", e: { ...e, from: this.id } as NetEvent });
  }

  async leave() {
    this.left = true;
    this.connected = false;
    if (this.rejoinTimer) {
      clearTimeout(this.rejoinTimer);
      this.rejoinTimer = null;
    }
    try {
      this.send({ k: "bye", id: this.id });
    } catch {
      /* already gone */
    }
    this.peers.clear();
    this.members = [];
    this.conns = [];
    this.uplink = null;
    this.peer?.destroy();
    this.peer = null;
    this.opts.onConnection?.(false, null);
  }
}

/** Human-friendly room code. */
export function randomRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 5; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}
