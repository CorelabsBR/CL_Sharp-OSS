/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
export interface FolderIcon {
    closed: string;
    opened: string;
}

const make = (name: string): FolderIcon => ({
    closed: `${name}.svg`,
    opened: `${name}-open.svg`
});

export const FolderIcons: Record<string, FolderIcon> = {

    ".npsharp": make("npsharp"),

    ".github": make("github"),

    ".vscode": make("vscode"),

    "src": make("src"),

    "assets": make("assets"),

    "public": make("public"),

    "images": make("images"),

    "img": make("images"),

    "docs": make("docs"),

    "config": make("config"),

    "configs": make("config"),

    "dist": make("dist"),

    "build": make("build"),

    "release": make("release"),

    "bin": make("bin"),

    "test": make("test"),

    "tests": make("test"),

    "node_modules": make("node"),

    "database": make("database"),

    "db": make("database"),

    "migrations": make("database"),

    "models": make("model"),

    "controllers": make("controller"),

    "routes": make("route"),

    "services": make("service"),

    "api": make("api"),

    "android": make("android"),

    "ios": make("ios"),

    "linux": make("linux"),

    "windows": make("windows")
};