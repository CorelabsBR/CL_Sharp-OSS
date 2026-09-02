/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { EventEmitter } from "node:events";
import type { DiscordPresenceContext, DiscordPresenceState, DiscordRichPresenceSettings } from "../../shared/types";
import { buildDiscordActivity, type DiscordActivity } from "./DiscordRichPresenceBuilder";
import { DISCORD_APPLICATION_ID } from "./DiscordRichPresenceConfig";

interface RpcClient extends EventEmitter { login(options: { clientId: string }): Promise<void>; setActivity(activity: DiscordActivity): Promise<void>; clearActivity(): Promise<void>; destroy(): Promise<void>; }
interface RpcModule { Client: new (options: { transport: "ipc" }) => RpcClient; }
const DiscordRpc = require("discord-rpc") as RpcModule;
const BACKOFF = [5_000, 15_000, 30_000, 60_000];

export class DiscordRichPresenceManager {
  private client?: RpcClient;
  private enabled = false;
  private context: DiscordPresenceContext = {};
  private state: DiscordPresenceState = { status: "disabled", message: "Discord Rich Presence desativado." };
  private readonly startedAt = new Date();
  private updateTimer?: NodeJS.Timeout;
  private reconnectTimer?: NodeJS.Timeout;
  private reconnectAttempt = 0;
  private destroyed = false;
  private lastPayload = "";

  async configure(settings: DiscordRichPresenceSettings): Promise<void> {
    this.enabled = settings.enabled;
    if (!this.enabled) { await this.disconnect(); this.state = { status: "disabled", message: "Discord Rich Presence desativado." }; return; }
    if (!this.client) await this.connect(); else this.scheduleUpdate();
  }

  updateContext(context: DiscordPresenceContext): void { this.context = { ...this.context, ...context }; this.scheduleUpdate(); }
  getState(): DiscordPresenceState { return { ...this.state }; }
  async reconnect(): Promise<DiscordPresenceState> { this.reconnectAttempt = 0; await this.disconnect(); await this.connect(); return this.getState(); }
  async clear(): Promise<void> { if (this.client) await this.client.clearActivity().catch(() => undefined); this.lastPayload = ""; }
  async destroy(): Promise<void> { this.destroyed = true; clearTimeout(this.updateTimer); clearTimeout(this.reconnectTimer); await this.disconnect(); }

  private async connect(): Promise<void> {
    if (this.destroyed || !this.enabled) return;
    this.state = { status: "connecting", message: "Conectando ao Discord..." };
    const client = new DiscordRpc.Client({ transport: "ipc" });
    this.client = client;
    client.on("ready", () => { this.reconnectAttempt = 0; this.state = { status: "connected", message: "Discord Rich Presence conectado." }; this.scheduleUpdate(0); });
    client.on("disconnected", () => { if (this.client === client) { this.client = undefined; this.state = { status: "disconnected", message: "Discord não está disponível." }; this.scheduleReconnect(); } });
    try { await client.login({ clientId: DISCORD_APPLICATION_ID }); }
    catch (error) { if (this.client === client) this.client = undefined; await client.destroy().catch(() => undefined); this.state = { status: "failed", message: `Discord indisponível: ${error instanceof Error ? error.message : String(error)}` }; this.scheduleReconnect(); }
  }

  private scheduleUpdate(delay = 1_000): void { clearTimeout(this.updateTimer); this.updateTimer = setTimeout(() => void this.publish(), delay); }
  private async publish(): Promise<void> {
    if (!this.client || this.state.status !== "connected" || !this.enabled) return;
    const activity = buildDiscordActivity(this.context, this.startedAt);
    const serialized = JSON.stringify(activity);
    if (serialized === this.lastPayload) return;
    try { await this.client.setActivity(activity); this.lastPayload = serialized; }
    catch { this.state = { status: "failed", message: "Falha ao atualizar o Discord Rich Presence." }; }
  }
  private scheduleReconnect(): void { if (this.destroyed || this.reconnectTimer || !this.enabled) return; const delay = BACKOFF[Math.min(this.reconnectAttempt++, BACKOFF.length - 1)]; this.reconnectTimer = setTimeout(() => { this.reconnectTimer = undefined; void this.connect(); }, delay); }
  private async disconnect(): Promise<void> { clearTimeout(this.reconnectTimer); this.reconnectTimer = undefined; const client = this.client; this.client = undefined; if (client) await client.destroy().catch(() => undefined); this.lastPayload = ""; }
}
