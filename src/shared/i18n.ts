/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import ptBR from "./locales/pt-BR.json";
import enUS from "./locales/en-US.json";
import esES from "./locales/es-ES.json";
import ruRU from "./locales/ru-RU.json";
import zhCN from "./locales/zh-CN.json";

export const SUPPORTED_LOCALES = [
  "pt-BR",
  "en-US",
  "es-ES",
  "ru-RU",
  "zh-CN"
] as const;

export type AppLocale = typeof SUPPORTED_LOCALES[number];
type TranslationCatalog = Readonly<Record<string, string>>;

export const DEFAULT_LOCALE: AppLocale = "pt-BR";

export const LOCALE_LABELS: Record<AppLocale, string> = {
  "pt-BR": "Português (Brasil)",
  "en-US": "English (United States)",
  "es-ES": "Español (América Latina)",
  "ru-RU": "Русский (Россия)",
  "zh-CN": "简体中文"
};

const CATALOGS: Record<AppLocale, TranslationCatalog> = Object.freeze({
  "pt-BR": ptBR,
  "en-US": enUS,
  "es-ES": esES,
  "ru-RU": ruRU,
  "zh-CN": zhCN
});

let uiLocale: AppLocale = DEFAULT_LOCALE;
let uiCatalog: TranslationCatalog = CATALOGS[DEFAULT_LOCALE];
const localeListeners = new Set<(locale: AppLocale) => void>();

export function normalizeLocale(locale: unknown): AppLocale {
  return SUPPORTED_LOCALES.includes(locale as AppLocale)
    ? (locale as AppLocale)
    : DEFAULT_LOCALE;
}

export function t(locale: AppLocale, key: string): string {
  const catalog = CATALOGS[normalizeLocale(locale)];
  return catalog[key] ?? CATALOGS[DEFAULT_LOCALE][key] ?? key;
}

export function setUiLocale(locale: unknown): void {
  const nextLocale = normalizeLocale(locale);
  if (uiLocale === nextLocale) return;

  uiLocale = nextLocale;
  uiCatalog = CATALOGS[nextLocale];

  for (const listener of [...localeListeners]) {
    try {
      listener(uiLocale);
    } catch (error) {
      console.error("[i18n] Falha ao atualizar componente:", error);
    }
  }
}

export function getUiLocale(): AppLocale {
  return uiLocale;
}

export function uiText(key: string): string {
  return uiCatalog[key] ?? CATALOGS[DEFAULT_LOCALE][key] ?? key;
}

export function onUiLocaleChange(listener: (locale: AppLocale) => void): () => void {
  localeListeners.add(listener);
  return () => localeListeners.delete(listener);
}
