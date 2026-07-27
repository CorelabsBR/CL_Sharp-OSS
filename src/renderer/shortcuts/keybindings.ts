import { monaco } from "../../editor/monacoSetup";

export type ShortcutCategory =
  | "Arquivo"
  | "Busca"
  | "Editor"
  | "Visualizar"
  | "Terminal"
  | "Executar"
  | "Controle de Origem"
  | "Preferências"
  | "NPSharp";

export type ShortcutScope = "global" | "editor";

export interface ShortcutBinding {
  id: string;
  commandId?: string;
  custom?: boolean;
  label: string;
  description: string;
  keys: string[];
  category: ShortcutCategory;
  scope?: ShortcutScope;
  allowInInput?: boolean;
  when?: () => boolean;
  run: () => void | Promise<void>;
}

const MODIFIER_ORDER = ["Ctrl", "Shift", "Alt"] as const;
const MODIFIER_ALIASES = new Map([
  ["cmd", "Ctrl"],
  ["command", "Ctrl"],
  ["control", "Ctrl"],
  ["ctrl", "Ctrl"],
  ["meta", "Ctrl"],
  ["shift", "Shift"],
  ["alt", "Alt"],
  ["option", "Alt"]
]);

const KEY_ALIASES = new Map([
  [" ", "Space"],
  ["arrowleft", "Left"],
  ["arrowright", "Right"],
  ["arrowup", "Up"],
  ["arrowdown", "Down"],
  ["esc", "Escape"],
  ["escape", "Escape"],
  ["return", "Enter"],
  ["plus", "Equal"],
  ["`", "`"],
  ["backquote", "`"],
  [",", ","],
  ["comma", ","],
  [".", "."],
  ["period", "."],
  ["/", "/"],
  ["slash", "/"],
  ["-", "-"],
  ["minus", "-"],
  ["=", "="],
  ["equal", "="]
]);

const MONACO_KEY_CODES: Record<string, monaco.KeyCode> = {
  Backspace: monaco.KeyCode.Backspace,
  Tab: monaco.KeyCode.Tab,
  Enter: monaco.KeyCode.Enter,
  Escape: monaco.KeyCode.Escape,
  Space: monaco.KeyCode.Space,
  PageUp: monaco.KeyCode.PageUp,
  PageDown: monaco.KeyCode.PageDown,
  End: monaco.KeyCode.End,
  Home: monaco.KeyCode.Home,
  Left: monaco.KeyCode.LeftArrow,
  Up: monaco.KeyCode.UpArrow,
  Right: monaco.KeyCode.RightArrow,
  Down: monaco.KeyCode.DownArrow,
  Insert: monaco.KeyCode.Insert,
  Delete: monaco.KeyCode.Delete,
  ",": monaco.KeyCode.Comma,
  ".": monaco.KeyCode.Period,
  "/": monaco.KeyCode.Slash,
  "`": monaco.KeyCode.Backquote,
  "-": monaco.KeyCode.Minus,
  "=": monaco.KeyCode.Equal
};

for (let index = 0; index <= 9; index += 1) {
  MONACO_KEY_CODES[String(index)] = monaco.KeyCode[`Digit${index}` as keyof typeof monaco.KeyCode] as monaco.KeyCode;
}

for (let index = 65; index <= 90; index += 1) {
  const letter = String.fromCharCode(index);
  MONACO_KEY_CODES[letter] = monaco.KeyCode[`Key${letter}` as keyof typeof monaco.KeyCode] as monaco.KeyCode;
}

for (let index = 1; index <= 12; index += 1) {
  MONACO_KEY_CODES[`F${index}`] = monaco.KeyCode[`F${index}` as keyof typeof monaco.KeyCode] as monaco.KeyCode;
}

