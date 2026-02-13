# DDP SDK (C#)

Thin wrapper around the `ddp` binary. License key validation and DDP parsing run in native code.

See the [unified manual](../docs/MANUAL.md) for full documentation.

## Requirements

- .NET 6.0+
- `ddp` binary in PATH (or set `DDP_SDK_BIN` to its path)

## Install

```bash
# Add project reference
dotnet add reference /path/to/CD-DDP-SDK/csharp/DDPEngine/DDPEngine.csproj
```

Or install from NuGet when published.

## Example

```csharp
using DDPEngine;

// From path
var metadata = DDPEngine.DDPEngine.Process("/path/to/ddp", "/path/to/output", "your-api-key");

// From in-memory files
var files = new Dictionary<string, byte[]>
{
    ["DDPID"] = File.ReadAllBytes("DDPID"),
    ["PQDESCR"] = File.ReadAllBytes("PQDESCR"),
    ["DDPMS"] = File.ReadAllBytes("DDPMS"),
};
var (meta, wavs) = DDPEngine.DDPEngine.ProcessFromBytes(files, "your-api-key");
// wavs: [(Name, Data), ...]
```
