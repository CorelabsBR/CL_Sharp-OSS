/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import type { FileOpenResult } from "../../shared/types";
import { el } from "../utils/dom";

export class ImageViewer {
  readonly element = el("section", { className: "image-viewer" });
  private readonly canvas = el("div", { className: "image-canvas" });
  private readonly image = el("img", { className: "image-content", attrs: { draggable: "false" } });
  private readonly meta = el("div", { className: "image-meta" });
  private scale = 1;
  private offsetX = 0;
  private offsetY = 0;
  private dragging = false;
  private dragX = 0;
  private dragY = 0;

  constructor(private readonly file: FileOpenResult, private readonly onStatus: (text: string) => void) {
    this.element.append(this.toolbar(), this.canvas);
    this.canvas.append(this.image, this.meta);
    this.image.src = file.imageDataUrl ?? "";
    this.image.addEventListener("load", () => {
      this.applyBackgroundMode();
      this.fit();
      this.meta.textContent = `${file.name} · ${this.image.naturalWidth} × ${this.image.naturalHeight} · ${formatBytes(file.size)} · ${file.type}`;
      this.onStatus(this.meta.textContent);
    });
    this.image.addEventListener("error", () => {
      this.meta.textContent = `${file.name} · ${formatBytes(file.size)} · ${file.type} (formato nao suportado pelo Chromium)`;
      this.onStatus(this.meta.textContent);
    });
    this.canvas.addEventListener("wheel", event => {
      event.preventDefault();
      this.zoom(event.deltaY < 0 ? 1.12 : 1 / 1.12, event.clientX, event.clientY);
    }, { passive: false });
    this.canvas.addEventListener("pointerdown", event => {
      this.dragging = true;
      this.dragX = event.clientX - this.offsetX;
      this.dragY = event.clientY - this.offsetY;
      this.canvas.setPointerCapture(event.pointerId);
    });
    this.canvas.addEventListener("pointermove", event => {
      if (!this.dragging) return;
      this.offsetX = event.clientX - this.dragX;
      this.offsetY = event.clientY - this.dragY;
      this.render();
    });
    this.canvas.addEventListener("pointerup", () => { this.dragging = false; });
  }

  setActive(active: boolean): void {
    this.element.hidden = !active;
    if (active) this.onStatus(this.meta.textContent || `${this.file.name} · ${formatBytes(this.file.size)} · ${this.file.type}`);
  }

  dispose(): void { this.image.src = ""; }

  private toolbar(): HTMLElement {
    const toolbar = el("div", { className: "image-toolbar" });
    const action = (label: string, callback: () => void) => {
      const button = el("button", { className: "image-tool", text: label });
      button.addEventListener("click", callback);
      return button;
    };
    toolbar.append(action("Ajustar", () => this.fit()), action("Tamanho real", () => this.actualSize()), action("Redefinir zoom", () => this.fit()));
    return toolbar;
  }

  private fit(): void {
    if (!this.image.naturalWidth || !this.image.naturalHeight) return;
    const bounds = this.canvas.getBoundingClientRect();
    this.scale = Math.min(1, (bounds.width - 48) / this.image.naturalWidth, (bounds.height - 82) / this.image.naturalHeight);
    this.offsetX = 0;
    this.offsetY = 0;
    this.render();
  }

  private actualSize(): void { this.scale = 1; this.offsetX = 0; this.offsetY = 0; this.render(); }

  private zoom(factor: number, pointerX: number, pointerY: number): void {
    const rect = this.canvas.getBoundingClientRect();
    const next = Math.max(0.05, Math.min(32, this.scale * factor));
    const ratio = next / this.scale;
    this.offsetX = (this.offsetX + pointerX - rect.left - rect.width / 2) * ratio - (pointerX - rect.left - rect.width / 2);
    this.offsetY = (this.offsetY + pointerY - rect.top - rect.height / 2) * ratio - (pointerY - rect.top - rect.height / 2);
    this.scale = next;
    this.render();
  }

  private render(): void { this.image.style.transform = `translate(${this.offsetX}px, ${this.offsetY}px) scale(${this.scale})`; }

  private applyBackgroundMode(): void {
    const hasAlpha = this.detectTransparency();
    this.canvas.classList.toggle("image-transparent", hasAlpha);
  }

  private detectTransparency(): boolean {
    const width = this.image.naturalWidth;
    const height = this.image.naturalHeight;
    if (!width || !height) return false;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return false;
    context.clearRect(0, 0, width, height);
    context.drawImage(this.image, 0, 0, width, height);
    const data = context.getImageData(0, 0, width, height).data;
    for (let index = 3; index < data.length; index += 4) {
      if (data[index] < 255) return true;
    }
    return false;
  }
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