export function shortcutFromEvent(event: KeyboardEvent): string {
  const parts: string[] = [];
  if (event.ctrlKey || event.metaKey) parts.push("Ctrl");
  if (event.shiftKey) parts.push("Shift");
  if (event.altKey) parts.push("Alt");

  const key = keyFromEvent(event);
  if (!key || ["Control", "Shift", "Alt", "Meta"].includes(key)) return "";
  parts.push(key);
  return parts.join("+");
}

export function normalizeShortcut(shortcut: string): string {
  return shortcut
    .split(/\s+/)
    .filter(Boolean)
    .map(normalizeShortcutPart)
    .join(" ");
}

export function isValidShortcut(shortcut: string): boolean {
  const normalized = normalizeShortcut(shortcut);
  if (!normalized) return false;
  return normalized.split(" ").every(part => {
    const tokens = part.split("+").filter(Boolean);
    return tokens.some(token => !MODIFIER_ORDER.includes(token as typeof MODIFIER_ORDER[number]));
  });
}

export function isSafeCustomShortcut(shortcut: string): boolean {
  const normalized = normalizeShortcut(shortcut);
  if (!isValidShortcut(normalized)) return false;
  return normalized.split(" ").every(part => {
    const tokens = part.split("+").filter(Boolean);
    const hasModifier = tokens.some(token => MODIFIER_ORDER.includes(token as typeof MODIFIER_ORDER[number]));
    const key = tokens.find(token => !MODIFIER_ORDER.includes(token as typeof MODIFIER_ORDER[number]));
    return hasModifier || /^F(?:[1-9]|1[0-2])$/.test(key ?? "");
  });
}

export function isTypingTarget(target: EventTarget | null | undefined): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (isMonacoTarget(target)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
}

export function isMonacoTarget(target: EventTarget | null | undefined): boolean {
  return target instanceof HTMLElement && Boolean(target.closest(".monaco-editor"));
}

export function monacoKeybindingFromShortcut(shortcut: string): number | undefined {
  const parts = normalizeShortcut(shortcut).split(" ");
  if (parts.length === 0 || parts.length > 2) return undefined;
  const first = monacoKeybindingPart(parts[0]);
  if (first === undefined) return undefined;
  if (parts.length === 1) return first;
  const second = monacoKeybindingPart(parts[1]);
  return second === undefined ? undefined : monaco.KeyMod.chord(first, second);
}

function normalizeShortcutPart(part: string): string {
  const tokens = part.split("+").map(token => token.trim()).filter(Boolean);
  const modifiers = new Set<string>();
  let key = "";

  for (const token of tokens) {
    const modifier = MODIFIER_ALIASES.get(token.toLowerCase());
    if (modifier) {
      modifiers.add(modifier);
      continue;
    }
    key = normalizeKeyToken(token);
  }

  const ordered: string[] = MODIFIER_ORDER.filter(modifier => modifiers.has(modifier));
  if (key) ordered.push(key);
  return ordered.join("+");
}

function monacoKeybindingPart(part: string): number | undefined {
  const tokens = normalizeShortcutPart(part).split("+").filter(Boolean);
  let keyCode: monaco.KeyCode | undefined;
  let result = 0;

  for (const token of tokens) {
    if (token === "Ctrl") result |= monaco.KeyMod.CtrlCmd;
    else if (token === "Shift") result |= monaco.KeyMod.Shift;
    else if (token === "Alt") result |= monaco.KeyMod.Alt;
    else keyCode = MONACO_KEY_CODES[token];
  }

  return keyCode === undefined ? undefined : result | keyCode;
}

function keyFromEvent(event: KeyboardEvent): string {
  if (event.code.startsWith("Key") && event.code.length === 4) return event.code.slice(3).toUpperCase();
  if (event.code.startsWith("Digit") && event.code.length === 6) return event.code.slice(5);
  return normalizeKeyToken(event.key);
}

function normalizeKeyToken(token: string): string {
  const alias = KEY_ALIASES.get(token.toLowerCase());
  if (alias) return alias;
  if (/^f\d{1,2}$/i.test(token)) return token.toUpperCase();
  if (token.length === 1) return token.toUpperCase();
  return token;
}
