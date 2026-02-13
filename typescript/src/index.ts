/**
 * DDP SDK client — thin wrapper around the ddp binary.
 * API key validation and parsing run in native code.
 */

import { execFile } from "child_process";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const DDP_BIN = "ddp";

function findDDP(): string {
  return globalThis.process.env["DDP_SDK_BIN"] ?? DDP_BIN;
}

export class EngineError extends Error {
  constructor(
    message: string,
    public stderr: string = ""
  ) {
    super(message);
    this.name = "EngineError";
  }
}

async function runDDP(
  inputPath: string,
  outputPath: string,
  apiKey: string
): Promise<void> {
  try {
    await execFileAsync(findDDP(), ["process", inputPath, outputPath, "--license-key", licenseKey], {
      encoding: "utf-8",
    });
  } catch (err: unknown) {
    const e = err as { code?: number; stderr?: string; stdout?: string };
    const stderr = e.stderr ?? "";
    const msg = stderr || (e.stdout as string) || `ddp exited with code ${e.code ?? "unknown"}`;
    throw new EngineError(msg, stderr);
  }
}

async function runDDPJson(
  inputPath: string,
  apiKey: string,
  outputPath?: string
): Promise<string> {
  const args = ["json", inputPath, "--license-key", licenseKey];
  if (outputPath !== undefined) {
    args.push("--output", outputPath);
  }
  try {
    const { stdout } = await execFileAsync(findDDP(), args, {
      encoding: "utf-8",
    });
    if (outputPath !== undefined) {
      const metaJson = await fs.readFile(outputPath, "utf-8");
      return metaJson;
    }
    return stdout;
  } catch (err: unknown) {
    const e = err as { code?: number; stderr?: string; stdout?: string };
    const stderr = e.stderr ?? "";
    const msg = stderr || (e.stdout as string) || `ddp exited with code ${e.code ?? "unknown"}`;
    throw new EngineError(msg, stderr);
  }
}

/**
 * Process DDP from in-memory files. Writes metadata and WAVs to outputPath.
 * API key validation runs in the native binary. Returns metadata object.
 */
export async function processFromBytes(
  files: Record<string, Buffer | Uint8Array>,
  outputPath: string,
  apiKey: string
): Promise<object> {
  const inDir = await fs.mkdtemp(path.join(os.tmpdir(), "ddp-in-"));
  try {
    for (const [name, data] of Object.entries(files)) {
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
      const filename = name === "SD" ? "SD.SD" : name;
      await fs.writeFile(path.join(inDir, filename), buf);
    }

    const outBase = outputPath.replace(/\/$/, "");
    await runDDP(inDir, outBase, apiKey);
    const metaPath = path.join(outBase, "metadata.json");
    const metaJson = await fs.readFile(metaPath, "utf-8");
    return JSON.parse(metaJson) as object;
  } finally {
    await fs.rm(inDir, { recursive: true, force: true });
  }
}

/**
 * Process DDP from a path (directory or ZIP). Invokes ddp binary.
 * API key validation runs in the native binary.
 * Returns the metadata object (metadata.json contents).
 */
export async function process(
  inputPath: string,
  outputPath: string,
  apiKey: string
): Promise<object> {
  const outBase = outputPath.replace(/\/$/, "");
  await runDDP(inputPath, outBase, apiKey);
  const metaPath = path.join(outBase, "metadata.json");
  const metaJson = await fs.readFile(metaPath, "utf-8");
  return JSON.parse(metaJson) as object;
}

/**
 * Extract metadata JSON only (no WAV files). Invokes ddp binary.
 * API key validation runs in the native binary.
 * Returns the metadata object. If outputPath is given, also writes metadata.json there.
 */
export async function processToJson(
  inputPath: string,
  apiKey: string,
  options?: { outputPath?: string }
): Promise<object> {
  const jsonStr = await runDDPJson(
    inputPath,
    apiKey,
    options?.outputPath
  );
  return JSON.parse(jsonStr) as object;
}
