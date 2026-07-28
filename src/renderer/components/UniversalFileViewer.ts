/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import type { FileOpenResult } from "../../shared/types";
import { el } from "../utils/dom";

/** Read-only inspector for binary, structured documents, databases and media files. */
export class UniversalFileViewer {
  readonly element = el("section", { className: "universal-file-viewer" });
  private readonly meta = el("div", { className: "universal-file-meta" });

  constructor(private readonly file: FileOpenResult, private readonly onStatus: (text: string) => void) {
    this.meta.textContent = `${file.name} · ${formatBytes(file.size)} · ${file.type}${file.previewTruncated ? " · prévia parcial" : ""}`;
    this.element.append(this.toolbar(), this.meta, this.content());
  }

  setActive(active: boolean): void {
    this.element.hidden = !active;
    if (active) this.onStatus(this.meta.textContent || this.file.name);
  }

  dispose(): void {
    this.element.querySelectorAll<HTMLMediaElement>("audio, video").forEach(media => {
      media.pause();
      media.removeAttribute("src");
      media.load();
    });
  }

  private toolbar(): HTMLElement {
    const toolbar = el("div", { className: "universal-file-toolbar" });
    const copy = el("button", { className: "image-tool", text: "Copiar detalhes" });
    copy.addEventListener("click", () => {
      const detail = this.file.content || formatHex(this.file.previewData, this.file.previewTruncated);
      void navigator.clipboard.writeText(detail).then(() => this.onStatus("Detalhes copiados"));
    });
    toolbar.append(el("strong", { text: viewerTitle(this.file) }), copy);
    return toolbar;
  }

  private content(): HTMLElement {
    if (this.file.editor === "media" && this.file.dataUrl) {
      const media = /\.(mp3|wav|ogg|oga|m4a|aac|flac)$/i.test(this.file.name)
        ? el("audio", { className: "universal-media", attrs: { controls: "", src: this.file.dataUrl } })
        : el("video", { className: "universal-media", attrs: { controls: "", src: this.file.dataUrl } });
      return el("div", { className: "universal-media-wrap", children: [media] });
    }
    if (this.file.editor === "pdf" && this.file.dataUrl) {
      return el("iframe", { className: "universal-pdf", attrs: { src: this.file.dataUrl, title: this.file.name } });
    }
    const detail = this.file.content || formatHex(this.file.previewData, this.file.previewTruncated);
    const content = el("pre", { className: "universal-file-content", text: detail || "Não há prévia disponível para este arquivo." });
    if ((this.file.editor === "media" || this.file.editor === "pdf") && !this.file.dataUrl) {
      const message = el("p", { className: "universal-file-warning", text: "O arquivo é grande demais para ser incorporado com segurança. A prévia hexadecimal abaixo permite inspecioná-lo." });
      return el("div", { className: "universal-file-fallback", children: [message, content] });
    }
    return content;
  }
}

function viewerTitle(file: FileOpenResult): string {
  return ({
    binary: "Inspetor binário",
    nbt: "Visualizador NBT",
    archive: "Conteúdo do arquivo compactado",
    media: "Reprodutor de mídia",
    pdf: "Visualizador PDF",
    document: "Visualizador de documento estruturado",
    database: "Visualizador de banco de dados",
    design: "Visualizador de projeto gráfico/CAD",
    game: "Visualizador de savegame"
  } as Partial<Record<FileOpenResult["editor"], string>>)[file.editor] ?? "Visualizador";
}

function formatHex(data: string | undefined, truncated: boolean | undefined): string {
  if (!data) return "";
  const binary = atob(data);
  const lines: string[] = [];
  for (let offset = 0; offset < binary.length; offset += 16) {
    const chunk = binary.slice(offset, offset + 16);
    const hex = [...chunk].map(char => char.charCodeAt(0).toString(16).padStart(2, "0")).join(" ").padEnd(47, " ");
    const ascii = [...chunk].map(char => {
      const code = char.charCodeAt(0);
      return code >= 32 && code <= 126 ? char : ".";
    }).join("");
    lines.push(`${offset.toString(16).padStart(8, "0")}  ${hex}  ${ascii}`);
  }
  if (truncated) lines.push("\n… prévia limitada aos primeiros 512 KB do arquivo.");
  return lines.join("\n");
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
