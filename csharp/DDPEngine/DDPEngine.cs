using System.Diagnostics;
using System.Text.Json.Nodes;

namespace DDPEngine;

/// <summary>Thin wrapper around the ddp binary. API key validation and parsing run in native code.</summary>
public static class DDPEngine
{
    private const string DefaultBin = "ddp";

    private static string FindDDP() =>
        Environment.GetEnvironmentVariable("DDP_SDK_BIN") ?? DefaultBin;

    private static void RunDDP(string inputPath, string outputPath, string licenseKey)
    {
        var bin = FindDDP();
        var startInfo = new ProcessStartInfo
        {
            FileName = bin,
            ArgumentList = { "process", inputPath, outputPath, "--license-key", licenseKey },
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
        };

        using var proc = System.Diagnostics.Process.Start(startInfo)
            ?? throw new EngineError($"Failed to start {bin}");
        proc.WaitForExit();

        var stderr = proc.StandardError.ReadToEnd();

        if (proc.ExitCode != 0)
        {
            var stdout = proc.StandardOutput.ReadToEnd();
            throw new EngineError(
                string.IsNullOrEmpty(stderr) ? stdout : stderr,
                stderr);
        }
    }

    private static string RunDDPJson(string inputPath, string licenseKey, string? outputPath)
    {
        var bin = FindDDP();
        var args = new List<string> { "json", inputPath, "--license-key", licenseKey };
        if (outputPath != null)
            args.AddRange(new[] { "--output", outputPath });

        var startInfo = new ProcessStartInfo
        {
            FileName = bin,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
        };
        foreach (var a in args)
            startInfo.ArgumentList.Add(a);

        using var proc = System.Diagnostics.Process.Start(startInfo)
            ?? throw new EngineError($"Failed to start {bin}");
        var stdout = proc.StandardOutput.ReadToEnd();
        var stderr = proc.StandardError.ReadToEnd();
        proc.WaitForExit();

        if (proc.ExitCode != 0)
            throw new EngineError(
                string.IsNullOrEmpty(stderr) ? stdout : stderr,
                stderr);

        if (outputPath != null)
            return File.ReadAllText(outputPath);
        return stdout;
    }

    /// <summary>
    /// Process DDP from in-memory files. Writes metadata and WAVs to outputPath.
    /// API key validation runs in the native binary. Returns metadata object.
    /// </summary>
    public static JsonObject ProcessFromBytes(
        IReadOnlyDictionary<string, byte[]> files,
        string outputPath,
        string apiKey)
    {
        var inDir = Path.Combine(Path.GetTempPath(), "ddp-in-" + Guid.NewGuid().ToString("N")[..8]);
        try
        {
            Directory.CreateDirectory(inDir);
            foreach (var (name, data) in files)
            {
                var filename = name == "SD" ? "SD.SD" : name;
                File.WriteAllBytes(Path.Combine(inDir, filename), data);
            }

            var outBase = outputPath.TrimEnd('/', '\\');
            RunDDP(inDir, outBase, apiKey);

            var metaPath = Path.Combine(outBase, "metadata.json");
            var metaJson = File.ReadAllText(metaPath);
            return JsonNode.Parse(metaJson)!.AsObject();
        }
        finally
        {
            if (Directory.Exists(inDir))
                Directory.Delete(inDir, recursive: true);
        }
    }

    /// <summary>
    /// Process DDP from a path (directory or ZIP). Invokes ddp binary.
    /// API key validation runs in the native binary.
    /// Returns the metadata object (metadata.json contents).
    /// </summary>
    public static JsonObject Process(string inputPath, string outputPath, string apiKey)
    {
        var outBase = outputPath.TrimEnd('/', '\\');
        RunDDP(inputPath, outBase, apiKey);

        var metaPath = Path.Combine(outBase, "metadata.json");
        var metaJson = File.ReadAllText(metaPath);
        return JsonNode.Parse(metaJson)!.AsObject();
    }

    /// <summary>
    /// Extract metadata JSON only (no WAV files). Invokes ddp binary.
    /// API key validation runs in the native binary.
    /// Returns the metadata object. If outputPath is given, also writes metadata.json there.
    /// </summary>
    public static JsonObject ProcessToJson(string inputPath, string apiKey, string? outputPath = null)
    {
        var jsonStr = RunDDPJson(inputPath, apiKey, outputPath);
        return JsonNode.Parse(jsonStr)!.AsObject();
    }
}
