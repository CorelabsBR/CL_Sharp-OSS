/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const configPath = path.join(root, "config.json");
const config = JSON.parse(await fs.readFile(configPath, "utf8"));

validateConfig(config);

const { desktopName, application, npm, electronBuilder, mobile, android } = config;
const packagePath = path.join(root, "package.json");
const packageJson = JSON.parse(await fs.readFile(packagePath, "utf8"));

Object.assign(packageJson, {
  name: application.packageName,
  desktopName: desktopName || application.displayName,
  version: application.version,
  description: application.description,
  main: npm.main,
  type: npm.type,
  author: application.author,
  homepage: application.homepage,
  repository: { type: application.repository.type, url: application.repository.url },
  license: application.license,
  dependencies: npm.dependencies,
  devDependencies: npm.devDependencies,
  optionalDependencies: npm.optionalDependencies,
  build: {
    appId: application.applicationId,
    productName: application.displayName,
    ...electronBuilder
  }
});
await writeJson(packagePath, packageJson);

const lockPath = path.join(root, "package-lock.json");
const lock = JSON.parse(await fs.readFile(lockPath, "utf8"));
lock.name = application.packageName;
lock.version = application.version;
Object.assign(lock.packages[""], {
  name: application.packageName,
  version: application.version,
  license: application.license,
  dependencies: npm.dependencies,
  devDependencies: npm.devDependencies,
  optionalDependencies: npm.optionalDependencies
});
await writeJson(lockPath, lock);

const vscodeApiPath = path.join(root, "packages", "vscode-api", "package.json");
const vscodeApi = JSON.parse(await fs.readFile(vscodeApiPath, "utf8"));
vscodeApi.version = application.version;
await writeJson(vscodeApiPath, vscodeApi);

