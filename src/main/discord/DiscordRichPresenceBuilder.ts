/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import path from "node:path";
import type { DiscordPresenceContext } from "../../shared/types";
import { DISCORD_ACTIVITY_BRANDING } from "./DiscordRichPresenceConfig";

export interface DiscordActivity {
  details: string;
  state: string;
  startTimestamp?: Date;
  largeImageKey?: string;
  largeImageText?: string;
  smallImageKey?: string;
  smallImageText?: string;
  buttons?: Array<{ label: string; url: string }>;
  instance: boolean;
}

const REMOTE_STATUS: Record<string, string> = {
  "resolving-host": "Resolvendo Remote Host", connecting: "Conectando ao Remote Host",
  "verifying-host-key": "Validando chave SSH", authenticating: "Autenticando no Remote Host",
  "detecting-platform": "Detectando ambiente remoto", "checking-server": "Verificando Sharp-OSS Server",
  "uploading-server": "Enviando Sharp-OSS Server", "installing-server": "Instalando Sharp-OSS Server",
  "starting-server": "Iniciando Sharp-OSS Server", "opening-tunnel": "Abrindo túnel SSH",
  "connecting-websocket": "Conectando ao servidor remoto", "validating-server": "Validando sessão remota",
  connected: "Conectado ao Remote Host", reconnecting: "Reconectando ao Remote Host",
  disconnecting: "Desconectando do Remote Host"
};

export function buildDiscordActivity(context: DiscordPresenceContext, startedAt: Date): DiscordActivity {
  const fileName = context.filePath ? path.basename(context.filePath) : "";
  const projectName = context.workspaceName || (context.workspacePath ? path.basename(context.workspacePath) : "");
  let details = fileName ? `Editando ${fileName}` : "Desenvolvendo no Sharp-OSS";
  if (context.running) details = fileName ? `Executando ${fileName}` : "Executando projeto";
  else if (context.terminalActive) details = "Usando o terminal integrado";
  else if (context.remoteStatus && context.remoteStatus !== "connected") details = REMOTE_STATUS[context.remoteStatus] || "Conectando ao Remote Host";

  const parts: string[] = [];
  if (projectName) parts.push(`Projeto: ${projectName}`);
  if (context.language) parts.push(context.language);
  if (context.remoteHost) parts.push(`Host: ${context.remoteHost}`);
  parts.push(context.remoteHost ? "Remoto" : "Local");

  const remote = Boolean(context.remoteHost || (context.remoteStatus && context.remoteStatus !== "disconnected"));
  return {
    details: clean(details),
    state: clean(parts.join(" • ") || "IDE em execução"),
    startTimestamp: startedAt,
    largeImageKey: DISCORD_ACTIVITY_BRANDING.largeImageKey,
    largeImageText: DISCORD_ACTIVITY_BRANDING.largeImageText,
    smallImageKey: remote ? DISCORD_ACTIVITY_BRANDING.remoteSmallImageKey : DISCORD_ACTIVITY_BRANDING.localSmallImageKey,
    smallImageText: remote ? DISCORD_ACTIVITY_BRANDING.remoteSmallImageText : DISCORD_ACTIVITY_BRANDING.localSmallImageText,
    instance: false
  };
}

function clean(value: string): string { return value.replace(/[\r\n]+/g, " ").trim().slice(0, 128); }
