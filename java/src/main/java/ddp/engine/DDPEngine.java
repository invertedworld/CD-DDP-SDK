package ddp.engine;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.nio.file.*;
import java.util.*;

/**
 * Thin wrappers around the ddp and ddpbuild binaries.
 *
 * <p>{@code process} and friends read a DDP; {@code build} writes one. Licence
 * validation, parsing and writing all run in native code. Reading and writing are
 * separate entitlements, so each takes its own licence key.
 */
public final class DDPEngine {
    private static final String DEFAULT_BIN = "ddp";
    private static final String DEFAULT_BUILD_BIN = "ddpbuild";
    private static final ObjectMapper JSON = new ObjectMapper();

    private DDPEngine() {
    }

    private static String findDDP() {
        String env = System.getenv("DDP_SDK_BIN");
        return env != null ? env : DEFAULT_BIN;
    }

    private static String findDDPBuild() {
        String env = System.getenv("DDP_BUILD_BIN");
        return env != null ? env : DEFAULT_BUILD_BIN;
    }

    /**
     * Run ddpbuild, keeping stdout clean. Progress goes to stderr, so the streams
     * cannot be merged the way the reader's are without corrupting the JSON report;
     * stderr goes to a temp file instead, which also avoids a full-pipe deadlock.
     */
    private static String runDDPBuild(List<String> args) throws IOException {
        Path errFile = Files.createTempFile("ddpbuild-err-", ".txt");
        try {
            ProcessBuilder pb = new ProcessBuilder(args);
            pb.redirectError(errFile.toFile());
            Process proc = pb.start();
            String stdout = new String(proc.getInputStream().readAllBytes());
            int code;
            try {
                code = proc.waitFor();
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new EngineError("Interrupted: " + e.getMessage());
            }
            String stderr = Files.readString(errFile);
            if (code != 0) {
                throw new EngineError(stderr.isEmpty() ? stdout : stderr, stderr);
            }
            return stdout;
        } finally {
            Files.deleteIfExists(errFile);
        }
    }

    /**
     * Build a DDP fileset from a manifest and the WAVs it names. Invokes the
     * ddpbuild binary; licence validation runs natively.
     *
     * <p>The manifest is the same document {@link #process} writes as metadata.json,
     * so a disc that was read can be rebuilt without translating anything. Track
     * paths inside it resolve relative to the manifest.
     *
     * <p>Building requires the {@code ddp:build} entitlement, which is separate from
     * the reader's. A reader licence is refused, and says which entitlement is missing.
     *
     * @return the build report: files written with their MD5s, the track layout,
     *         the lead-out, and any warnings.
     */
    public static JsonNode build(String manifestPath, String outputPath, String licenseKey)
            throws IOException {
        return build(manifestPath, outputPath, licenseKey, false, true, true);
    }

    /** As {@link #build(String, String, String)}, controlling the optional outputs. */
    public static JsonNode build(
            String manifestPath,
            String outputPath,
            String licenseKey,
            boolean strict,
            boolean writeIdent,
            boolean writeChecksum) throws IOException {
        List<String> args = new ArrayList<>(List.of(
                findDDPBuild(), "build", manifestPath, outputPath,
                "--json", "--license-key", licenseKey));
        if (strict) {
            args.add("--strict");
        }
        if (!writeIdent) {
            args.add("--no-ident");
        }
        if (!writeChecksum) {
            args.add("--no-checksum");
        }
        return JSON.readTree(runDDPBuild(args));
    }

    /**
     * Check a manifest and the audio it names, returning the disc layout as text.
     * Writes nothing, and needs no licence key: planning a disc is free.
     */
    public static String validate(String manifestPath, boolean strict) throws IOException {
        List<String> args = new ArrayList<>(List.of(findDDPBuild(), "validate", manifestPath));
        if (strict) {
            args.add("--strict");
        }
        return runDDPBuild(args);
    }

