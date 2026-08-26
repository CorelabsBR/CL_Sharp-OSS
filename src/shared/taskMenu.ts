/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface TaskMenuActionSet {
  runProject: () => void | Promise<void>;
  buildProject: () => void | Promise<void>;
  runDebug: () => void | Promise<void>;
  openTerminal: () => void | Promise<void>;
  openNotes?: () => void | Promise<void>;
}

export interface TaskMenuItem {
  label: string;
  hint: string;
  run: () => void | Promise<void>;
}

export function buildTaskMenuItems(actions: TaskMenuActionSet): TaskMenuItem[] {
  return [
    { label: "Executar projeto", hint: "Ctrl+F5", run: () => void actions.runProject() },
    { label: "Compilar projeto", hint: "Build", run: () => void actions.buildProject() },
    { label: "Executar e depurar", hint: "F5", run: () => void actions.runDebug() },
    { label: "Abrir terminal", hint: "Ctrl+`", run: () => void actions.openTerminal() },
    ...(actions.openNotes ? [{ label: "Abrir notas", hint: "Notas", run: () => void actions.openNotes?.() }] : [])
  ];
}
