"use strict";
/**
 * DDP SDK client — thin wrapper around the ddp binary.
 * API key validation and parsing run in native code.
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
const child_process_1 = require("child_process");
const fs = __importStar(require("fs/promises"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const util_1 = require("util");
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
const DDP_BIN = "ddp";
function findDdp() {
    return globalThis.process.env["DDP_SDK_BIN"] ?? DDP_BIN;
}
class EngineError extends Error {
    constructor(message, stderr = "") {
        super(message);
        this.stderr = stderr;
        this.name = "EngineError";
    }
}
exports.EngineError = EngineError;
async function runDdp(inputPath, outputPath, apiKey) {
    try {
        await execFileAsync(findDdp(), ["process", inputPath, outputPath, "--license-key", licenseKey], {
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
async function runDdpJson(inputPath, apiKey, outputPath) {
    const args = ["json", inputPath, "--license-key", licenseKey];
    if (outputPath !== undefined) {
        args.push("--output", outputPath);
    }
    try {
        const { stdout } = await execFileAsync(findDdp(), args, {
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
 * Process DDP from in-memory files. Writes to temp dir, invokes ddp binary, returns results.
 * API key validation runs in the native binary.
 */
async function processFromBytes(files, apiKey) {
    const inDir = await fs.mkdtemp(path.join(os.tmpdir(), "ddp-in-"));
    try {
        for (const [name, data] of Object.entries(files)) {
            const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
            await fs.writeFile(path.join(inDir, name), buf);
        }
        const outDir = await fs.mkdtemp(path.join(os.tmpdir(), "ddp-out-"));
        try {
            await runDdp(inDir, outDir, apiKey);
            const metaPath = path.join(outDir, "metadata.json");
            const metaJson = await fs.readFile(metaPath, "utf-8");
            const metadata = JSON.parse(metaJson);
            const wavs = [];
            const entries = await fs.readdir(outDir);
            for (const fname of entries.sort()) {
                if (fname.endsWith(".wav")) {
                    const data = await fs.readFile(path.join(outDir, fname));
                    wavs.push([fname, data]);
                }
            }
            return { metadata, wavs };
        }
        finally {
            await fs.rm(outDir, { recursive: true, force: true });
        }
    }
    finally {
        await fs.rm(inDir, { recursive: true, force: true });
    }
}
/**
 * Process DDP from a path (directory or ZIP). Invokes ddp binary.
 * API key validation runs in the native binary.
 * Returns the metadata object (metadata.json contents).
 */
async function process(inputPath, outputPath, apiKey) {
    await runDdp(inputPath, outputPath.replace(/\/$/, ""), apiKey);
    const metaPath = path.join(outputPath.replace(/\/$/, ""), "metadata.json");
    const metaJson = await fs.readFile(metaPath, "utf-8");
    return JSON.parse(metaJson);
}
/**
 * Extract metadata JSON only (no WAV files). Invokes ddp binary.
 * API key validation runs in the native binary.
 * Returns the metadata object. If outputPath is given, also writes metadata.json there.
 */
async function processToJson(inputPath, apiKey, options) {
    const jsonStr = await runDdpJson(inputPath, apiKey, options?.outputPath);
    return JSON.parse(jsonStr);
}