    private static void runDDP(String inputPath, String outputPath, String licenseKey) throws IOException {
        ProcessBuilder pb = new ProcessBuilder(
                findDDP(),
                "process",
                inputPath,
                outputPath,
                "--license-key",
                licenseKey
        );
        pb.redirectErrorStream(true); // merge stderr into stdout to avoid deadlock
        Process proc = pb.start();

        String output = new String(proc.getInputStream().readAllBytes());
        try {
            int code = proc.waitFor();
            if (code != 0) {
                throw new EngineError(output, output);
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new EngineError("Interrupted: " + e.getMessage());
        }
    }

    private static String runDDPJson(String inputPath, String licenseKey, String outputPath) throws IOException {
        List<String> args = new ArrayList<>();
        args.add(findDDP());
        args.add("json");
        args.add(inputPath);
        args.add("--license-key");
        args.add(licenseKey);
        if (outputPath != null) {
            args.add("--output");
            args.add(outputPath);
        }

        ProcessBuilder pb = new ProcessBuilder(args);
        pb.redirectErrorStream(true);
        Process proc = pb.start();
        String output = new String(proc.getInputStream().readAllBytes());
        try {
            int code = proc.waitFor();
            if (code != 0) {
                throw new EngineError(output, output);
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new EngineError("Interrupted: " + e.getMessage());
        }
        if (outputPath != null) {
            return Files.readString(Path.of(outputPath));
        }
        return output;
    }

    /**
     * Process DDP from in-memory files. Writes metadata and WAVs to outputPath.
     * License key validation runs in the native binary. Returns metadata object.
     */
    public static JsonNode processFromBytes(Map<String, byte[]> files, String outputPath, String licenseKey) throws IOException {
        Path inDir = Files.createTempDirectory("ddp-in-");
        try {
            for (Map.Entry<String, byte[]> e : files.entrySet()) {
                String filename = "SD".equals(e.getKey()) ? "SD.SD" : e.getKey();
                Files.write(inDir.resolve(filename), e.getValue());
            }
            String outBase = outputPath.replaceAll("[/\\\\]+$", "");
            runDDP(inDir.toString(), outBase, licenseKey);

            String metaJson = Files.readString(Path.of(outBase, "metadata.json"));
            return JSON.readTree(metaJson);
        } finally {
            deleteRecursive(inDir);
        }
    }

    /**
     * Process DDP from a path (directory or ZIP). Invokes ddp binary.
     * License key validation runs in the native binary.
     * Returns the metadata object (metadata.json contents).
     */
    public static JsonNode process(String inputPath, String outputPath, String licenseKey) throws IOException {
        String outBase = outputPath.replaceAll("[/\\\\]+$", "");
        runDDP(inputPath, outBase, licenseKey);
        String metaJson = Files.readString(Path.of(outBase, "metadata.json"));
        return JSON.readTree(metaJson);
    }

    /**
     * Extract metadata JSON only (no WAV files). Invokes ddp binary.
     * License key validation runs in the native binary.
     * Returns the metadata object. If outputPath is non-null, also writes metadata.json there.
     */
    public static JsonNode processToJson(String inputPath, String licenseKey, String outputPath) throws IOException {
        String jsonStr = runDDPJson(inputPath, licenseKey, outputPath);
        return JSON.readTree(jsonStr);
    }

    /** Same as processToJson(inputPath, licenseKey, null) — metadata only, no file write. */
    public static JsonNode processToJson(String inputPath, String licenseKey) throws IOException {
        return processToJson(inputPath, licenseKey, null);
    }

    private static void deleteRecursive(Path p) {
        try {
            if (Files.exists(p)) {
                Files.walk(p)
                        .sorted(Comparator.reverseOrder())
                        .forEach(path -> {
                            try {
                                Files.delete(path);
                            } catch (IOException ignored) {}
                        });
            }
        } catch (IOException ignored) {}
    }

}
