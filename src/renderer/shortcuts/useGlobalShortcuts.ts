import {
  isMonacoTarget,
  isTypingTarget,
  normalizeShortcut,
  shortcutFromEvent,
  type ShortcutBinding
} from "./keybindings";

export interface GlobalShortcutController {
  dispose(): void;
}

export interface GlobalShortcutOptions {
  updateStatus: (text: string) => void;
  chordTimeoutMs?: number;
}

interface IndexedShortcut {
  readonly key: string;
  readonly shortcut: ShortcutBinding;
}

export function useGlobalShortcuts(shortcuts: readonly ShortcutBinding[], options: GlobalShortcutOptions): GlobalShortcutController {
  const bindings = indexShortcuts(shortcuts);
  const prefixes = new Set<string>();
  let pendingChord = "";
  let chordTimer: number | undefined;

  for (const binding of bindings) {
    const parts = binding.key.split(" ");
    for (let index = 1; index < parts.length; index += 1) {
      prefixes.add(parts.slice(0, index).join(" "));
    }
  }

  const clearChord = () => {
    pendingChord = "";
    if (chordTimer) window.clearTimeout(chordTimer);
    chordTimer = undefined;
  };

  const handler = (event: KeyboardEvent) => {
    const key = shortcutFromEvent(event);
    if (!key) return;

    const chord = pendingChord ? `${pendingChord} ${key}` : key;
    const match = bindings.find(binding => binding.key === chord && (binding.shortcut.when?.() ?? true));
    if (match) {
      if (!canRunShortcut(match.shortcut, event, Boolean(pendingChord))) return;
      event.preventDefault();
      event.stopPropagation();
      clearChord();
      void match.shortcut.run();
      return;
    }

    const normalizedKey = normalizeShortcut(key);
    const normalizedChord = normalizeShortcut(chord);
    if (prefixes.has(normalizedChord) || (!pendingChord && prefixes.has(normalizedKey))) {
      if (isTypingTarget(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
      pendingChord = prefixes.has(normalizedChord) ? normalizedChord : normalizedKey;
      options.updateStatus(`${pendingChord}...`);
      if (chordTimer) window.clearTimeout(chordTimer);
      chordTimer = window.setTimeout(() => {
        pendingChord = "";
        options.updateStatus("Atalho cancelado");
      }, options.chordTimeoutMs ?? 1600);
      return;
    }

    if (pendingChord) {
      event.preventDefault();
      event.stopPropagation();
      clearChord();
      options.updateStatus("Atalho sem acao");
    }
  };

  window.addEventListener("keydown", handler, true);
  return {
    dispose() {
      clearChord();
      window.removeEventListener("keydown", handler, true);
    }
  };
}

function indexShortcuts(shortcuts: readonly ShortcutBinding[]): IndexedShortcut[] {
  return shortcuts.flatMap(shortcut => shortcut.keys.map(key => ({ key: normalizeShortcut(key), shortcut })));
}

function canRunShortcut(shortcut: ShortcutBinding, event: KeyboardEvent, isChordCompletion: boolean): boolean {
  if (!isChordCompletion && shortcut.scope === "editor" && isMonacoTarget(event.target)) return false;
  if (!shortcut.allowInInput && isTypingTarget(event.target)) return false;
  return true;
}
