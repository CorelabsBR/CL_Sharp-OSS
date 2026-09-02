/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const require = createRequire(import.meta.url);
const { CommandRegistry, fuzzyScore } = require("../dist-electron/renderer/commands/commandRegistry.js");
const { parseQuickOpenQuery } = require("../dist-electron/renderer/commands/quickOpen.js");
const { emmetAbbreviationAt, emmetLanguageConfig } = require("../dist-electron/editor/emmet.js");
const { buildTaskMenuItems } = require("../dist-electron/shared/taskMenu.js");
const { t } = require("../dist-electron/shared/i18n.js");
const ts = require("typescript");

test("Command Registry registra, executa e remove comandos", async () => {
  const registry = new CommandRegistry();
  let executions = 0;
  const dispose = registry.register({ id: "test.run", category: "Test", title: "Run", execute: () => { executions++; } });
  assert.equal(await registry.execute("test.run"), true);
  assert.equal(executions, 1);
  dispose();
  assert.equal(await registry.execute("test.run"), false);
});

test("fuzzy ranking rejeita texto sem correspondência ordenada", () => {
  assert.ok(fuzzyScore("cmd", "command") >= 0);
  assert.equal(fuzzyScore("xyz", "command"), -1);
});

test("Quick Open interpreta linha e coluna sem confundir caminhos", () => {
  assert.deepEqual(parseQuickOpenQuery("src/main.ts:12:4"), { query: "src/main.ts", line: 12, column: 4 });
  assert.deepEqual(parseQuickOpenQuery("C:\\project\\main.ts"), { query: "C:\\project\\main.ts" });
});

test("Emmet oferece autocomplete nos dialetos de markup e estilos", () => {
  assert.deepEqual(emmetLanguageConfig("typescript", "/src/card.tsx"), { type: "markup", syntax: "jsx" });
  assert.equal(emmetLanguageConfig("typescript", "/src/card.ts"), undefined);
  assert.match(emmetAbbreviationAt("div.card", { type: "markup", syntax: "jsx" }).snippet, /className="card"/);
  assert.match(emmetAbbreviationAt("m10", { type: "stylesheet", syntax: "css" }).snippet, /margin: 10px/);
  assert.match(emmetAbbreviationAt("node>child", { type: "markup", syntax: "xml" }).snippet, /<child>\$1<\/child>/);
});

test("menu de tarefas expõe ações reais do editor e do workspace", () => {
  let runProject = 0;
  let buildProject = 0;
  const tasks = buildTaskMenuItems({
    runProject: () => { runProject++; },
    buildProject: () => { buildProject++; },
    openTerminal: () => {},
    openNotes: () => {},
    runDebug: () => {}
  });
  assert.ok(tasks.some(item => item.label === "Executar projeto"));
  assert.ok(tasks.some(item => item.label === "Compilar projeto"));
  assert.ok(tasks.some(item => item.label === "Executar e depurar"));
  assert.equal(tasks.length >= 4, true);
  tasks[0].run();
  tasks[1].run();
  assert.equal(runProject, 1);
  assert.equal(buildProject, 1);
});

test("seleciona o catálogo JSON correspondente ao idioma", () => {
  assert.equal(t("en-US", "Configurações"), "Settings");
  assert.equal(t("es-ES", "Configurações"), "Configuración");
  assert.equal(t("ru-RU", "Configurações"), "Настройки");
  assert.equal(t("zh-CN", "Configurações"), "设置");
  assert.equal(t("en-US", "Tema de ícones"), "Icon Theme");
  assert.equal(t("en-US", "Escolher papel de parede"), "Choose Wallpaper");
  assert.equal(t("en-US", "Barra lateral visível"), "Side Bar Visible");
  assert.equal(t("en-US", "Confirmar"), "Confirm");
  assert.equal(t("pt-BR", "Confirmar"), "Confirmar");
});

test("catálogo traduz integralmente o painel de pesquisa", () => {
  assert.equal(t("ru-RU", "Pesquisar"), "Поиск");
  assert.equal(t("ru-RU", "Substituir"), "Заменить");
  assert.equal(t("ru-RU", "Diferenciar maiúsculas/minúsculas"), "Учитывать регистр");
  assert.equal(t("ru-RU", "Palavra inteira"), "Слово целиком");
  assert.equal(t("ru-RU", "Digite para pesquisar"), "Введите текст для поиска");
  assert.equal(t("zh-CN", "Pesquisar"), "搜索");
});

