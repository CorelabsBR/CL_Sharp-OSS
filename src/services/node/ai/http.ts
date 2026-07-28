/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
export interface JsonRecord {
  [key: string]: unknown;
}

export async function checkedFetch(url: string, init: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new Error(`Could not connect to AI provider at ${safeOrigin(url)}: ${errorMessage(error)}`);
  }
  if (response.ok) return response;
  const body = await response.text();
  let detail = body.slice(0, 800);
  try {
    const parsed = JSON.parse(body) as JsonRecord;
    const nested = asRecord(parsed.error);
    detail = stringValue(nested?.message) ?? stringValue(parsed.message) ?? detail;
  } catch {
    // Provider returned a non-JSON error.
  }
  throw new Error(`AI provider request failed (${response.status} ${response.statusText}): ${detail || "No details"}`);
}

export async function* readSse(response: Response): AsyncIterable<JsonRecord> {
  if (!response.body) throw new Error("AI provider returned an empty streaming response.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      buffer += decoder.decode(result.value, { stream: true });
      const events = buffer.split(/\r?\n\r?\n/u);
      buffer = events.pop() ?? "";
      for (const event of events) {
        const payload = event.split(/\r?\n/u)
          .filter(line => line.startsWith("data:"))
          .map(line => line.slice(5).trimStart())
          .join("\n");
        if (!payload || payload === "[DONE]") continue;
        yield parseJson(payload);
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) {
      const payload = buffer.split(/\r?\n/u)
        .filter(line => line.startsWith("data:"))
        .map(line => line.slice(5).trimStart())
        .join("\n");
      if (payload && payload !== "[DONE]") yield parseJson(payload);
    }
  } finally {
    reader.releaseLock();
  }
}

export async function* readNdjson(response: Response): AsyncIterable<JsonRecord> {
  if (!response.body) throw new Error("AI provider returned an empty streaming response.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      buffer += decoder.decode(result.value, { stream: true });
      const lines = buffer.split(/\r?\n/u);
      buffer = lines.pop() ?? "";
      for (const line of lines) if (line.trim()) yield parseJson(line);
    }
    buffer += decoder.decode();
    if (buffer.trim()) yield parseJson(buffer);
  } finally {
    reader.releaseLock();
  }
}

export function asRecord(value: unknown): JsonRecord | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as JsonRecord
    : undefined;
}

export function asRecords(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.map(asRecord).filter((item): item is JsonRecord => Boolean(item)) : [];
}

export function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function parseJson(value: string): JsonRecord {
  try {
    return JSON.parse(value) as JsonRecord;
  } catch {
    throw new Error(`AI provider returned invalid streaming JSON: ${value.slice(0, 200)}`);
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function safeOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return "configured endpoint";
  }
}

