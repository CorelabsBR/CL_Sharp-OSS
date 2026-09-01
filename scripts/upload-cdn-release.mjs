/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { createHash } from "node:crypto";
import { createReadStream, existsSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { buildUploadRequestArgs } from "./upload-cdn-request.mjs";

const [command, ...args] = process.argv.slice(2);
const uploadKey = requireEnvironment("CDN_UPLOAD_KEY");

if (command === "upload") {
  const uploadUrl = requireHttpsEnvironment("CDN_UPLOAD_URL");
  const options = parseOptions(args);
  const repository = requireOption(options, "repository");
  const version = requireOption(options, "version");
  const platform = requireOption(options, "platform");
  const files = options.file ?? [];

  if (files.length === 0) throw new Error("At least one --file is required.");
  for (const file of files) await uploadFile({ uploadUrl, repository, version, platform, file });
} else if (command === "finalize") {
  const finalizeUrl = requireHttpsEnvironment("CDN_FINALIZE_URL");
  const options = parseOptions(args);
  finalizeRelease({
    finalizeUrl,
    repository: requireOption(options, "repository"),
    tag: requireOption(options, "tag"),
    commitSha: requireOption(options, "commit-sha"),
    title: requireOption(options, "title"),
    date: requireOption(options, "date"),
    notesFile: requireOption(options, "notes-file"),
  });
} else {
  throw new Error("Usage: upload-cdn-release.mjs <upload|finalize> [options]");
}

async function uploadFile({ uploadUrl, repository, version, platform, file }) {
  const filePath = resolve(file);
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    throw new Error(`Release file not found: ${file}`);
  }

  const sha256 = await hashFile(filePath);
  const size = statSync(filePath).size;
  const response = curlJson(uploadUrl, buildUploadRequestArgs({ repository, version, platform, sha256, filePath }));

  validateResponse(response, `upload ${basename(filePath)}`);
  const serverHash = response.sha256 ?? response.hash;
  if (serverHash && serverHash.toLowerCase() !== sha256) {
    throw new Error(`CDN hash mismatch for ${basename(filePath)}.`);
  }
  console.log(`Uploaded ${basename(filePath)} (${response.size ?? size} bytes, SHA-256 ${sha256}) as ${response.filename ?? response.name ?? basename(filePath)}`);
}

function finalizeRelease({ finalizeUrl, repository, tag, commitSha, title, date, notesFile }) {
  const payloadPath = resolve(tmpdir(), `npsharp-cdn-finalize-${randomUUID()}.json`);
  writeFileSync(payloadPath, JSON.stringify({
    repository,
    tag,
    commitSha,
    title,
    date,
    releaseNotes: readFileSync(resolve(notesFile), "utf8"),
  }));

  try {
    const response = curlJson(finalizeUrl, [
      "--header", "Content-Type: application/json",
      "--data-binary", `@${payloadPath}`,
    ]);
    validateResponse(response, `finalize ${tag}`);
    const missing = response.missing ?? response.missingFiles;
    if (Array.isArray(missing) && missing.length > 0) {
      throw new Error(`CDN refused finalization; missing files: ${missing.join(", ")}`);
    }
    console.log(`CDN finalized ${tag}${response.releaseUrl ? ` at ${response.releaseUrl}` : ""}.`);
  } finally {
    if (existsSync(payloadPath)) unlinkSync(payloadPath);
  }
}

function curlJson(url, requestArgs) {
  const responsePath = resolve(tmpdir(), `npsharp-cdn-response-${randomUUID()}.json`);
  const curlArgs = [
    "--silent", "--show-error", "--fail-with-body",
    "--retry", "4", "--retry-delay", "5", "--retry-max-time", "1800", "--retry-all-errors",
    "--connect-timeout", "30", "--max-time", "7200",
    "--header", `Authorization: Bearer ${uploadKey}`,
    "--output", responsePath,
    "--write-out", "%{http_code}",
    ...requestArgs,
    url,
  ];
  const result = spawnSync("curl", curlArgs, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

  try {
    const body = existsSync(responsePath) ? readFileSync(responsePath, "utf8") : "";
    if (result.status !== 0) {
      throw new Error(`CDN request failed (HTTP ${result.stdout || "unknown"}): ${safeMessage(body || result.stderr)}`);
    }
    let response;
    try {
      response = JSON.parse(body);
    } catch {
      throw new Error(`CDN returned invalid JSON (HTTP ${result.stdout}): ${safeMessage(body)}`);
    }
    return response;
  } finally {
    if (existsSync(responsePath)) unlinkSync(responsePath);
  }
}

function validateResponse(response, operation) {
  if (!response || response.ok !== true) {
    throw new Error(`CDN did not confirm ${operation}: ${safeMessage(response?.error ?? response?.message ?? JSON.stringify(response))}`);
  }
}

function hashFile(file) {
  const hash = createHash("sha256");
  const fd = createReadStream(file);
  return new Promise((resolveHash, reject) => {
    fd.on("data", (chunk) => hash.update(chunk));
    fd.on("end", () => resolveHash(hash.digest("hex")));
    fd.on("error", reject);
  });
}

function parseOptions(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 2) {
    const key = values[index]?.replace(/^--/, "");
    const value = values[index + 1];
    if (!key || value === undefined) throw new Error(`Invalid argument: ${values[index] ?? "<missing>"}`);
    if (key === "file") parsed.file = [...(parsed.file ?? []), value];
    else parsed[key] = value;
  }
  return parsed;
}

function requireEnvironment(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Required environment variable ${name} is not set.`);
  return value;
}

function requireHttpsEnvironment(name) {
  const value = requireEnvironment(name);
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid absolute URL.`);
  }
  if (url.protocol !== "https:") throw new Error(`${name} must use HTTPS.`);
  return url.href;
}

function requireOption(options, name) {
  const value = options[name];
  if (!value) throw new Error(`Required option --${name} is missing.`);
  return value;
}

function safeMessage(value) {
  return String(value || "No response body").replaceAll(uploadKey, "[REDACTED]").slice(0, 2000);
}
