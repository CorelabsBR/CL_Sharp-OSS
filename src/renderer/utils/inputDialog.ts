/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { el } from "./dom";

export function showInputDialog(title: string, initialValue = "", options?: { password?: boolean; placeholder?: string }): Promise<string | undefined> {
  return new Promise(resolve => {
    const overlay = el("div", { className: "runtime-config-overlay", attrs: { tabindex: "-1" } });
    const dialog = el("section", { className: "runtime-config-dialog input-dialog", attrs: { role: "dialog", "aria-modal": "true", "aria-label": title } });
    const header = el("header", { className: "runtime-config-header" });
    header.append(el("div", { className: "runtime-config-title", children: [el("h2", { text: title })] }));
    const input = el("input", { className: "panel-input", attrs: { value: initialValue, placeholder: options?.placeholder ?? "", type: options?.password ? "password" : "text", autocomplete: options?.password ? "current-password" : "off" } });
    const actions = el("div", { className: "settings-inline-actions" });
    const cancel = el("button", { className: "wide-action", text: "Cancelar" });
    const accept = el("button", { className: "wide-action", text: "Confirmar" });
    let settled = false;
    const finish = (value?: string) => { if (settled) return; settled = true; overlay.remove(); resolve(value); };
    cancel.addEventListener("click", () => finish());
    accept.addEventListener("click", () => finish(input.value));
    overlay.addEventListener("click", event => { if (event.target === overlay) finish(); });
    overlay.addEventListener("keydown", event => { if (event.key === "Escape") finish(); if (event.key === "Enter") finish(input.value); });
    actions.append(cancel, accept); dialog.append(header, input, actions); overlay.append(dialog); document.body.append(overlay);
    input.focus(); input.select();
  });
}
