/**
 * DDP SDK client — thin wrapper around the ddp binary.
 * License key validation and parsing run in native code.
 */

import { execFile } from "child_process";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const DDP_BIN = "ddp";
const DDPBUILD_BIN = "ddpbuild";

function findDDP(): string {
  return globalThis.process.env["DDP_SDK_BIN"] ?? DDP_BIN;
}

function findDDPBuild(): string {
  return globalThis.process.env["DDP_BUILD_BIN"] ?? DDPBUILD_BIN;
}

async function run(bin: string, args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync(bin, args, { encoding: "utf-8", maxBuffer: 1 << 24 });
    return stdout;
  } catch (err: unknown) {
    const e = err as { code?: number; stderr?: string; stdout?: string };
    const stderr = e.stderr ?? "";
    const msg = stderr || (e.stdout as string) || `${bin} exited with code ${e.code ?? "unknown"}`;
    throw new EngineError(msg, stderr);
  }
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
  licenseKey: string
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
  licenseKey: string,
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
 * License key validation runs in the native binary. Returns metadata object.
 */
export async function processFromBytes(
  files: Record<string, Buffer | Uint8Array>,
  outputPath: string,
  licenseKey: string
): Promise<object> {
  const inDir = await fs.mkdtemp(path.join(os.tmpdir(), "ddp-in-"));
  try {
    for (const [name, data] of Object.entries(files)) {
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
      const filename = name === "SD" ? "SD.SD" : name;
      await fs.writeFile(path.join(inDir, filename), buf);
    }

    const outBase = outputPath.replace(/\/$/, "");
    await runDDP(inDir, outBase, licenseKey);
    const metaPath = path.join(outBase, "metadata.json");
    const metaJson = await fs.readFile(metaPath, "utf-8");
    return JSON.parse(metaJson) as object;
  } finally {
    await fs.rm(inDir, { recursive: true, force: true });
  }
}

/**
 * Process DDP from a path (directory or ZIP). Invokes ddp binary.
 * License key validation runs in the native binary.
 * Returns the metadata object (metadata.json contents).
 */
export async function process(
  inputPath: string,
  outputPath: string,
  licenseKey: string
): Promise<object> {
  const outBase = outputPath.replace(/\/$/, "");
  await runDDP(inputPath, outBase, licenseKey);
  const metaPath = path.join(outBase, "metadata.json");
  const metaJson = await fs.readFile(metaPath, "utf-8");
  return JSON.parse(metaJson) as object;
}

/**
 * Extract metadata JSON only (no WAV files). Invokes ddp binary.
 * License key validation runs in the native binary.
 * Returns the metadata object. If outputPath is given, also writes metadata.json there.
 */
export async function processToJson(
  inputPath: string,
  licenseKey: string,
  options?: { outputPath?: string }
): Promise<object> {
  const jsonStr = await runDDPJson(
    inputPath,
    licenseKey,
    options?.outputPath
  );
  return JSON.parse(jsonStr) as object;
}

/** Options for {@link build}. */
export interface BuildOptions {
  /** Treat warnings as errors. */
  strict?: boolean;
  /** Write IDENT.TXT. Defaults to true. */
  writeIdent?: boolean;
  /** Write CHECKSUM.MD5. Defaults to true. */
  writeChecksum?: boolean;
}

/**
 * Build a DDP fileset from a manifest and the WAVs it names. Invokes the
 * ddpbuild binary; licence validation runs natively.
 *
 * The manifest is the same document {@link process} writes as metadata.json, so
 * a disc that was read can be rebuilt without translating anything. Track paths
 * inside it resolve relative to the manifest.
 *
 * Building requires the `ddp:build` entitlement, which is separate from the
 * reader's. A reader licence is refused, and says which entitlement is missing.
 *
 * Returns the build report: the files written with their MD5s, the track
 * layout, the lead-out, and any warnings.
 */
export async function build(
  manifestPath: string,
  outputPath: string,
  licenseKey: string,
  options?: BuildOptions
): Promise<object> {
  const args = [
    "build",
    manifestPath,
    outputPath,
    "--json",
    "--license-key",
    licenseKey,
  ];
  if (options?.strict === true) args.push("--strict");
  if (options?.writeIdent === false) args.push("--no-ident");
  if (options?.writeChecksum === false) args.push("--no-checksum");
  return JSON.parse(await run(findDDPBuild(), args)) as object;
}

/**
 * Check a manifest and the audio it names, and return the disc layout as text.
 * Writes nothing, and needs no licence key: planning a disc is free.
 */
export async function validate(
  manifestPath: string,
  options?: { strict?: boolean }
): Promise<string> {
  const args = ["validate", manifestPath];
  if (options?.strict === true) args.push("--strict");
  return run(findDDPBuild(), args);
}
