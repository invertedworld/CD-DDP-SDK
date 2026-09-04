/**
 * DDP SDK client — thin wrapper around the ddp binary.
 * License key validation and parsing run in native code.
 */
export declare class EngineError extends Error {
    stderr: string;
    constructor(message: string, stderr?: string);
}
/**
 * Process DDP from in-memory files. Writes metadata and WAVs to outputPath.
 * License key validation runs in the native binary. Returns metadata object.
 */
export declare function processFromBytes(files: Record<string, Buffer | Uint8Array>, outputPath: string, licenseKey: string): Promise<object>;
/**
 * Process DDP from a path (directory or ZIP). Invokes ddp binary.
 * License key validation runs in the native binary.
 * Returns the metadata object (metadata.json contents).
 */
export declare function process(inputPath: string, outputPath: string, licenseKey: string): Promise<object>;
/**
 * Extract metadata JSON only (no WAV files). Invokes ddp binary.
 * License key validation runs in the native binary.
 * Returns the metadata object. If outputPath is given, also writes metadata.json there.
 */
export declare function processToJson(inputPath: string, licenseKey: string, options?: {
    outputPath?: string;
}): Promise<object>;
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
export declare function build(manifestPath: string, outputPath: string, licenseKey: string, options?: BuildOptions): Promise<object>;
/**
 * Check a manifest and the audio it names, and return the disc layout as text.
 * Writes nothing, and needs no licence key: planning a disc is free.
 */
export declare function validate(manifestPath: string, options?: {
    strict?: boolean;
}): Promise<string>;
