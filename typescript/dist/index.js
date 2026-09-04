"use strict";
/**
 * DDP SDK client — thin wrapper around the ddp binary.
 * License key validation and parsing run in native code.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.EngineError = void 0;
exports.processFromBytes = processFromBytes;
exports.process = process;
exports.processToJson = processToJson;
exports.build = build;
exports.validate = validate;
const child_process_1 = require("child_process");
const fs = __importStar(require("fs/promises"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const util_1 = require("util");
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
const DDP_BIN = "ddp";
const DDPBUILD_BIN = "ddpbuild";
function findDDP() {
    return globalThis.process.env["DDP_SDK_BIN"] ?? DDP_BIN;
}
function findDDPBuild() {
    return globalThis.process.env["DDP_BUILD_BIN"] ?? DDPBUILD_BIN;
}
async function run(bin, args) {
    try {
        const { stdout } = await execFileAsync(bin, args, { encoding: "utf-8", maxBuffer: 1 << 24 });
        return stdout;
    }
    catch (err) {
        const e = err;
        const stderr = e.stderr ?? "";
        const msg = stderr || e.stdout || `${bin} exited with code ${e.code ?? "unknown"}`;
        throw new EngineError(msg, stderr);
    }
}
class EngineError extends Error {
    constructor(message, stderr = "") {
        super(message);
        this.stderr = stderr;
        this.name = "EngineError";
    }
}
exports.EngineError = EngineError;
async function runDDP(inputPath, outputPath, licenseKey) {
    try {
        await execFileAsync(findDDP(), ["process", inputPath, outputPath, "--license-key", licenseKey], {
            encoding: "utf-8",
        });
    }
    catch (err) {
        const e = err;
        const stderr = e.stderr ?? "";
        const msg = stderr || e.stdout || `ddp exited with code ${e.code ?? "unknown"}`;
        throw new EngineError(msg, stderr);
    }
}
async function runDDPJson(inputPath, licenseKey, outputPath) {
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
    }
    catch (err) {
        const e = err;
        const stderr = e.stderr ?? "";
        const msg = stderr || e.stdout || `ddp exited with code ${e.code ?? "unknown"}`;
        throw new EngineError(msg, stderr);
    }
}
/**
 * Process DDP from in-memory files. Writes metadata and WAVs to outputPath.
 * License key validation runs in the native binary. Returns metadata object.
 */
async function processFromBytes(files, outputPath, licenseKey) {
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
        return JSON.parse(metaJson);
    }
    finally {
        await fs.rm(inDir, { recursive: true, force: true });
    }
}
/**
 * Process DDP from a path (directory or ZIP). Invokes ddp binary.
 * License key validation runs in the native binary.
 * Returns the metadata object (metadata.json contents).
 */
async function process(inputPath, outputPath, licenseKey) {
    const outBase = outputPath.replace(/\/$/, "");
    await runDDP(inputPath, outBase, licenseKey);
    const metaPath = path.join(outBase, "metadata.json");
    const metaJson = await fs.readFile(metaPath, "utf-8");
    return JSON.parse(metaJson);
}
/**
 * Extract metadata JSON only (no WAV files). Invokes ddp binary.
 * License key validation runs in the native binary.
 * Returns the metadata object. If outputPath is given, also writes metadata.json there.
 */
async function processToJson(inputPath, licenseKey, options) {
    const jsonStr = await runDDPJson(inputPath, licenseKey, options?.outputPath);
    return JSON.parse(jsonStr);
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
async function build(manifestPath, outputPath, licenseKey, options) {
    const args = [
        "build",
        manifestPath,
        outputPath,
        "--json",
        "--license-key",
        licenseKey,
    ];
    if (options?.strict === true)
        args.push("--strict");
    if (options?.writeIdent === false)
        args.push("--no-ident");
    if (options?.writeChecksum === false)
        args.push("--no-checksum");
    return JSON.parse(await run(findDDPBuild(), args));
}
/**
 * Check a manifest and the audio it names, and return the disc layout as text.
 * Writes nothing, and needs no licence key: planning a disc is free.
 */
async function validate(manifestPath, options) {
    const args = ["validate", manifestPath];
    if (options?.strict === true)
        args.push("--strict");
    return run(findDDPBuild(), args);
}
