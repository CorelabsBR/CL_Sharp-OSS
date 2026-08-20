/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/** Runtime APIs missing from older Android System WebView releases supported by NPSharp. */
function installReplaceChildren(prototype: object): void {
  if ("replaceChildren" in prototype) return;
  Object.defineProperty(prototype, "replaceChildren", {
    configurable: true,
    writable: true,
    value(this: ParentNode, ...nodes: Array<Node | string>): void {
      while (this.firstChild) this.removeChild(this.firstChild);
      this.append(...nodes);
    }
  });
}

installReplaceChildren(Element.prototype);
installReplaceChildren(Document.prototype);
installReplaceChildren(DocumentFragment.prototype);

if (typeof String.prototype.replaceAll !== "function") {
  Object.defineProperty(String.prototype, "replaceAll", {
    configurable: true,
    writable: true,
    value(this: string, search: string | RegExp, replacement: string): string {
      if (search instanceof RegExp) {
        if (!search.global) throw new TypeError("replaceAll requires a global regular expression");
        return this.replace(search, replacement);
      }
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return this.replace(new RegExp(escaped, "g"), replacement);
    }
  });
}

if (typeof Array.prototype.at !== "function") {
  Object.defineProperty(Array.prototype, "at", {
    configurable: true,
    writable: true,
    value<T>(this: T[], index: number): T | undefined {
      const normalized = Math.trunc(index) || 0;
      return this[normalized < 0 ? this.length + normalized : normalized];
    }
  });
}

if (typeof (Array.prototype as unknown as { findLast?: unknown }).findLast !== "function") {
  Object.defineProperty(Array.prototype, "findLast", {
    configurable: true,
    writable: true,
    value<T>(this: T[], predicate: (value: T, index: number, array: T[]) => unknown): T | undefined {
      for (let index = this.length - 1; index >= 0; index -= 1) {
        if (predicate(this[index], index, this)) return this[index];
      }
      return undefined;
    }
  });
}

if (typeof globalThis.WeakRef !== "function") {
  class StrongReference<T extends object> {
    constructor(private readonly value: T) {}
    deref(): T { return this.value; }
  }
  Object.defineProperty(globalThis, "WeakRef", { configurable: true, value: StrongReference });
}

if (typeof globalThis.FinalizationRegistry !== "function") {
  class InertFinalizationRegistry {
    constructor(_cleanup: (heldValue: unknown) => void) {}
    register(_target: object, _heldValue: unknown, _unregisterToken?: object): void {}
    unregister(_unregisterToken: object): boolean { return false; }
  }
  Object.defineProperty(globalThis, "FinalizationRegistry", { configurable: true, value: InertFinalizationRegistry });
}

if (typeof crypto.randomUUID !== "function") {
  Object.defineProperty(crypto, "randomUUID", {
    configurable: true,
    value(): `${string}-${string}-${string}-${string}-${string}` {
      const bytes = crypto.getRandomValues(new Uint8Array(16));
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const value = [...bytes].map(byte => byte.toString(16).padStart(2, "0")).join("");
      return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
    }
  });
}
