/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/** Content written only by NPSharp's explicit new-file flow. */
export const GTA6_EASTER_EGG_FILE_NAME = "gta6.py";
export const PORTUGOL_FILE_EXTENSION = ".gol";

export const GTA6_EASTER_EGG_CONTENT = `game = "GTA 6"
code_difficulty = "senior"
graphics = "better than reality"
bugs = False
optimization = "maximum"
controls = ["W", "A", "S", "D", "SPACE"]

hackers = True

if hackers:
    print("bimbimbambam")
    hackers = False

print("GTA 6 implementado antes da Rockstar.")
`;

/** Executável pelo interpretador Portugol integrado e usado somente em novos arquivos .gol. */
export const PORTUGOL_EXAMPLE_CONTENT = `algoritmo "Olá, Portugol"

var
  mensagem: literal

inicio
  mensagem <- "Olá, Portugol!"
  escreval(mensagem)
fimalgoritmo
`;

/** Deliberately called only while NPSharp is creating a brand-new file. */
export function initialContentForNewNPSharpFile(name: string): string {
  if (name === GTA6_EASTER_EGG_FILE_NAME) return GTA6_EASTER_EGG_CONTENT;
  return name.trim().toLowerCase().endsWith(PORTUGOL_FILE_EXTENSION) ? PORTUGOL_EXAMPLE_CONTENT : "";
}
