import fs from "node:fs/promises";
import path from "node:path";
import type {
  ArduinoBoard,
  ArduinoBoardPort,
  ArduinoCliInfo,
  ArduinoCliRequest,
  ArduinoCompileRequest,
  ArduinoConfig,
  ArduinoConfigRequest,
  ArduinoCreateSketchRequest,
  ArduinoMonitorRequest,
  ArduinoOperationResult,
  ArduinoSaveConfigRequest,
  ArduinoSketchResult,
  ArduinoUploadRequest
} from "../../shared/types";
import { npsharpHome } from "./paths";
import { commandExists, runProcess } from "./processService";

const DEFAULT_BAUD_RATE = 9600;
const DEFAULT_CONFIG: ArduinoConfig = {
  baudRate: DEFAULT_BAUD_RATE
};

export async function detectArduinoCli(request: ArduinoCliRequest = {}): Promise<ArduinoCliInfo> {
  const cli = await resolveArduinoCli(request.cliPath);
  if (!cli) {
    return {
      available: false,
      message: "Arduino CLI nao encontrado no PATH. Instale arduino-cli ou configure o caminho."
    };
  }

  const result = await runProcess(cli, ["version"], { timeoutMs: 15000 });
  return {
    available: (result.code ?? 1) === 0,
    path: cli,
    version: result.output,
    message: (result.code ?? 1) === 0 ? "Arduino CLI detectado." : result.output
  };
}

export async function loadArduinoConfig(request: ArduinoConfigRequest): Promise<ArduinoConfig> {
  const file = arduinoConfigPath(request.workspace);
  try {
    const raw = await fs.readFile(file, "utf8");
    return normalizeConfig(JSON.parse(raw) as Partial<ArduinoConfig>);
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function saveArduinoConfig(request: ArduinoSaveConfigRequest): Promise<ArduinoConfig> {
  const current = await loadArduinoConfig(request);
  const next = normalizeConfig({ ...current, ...request.config });
  const file = arduinoConfigPath(request.workspace);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return next;
}

export async function listArduinoPorts(request: ArduinoCliRequest = {}): Promise<ArduinoBoardPort[]> {
  const cli = await requireArduinoCli(request);
  const result = await runProcess(cli, ["board", "list"], { timeoutMs: 20000 });
  if ((result.code ?? 1) !== 0) throw new Error(result.output || "arduino-cli board list falhou.");
  return parseBoardList(result.output);
}

export async function listArduinoBoards(request: ArduinoCliRequest = {}): Promise<ArduinoBoard[]> {
  const cli = await requireArduinoCli(request);
  const result = await runProcess(cli, ["board", "listall"], { timeoutMs: 30000 });
  if ((result.code ?? 1) !== 0) throw new Error(result.output || "arduino-cli board listall falhou.");
  return parseBoardListAll(result.output);
}

export async function createArduinoSketch(request: ArduinoCreateSketchRequest): Promise<ArduinoSketchResult> {
  const name = sanitizeSketchName(request.name);
  const root = request.workspace?.trim() || path.join(npsharpHome(), "arduino");
  const sketchPath = path.join(root, name);
  const filePath = path.join(sketchPath, `${name}.ino`);
  const content = `void setup() {\n  Serial.begin(${DEFAULT_BAUD_RATE});\n}\n\nvoid loop() {\n}\n`;

  await fs.mkdir(sketchPath, { recursive: true });
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, content, "utf8");
  }

  const config = await saveArduinoConfig({ workspace: request.workspace, config: { sketchPath } });
  return { sketchPath, filePath, config };
}

export async function compileArduinoSketch(request: ArduinoCompileRequest): Promise<ArduinoOperationResult> {
  const cli = await requireArduinoCli(request);
  const result = await runProcess(cli, ["compile", "--fqbn", request.fqbn, request.sketchPath], {
    cwd: request.sketchPath,
    timeoutMs: 180000
  });
  await saveArduinoConfig({
    workspace: request.workspace,
    config: { cliPath: request.cliPath, selectedBoardFqbn: request.fqbn, sketchPath: request.sketchPath }
  });
  return operationResult(result.output, result.code);
}