await writeText(path.join(root, "capacitor.config.ts"), renderCapacitorConfig(application, mobile));
await writeText(path.join(root, "src", "shared", "buildConfig.ts"), renderBuildConfig(application));
await writeText(path.join(root, "packages", "vscode-api", "env.ts"), renderVsCodeApiConfig(application));
await writeText(path.join(root, "android", "variables.gradle"), renderAndroidVariables(android));
await updateText(path.join(root, "android", "build.gradle"), content => content
  .replace(/com\.android\.tools\.build:gradle:[^']+/, `com.android.tools.build:gradle:${android.gradlePluginVersion}`)
  .replace(/com\.google\.gms:google-services:[^']+/, `com.google.gms:google-services:${android.googleServicesPluginVersion}`));
await updateText(path.join(root, "android", "gradle", "wrapper", "gradle-wrapper.properties"), content => content
  .replace(/distributionUrl=https\\:\/\/services\.gradle\.org\/distributions\/gradle-[^-]+-all\.zip/, `distributionUrl=https\\://services.gradle.org/distributions/gradle-${android.gradleDistributionVersion}-all.zip`));
await updateText(path.join(root, "android", "app", "build.gradle"), content => content
  .replace(/namespace\s*=\s*"[^"]+"/, `namespace = "${android.namespace}"`)
  .replace(/applicationId\s+"[^"]+"/, `applicationId "${application.applicationId}"`)
  .replace(/versionCode\s+\d+/, `versionCode ${application.versionCode}`)
  .replace(/versionName\s+"[^"]+"/, `versionName "${application.version}"`));
await updateText(path.join(root, "android", "app", "src", "main", "res", "values", "strings.xml"), () => renderAndroidStrings(application));
await updateText(path.join(root, "android", "app", "src", "main", "java", "br", "com", "corelabs", "sharp", "MainActivity.java"), content => content
  .replace(/^package\s+[^;]+;/m, `package ${android.namespace};`));

function validateConfig(value) {
  const requiredStrings = [
    [value?.application?.packageName, "application.packageName"],
    [value?.application?.displayName, "application.displayName"],
    [value?.application?.version, "application.version"],
    [value?.application?.applicationId, "application.applicationId"],
    [value?.application?.dataDirectoryName, "application.dataDirectoryName"],
    [value?.application?.mobileDataDirectoryName, "application.mobileDataDirectoryName"],
    [value?.android?.namespace, "android.namespace"],
    [value?.mobile?.webDirectory, "mobile.webDirectory"]
  ];
  for (const [entry, name] of requiredStrings) {
    if (typeof entry !== "string" || !entry.trim()) throw new Error(`config.json inválido: ${name} é obrigatório.`);
  }
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(value.application.version)) {
    throw new Error("config.json inválido: application.version deve usar SemVer.");
  }
  if (!Number.isInteger(value.application.versionCode) || value.application.versionCode < 1) {
    throw new Error("config.json inválido: application.versionCode deve ser um inteiro positivo.");
  }
  if (value.application.applicationId !== value.android.namespace) {
    throw new Error("config.json inválido: application.applicationId e android.namespace devem ser iguais.");
  }
}

async function updateText(file, transform) {
  await writeText(file, transform(await fs.readFile(file, "utf8")));
}

async function writeJson(file, value) {
  await writeText(file, `${JSON.stringify(value, null, 2)}\n`);
}

async function writeText(file, content) {
  try {
    if (await fs.readFile(file, "utf8") === content) return;
  } catch {
    // O arquivo será criado abaixo.
  }
  await fs.writeFile(file, content, "utf8");
}

function renderCapacitorConfig(app, platform) {
  return `/*---------------------------------------------------------------------------------------------\n- Copyright (c) CorelabsBR. All rights reserved.\n- Licensed under the MIT License. See License.txt in the project root for license information.\n *--------------------------------------------------------------------------------------------*/\nimport type { CapacitorConfig } from '@capacitor/cli';\n\nconst config: CapacitorConfig = {\n  appId: '${app.applicationId}',\n  appName: '${app.displayName}',\n  webDir: '${platform.webDirectory}',\n  server: {\n    androidScheme: '${platform.androidScheme}'\n  }\n};\n\nexport default config;\n`;
}

function renderBuildConfig(app) {
  const runtimeConfig = {
    packageName: app.packageName,
    displayName: app.displayName,
    version: app.version,
    author: app.author,
    copyrightOwner: app.copyrightOwner,
    applicationId: app.applicationId,
    protocol: app.protocol,
    homepage: app.homepage,
    dataDirectoryName: app.dataDirectoryName,
    mobileDataDirectoryName: app.mobileDataDirectoryName
  };
  return `/*---------------------------------------------------------------------------------------------\n- Copyright (c) CorelabsBR. All rights reserved.\n- Licensed under the MIT License. See License.txt in the project root for license information.\n *--------------------------------------------------------------------------------------------*/\n// Gerado por scripts/sync-project-config.mjs a partir de config.json. Não edite manualmente.\nexport const BUILD_CONFIG = ${JSON.stringify(runtimeConfig, null, 2)} as const;\n`;
}

function renderVsCodeApiConfig(app) {
  return `/*---------------------------------------------------------------------------------------------\n- Copyright (c) CorelabsBR. All rights reserved.\n- Licensed under the MIT License. See License.txt in the project root for license information.\n *--------------------------------------------------------------------------------------------*/\nexport const appName = ${JSON.stringify(app.displayName)};\nexport const appHost = "desktop";\nexport const language = "en";\nexport const machineId = ${JSON.stringify(`${app.protocol}-placeholder`)};\nexport const sessionId = ${JSON.stringify(`${app.protocol}-placeholder-session`)};\nexport const uriScheme = ${JSON.stringify(app.protocol)};\n\nexport async function openExternal(target: string): Promise<boolean> {\n  console.info(\`[${app.displayName} extension] openExternal \${target}\`);\n  return false;\n}\n`;
}

function renderAndroidVariables(platform) {
  const lines = [
    `    minSdkVersion = ${platform.minSdkVersion}`,
    `    compileSdkVersion = ${platform.compileSdkVersion}`,
    `    targetSdkVersion = ${platform.targetSdkVersion}`,
    ...Object.entries(platform.dependencies).map(([name, version]) => `    ${name} = '${version}'`)
  ];
  return `ext {\n${lines.join("\n")}\n}\n`;
}

function renderAndroidStrings(app) {
  const escaped = escapeXml(app.displayName);
  const appId = escapeXml(app.applicationId);
  return `<?xml version='1.0' encoding='utf-8'?>\n<resources>\n    <string name="app_name">${escaped}</string>\n    <string name="title_activity_main">${escaped}</string>\n    <string name="package_name">${appId}</string>\n    <string name="custom_url_scheme">${appId}</string>\n</resources>\n`;
}

function escapeXml(value) {
  return value.replace(/[<>&'\"]/g, character => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", "\"": "&quot;" })[character]);
}