test("catálogos não deixam o diálogo Sobre e o menu em português", () => {
  const expected = {
    "en-US": ["Toggle ErrorLens", "About Sharp-OSS", "Development", "Application", "Sharp-OSS Data", "System", "Repository", "Close"],
    "es-ES": ["Alternar ErrorLens", "Acerca de Sharp-OSS", "Desarrollo", "Aplicación", "Datos de Sharp-OSS", "Sistema", "Repositorio", "Cerrar"],
    "ru-RU": ["Переключить ErrorLens", "О Sharp-OSS", "Разработка", "Приложение", "Данные Sharp-OSS", "Система", "Репозиторий", "Закрыть"],
    "zh-CN": ["切换 ErrorLens", "关于 Sharp-OSS", "开发环境", "应用程序", "Sharp-OSS 数据", "系统", "仓库", "关闭"]
  };
  const keys = ["Alternar ErrorLens", "Sobre o Sharp-OSS", "Desenvolvimento", "Aplicativo", "Dados do Sharp-OSS", "Sistema", "Repositório", "Fechar"];

  for (const [locale, translations] of Object.entries(expected)) {
    assert.deepEqual(keys.map(key => t(locale, key)), translations);
  }
});

test("painel Arduino traduz mensagens estáticas, dinâmicas e do serviço", () => {
  assert.equal(t("ru-RU", "Arduino CLI nao encontrado no PATH. Instale arduino-cli ou configure o caminho."), "Arduino CLI не найден в PATH. Установите arduino-cli или настройте путь.");
  assert.equal(t("ru-RU", "Caminho do sketch"), "Путь к скетчу");
  assert.equal(t("ru-RU", "Placa"), "Плата");
  assert.equal(t("ru-RU", "Porta"), "Порт");
  assert.equal(t("ru-RU", "Taxa de transmissão"), "Скорость передачи");
  assert.equal(t("zh-CN", "Monitor serial"), "串口监视器");

  const arduinoPanel = fs.readFileSync(new URL("../src/renderer/components/ArduinoPanel.ts", import.meta.url), "utf8");
  assert.match(arduinoPanel, /uiText\(info\.message\)/);
  assert.equal(arduinoPanel.match(/appendOutput\(uiText\(result\.output\)\)/g)?.length, 3);
  assert.doesNotMatch(arduinoPanel, /this\.updateStatus\(\s*["'`]/);
  assert.doesNotMatch(arduinoPanel, /this\.summary\.textContent\s*=\s*["'`]/);

  const errors = fs.readFileSync(new URL("../src/renderer/utils/errors.ts", import.meta.url), "utf8");
  assert.match(errors, /uiText\(errorMessage\(error\)\)/);
});

test("painéis desconectados são localizados quando abertos", () => {
  const idePage = fs.readFileSync(new URL("../src/renderer/pages/IdePage.ts", import.meta.url), "utf8");
  assert.match(idePage, /const panel = this\.panels\.get\(panelId\)[\s\S]*localizeElementTree\(panel\)[\s\S]*this\.sideContent\.replaceChildren\(panel\)/);
  assert.match(idePage, /localizeElementTree\(this\.aiChat\.element\)/);
});

test("catálogos JSON de idioma têm a mesma cobertura", () => {
  const locales = ["pt-BR", "en-US", "es-ES", "ru-RU", "zh-CN"];
  const catalogs = locales.map(locale => JSON.parse(fs.readFileSync(new URL(`../src/shared/locales/${locale}.json`, import.meta.url), "utf8")));
  const baseKeys = Object.keys(catalogs[0]).sort();

  assert.ok(baseKeys.length > 0);
  for (const [index, catalog] of catalogs.entries()) {
    assert.deepEqual(Object.keys(catalog).sort(), baseKeys, `${locales[index]} deve possuir as mesmas chaves de pt-BR`);
    assert.ok(Object.values(catalog).every(value => typeof value === "string" && value.length > 0), `${locales[index]} contém tradução vazia ou inválida`);
  }
});

test("catálogo base cobre todas as chaves literais usadas pela interface", () => {
  const sourceRoot = fileURLToPath(new URL("../src", import.meta.url));
  const sourceFiles = [];
  const collectSourceFiles = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) collectSourceFiles(target);
      else if (target.endsWith(".ts")) sourceFiles.push(target);
    }
  };
  collectSourceFiles(sourceRoot);

  const usedKeys = new Set();
  for (const target of sourceFiles) {
    const source = fs.readFileSync(target, "utf8");
    const sourceFile = ts.createSourceFile(target, source, ts.ScriptTarget.Latest, true);
    const visit = node => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
        const argumentIndex = node.expression.text === "uiText" ? 0 : node.expression.text === "t" ? 1 : -1;
        const argument = node.arguments[argumentIndex];
        if (argumentIndex >= 0 && argument && ts.isStringLiteralLike(argument)) usedKeys.add(argument.text);
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }

  const baseCatalog = JSON.parse(fs.readFileSync(new URL("../src/shared/locales/pt-BR.json", import.meta.url), "utf8"));
  assert.deepEqual([...usedKeys].filter(key => !(key in baseCatalog)).sort(), []);
});