export async function uploadArduinoSketch(request: ArduinoUploadRequest): Promise<ArduinoOperationResult> {
  const cli = await requireArduinoCli(request);
  const result = await runProcess(cli, ["upload", "-p", request.port, "--fqbn", request.fqbn, request.sketchPath], {
    cwd: request.sketchPath,
    timeoutMs: 180000
  });
  await saveArduinoConfig({
    workspace: request.workspace,
    config: {
      cliPath: request.cliPath,
      selectedBoardFqbn: request.fqbn,
      selectedPort: request.port,
      sketchPath: request.sketchPath
    }
  });
  return operationResult(result.output, result.code);
}

export async function monitorArduinoSerial(request: ArduinoMonitorRequest): Promise<ArduinoOperationResult> {
  const cli = await requireArduinoCli(request);
  const args = ["monitor", "-p", request.port, "-c", `baudrate=${request.baudRate}`];
  if (request.fqbn) args.push("--fqbn", request.fqbn);
  const result = await runProcess(cli, args, { timeoutMs: request.durationMs ?? 10000 });
  await saveArduinoConfig({
    workspace: request.workspace,
    config: {
      cliPath: request.cliPath,
      selectedBoardFqbn: request.fqbn,
      selectedPort: request.port,
      baudRate: request.baudRate
    }
  });
  return operationResult(result.output, result.code);
}

async function requireArduinoCli(request: ArduinoCliRequest): Promise<string> {
  const cli = await resolveArduinoCli(request.cliPath);
  if (!cli) throw new Error("Arduino CLI nao encontrado no PATH.");
  return cli;
}

async function resolveArduinoCli(configuredPath?: string): Promise<string | undefined> {
  if (configuredPath?.trim()) {
    const configured = await commandExists(configuredPath.trim());
    if (configured) return configured;
  }
  return commandExists("arduino-cli");
}

function arduinoConfigPath(workspace?: string): string {
  return workspace?.trim()
    ? path.join(workspace.trim(), ".npsharp", "arduino.json")
    : path.join(npsharpHome(), "arduino.json");
}

function normalizeConfig(config: Partial<ArduinoConfig>): ArduinoConfig {
  return {
    cliPath: cleanString(config.cliPath),
    selectedBoardFqbn: cleanString(config.selectedBoardFqbn),
    selectedPort: cleanString(config.selectedPort),
    baudRate: Number(config.baudRate) || DEFAULT_BAUD_RATE,
    sketchPath: cleanString(config.sketchPath)
  };
}

function cleanString(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function parseBoardList(output: string): ArduinoBoardPort[] {
  return output
    .split(/\r?\n/)
    .map(line => line.trimEnd())
    .filter(line => line && !/^Port\s+/i.test(line) && !/^No boards/i.test(line))
    .map(line => {
      const columns = splitColumns(line);
      return {
        port: columns[0] ?? line,
        protocol: columns[1],
        type: columns[2],
        boardName: columns[3],
        fqbn: columns[4],
        core: columns[5],
        raw: line
      };
    });
}

function parseBoardListAll(output: string): ArduinoBoard[] {
  return output
    .split(/\r?\n/)
    .map(line => line.trimEnd())
    .filter(line => line && !/^Board Name\s+/i.test(line))
    .map(line => {
      const columns = splitColumns(line);
      const fqbn = columns.at(-1) ?? "";
      const name = columns.length > 1 ? columns.slice(0, -1).join(" ").trim() : line;
      return { name: name || fqbn, fqbn, raw: line };
    })
    .filter(board => board.fqbn.includes(":"));
}

function splitColumns(line: string): string[] {
  return line.trim().split(/\s{2,}/).map(column => column.trim()).filter(Boolean);
}

function sanitizeSketchName(name: string): string {
  const sanitized = name.trim().replace(/[^A-Za-z0-9_]/g, "_").replace(/^_+/, "");
  return sanitized || "Blink";
}

function operationResult(output: string, code: number | null): ArduinoOperationResult {
  return {
    success: (code ?? 1) === 0,
    output: output || ((code ?? 1) === 0 ? "Comando Arduino concluido." : "Comando Arduino falhou."),
    code
  };
}
