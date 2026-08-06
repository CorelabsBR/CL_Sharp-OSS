/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import path from "node:path";
import type { DiscordPresenceContext, DiscordRichPresenceSettings } from "../../shared/types";

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
  "detecting-platform": "Detectando ambiente remoto", "checking-server": "Verificando NPSharp Server",
  "uploading-server": "Enviando NPSharp Server", "installing-server": "Instalando NPSharp Server",
  "starting-server": "Iniciando NPSharp Server", "opening-tunnel": "Abrindo túnel SSH",
  "connecting-websocket": "Conectando ao servidor remoto", "validating-server": "Validando sessão remota",
  connected: "Conectado ao Remote Host", reconnecting: "Reconectando ao Remote Host",
  disconnecting: "Desconectando do Remote Host"
};

export function buildDiscordActivity(settings: DiscordRichPresenceSettings, context: DiscordPresenceContext, startedAt: Date): DiscordActivity {
  const fileName = context.filePath ? path.basename(context.filePath) : "";
  const projectName = context.workspaceName || (context.workspacePath ? path.basename(context.workspacePath) : "");
  let details = settings.showFileName && fileName ? `Editando ${fileName}` : "Desenvolvendo no NPSharp";
  if (context.running) details = fileName && settings.showFileName ? `Executando ${fileName}` : "Executando projeto";
  else if (context.terminalActive) details = "Usando o terminal integrado";
  else if (context.remoteStatus && context.remoteStatus !== "connected") details = REMOTE_STATUS[context.remoteStatus] || "Conectando ao Remote Host";

  const parts: string[] = [];
  if (settings.showProjectName && projectName) parts.push(`Projeto: ${projectName}`);
  if (settings.showLanguage && context.language) parts.push(context.language);
  if (settings.showRemoteHost && context.remoteHost) parts.push(`Host: ${context.remoteHost}`);
  if (settings.showWorkspaceType) parts.push(context.remoteHost ? "Remoto" : "Local");

  const remote = Boolean(context.remoteHost || (context.remoteStatus && context.remoteStatus !== "disconnected"));
  return {
    details: clean(details),
    state: clean(parts.join(" • ") || "IDE em execução"),
    startTimestamp: settings.showElapsedTime ? startedAt : undefined,
    largeImageKey: optional(settings.largeImageKey), largeImageText: optional(settings.largeImageText),
    smallImageKey: settings.showWorkspaceType ? optional(remote ? settings.remoteSmallImageKey : settings.localSmallImageKey) : undefined,
    smallImageText: settings.showWorkspaceType ? optional(remote ? settings.remoteSmallImageText : settings.localSmallImageText) : undefined,
    buttons: (settings.buttons ?? []).filter(button => button.label.trim() && isHttpsUrl(button.url)).slice(0, 2).map(button => ({ label: clean(button.label), url: button.url.trim() })),
    instance: false
  };
}

function clean(value: string): string { return value.replace(/[\r\n]+/g, " ").trim().slice(0, 128); }
function optional(value?: string): string | undefined { const result = value?.trim(); return result || undefined; }
function isHttpsUrl(value: string): boolean { try { return new URL(value).protocol === "https:"; } catch { return false; } }
