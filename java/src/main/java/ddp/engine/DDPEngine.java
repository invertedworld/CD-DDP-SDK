package ddp.engine;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.nio.file.*;
import java.util.*;

/**
 * Thin wrapper around the ddp binary.
 * API key validation and parsing run in native code.
 */
public final class DDPEngine {
    private static final String DEFAULT_BIN = "ddp";
    private static final ObjectMapper JSON = new ObjectMapper();

    private DDPEngine() {
    }

    private static String findDDP() {
        String env = System.getenv("DDP_SDK_BIN");
        return env != null ? env : DEFAULT_BIN;
    }

    private static void runDDP(String inputPath, String outputPath, String apiKey) throws IOException {
        ProcessBuilder pb = new ProcessBuilder(
                findDDP(),
                "process",
                inputPath,
                outputPath,
                "--license-key",
                apiKey
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

    private static String runDDPJson(String inputPath, String apiKey, String outputPath) throws IOException {
        List<String> args = new ArrayList<>();
        args.add(findDDP());
        args.add("json");
        args.add(inputPath);
        args.add("--license-key");
        args.add(apiKey);
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
     * API key validation runs in the native binary. Returns metadata object.
     */
    public static JsonNode processFromBytes(Map<String, byte[]> files, String outputPath, String apiKey) throws IOException {
        Path inDir = Files.createTempDirectory("ddp-in-");
        try {
            for (Map.Entry<String, byte[]> e : files.entrySet()) {
                String filename = "SD".equals(e.getKey()) ? "SD.SD" : e.getKey();
                Files.write(inDir.resolve(filename), e.getValue());
            }
            String outBase = outputPath.replaceAll("[/\\\\]+$", "");
            runDDP(inDir.toString(), outBase, apiKey);

            String metaJson = Files.readString(Path.of(outBase, "metadata.json"));
            return JSON.readTree(metaJson);
        } finally {
            deleteRecursive(inDir);
        }
    }

    /**
     * Process DDP from a path (directory or ZIP). Invokes ddp binary.
     * API key validation runs in the native binary.
     * Returns the metadata object (metadata.json contents).
     */
    public static JsonNode process(String inputPath, String outputPath, String apiKey) throws IOException {
        String outBase = outputPath.replaceAll("[/\\\\]+$", "");
        runDDP(inputPath, outBase, apiKey);
        String metaJson = Files.readString(Path.of(outBase, "metadata.json"));
        return JSON.readTree(metaJson);
    }

    /**
     * Extract metadata JSON only (no WAV files). Invokes ddp binary.
     * API key validation runs in the native binary.
     * Returns the metadata object. If outputPath is non-null, also writes metadata.json there.
     */
    public static JsonNode processToJson(String inputPath, String apiKey, String outputPath) throws IOException {
        String jsonStr = runDDPJson(inputPath, apiKey, outputPath);
        return JSON.readTree(jsonStr);
    }

    /** Same as processToJson(inputPath, apiKey, null) — metadata only, no file write. */
    public static JsonNode processToJson(String inputPath, String apiKey) throws IOException {
        return processToJson(inputPath, apiKey, null);
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
