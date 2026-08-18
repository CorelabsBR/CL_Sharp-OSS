/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import globals from "globals";
import tseslint from "typescript-eslint";

const HEADER = `/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/`;

const headerPlugin = {
  rules: {
    required: {
      meta: {
        type: "suggestion",
        docs: { description: "Exige o cabeçalho de licença CorelabsBR." },
        schema: [],
        messages: { missing: "Adicione o cabeçalho de licença CorelabsBR no início do arquivo." }
      },
      create(context) {
        if (!context.sourceCode.text.startsWith(HEADER)) {
          context.report({ loc: { line: 1, column: 0 }, messageId: "missing" });
        }
        return {};
      }
    }
  }
};

export default tseslint.config(
  {
    ignores: [".vscode/**", "node_modules/**", "dist/**", "dist-electron/**", "dist-tests/**", "release/**", "android/**", "testes/**"]
  },
  {
    files: ["**/*.{ts,tsx,js,mjs,cjs}"],
    languageOptions: {
      parser: tseslint.parser,
      globals: { ...globals.browser, ...globals.node }
    },
    plugins: { header: headerPlugin },
    rules: { "header/required": "error" }
  }
);
