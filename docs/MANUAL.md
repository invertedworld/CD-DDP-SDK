# DDP SDK — End User Manual

## Overview

DDP SDK parses DDP (Disc Description Protocol) filesets and exports track metadata plus individual WAV files. **All parsing and license key validation run in native code.** The Python, TypeScript, C#, and Java libraries are thin wrappers that invoke the `ddp` binary.

You receive a license key from the publisher when you sign up. The binary validates keys locally.

---

## Installing the ddp Binary

The publisher provides the `ddp` executable. Install it first — the Python, TypeScript, C#, and Java wrappers depend on it.

1. Copy the binary to a directory in your PATH:
   - **macOS/Linux:** `~/bin/`, `/usr/local/bin/`, or `~/.local/bin/`
   - **Windows:** `C:\Program Files\DDP\` or a folder in your PATH

2. Make it executable (macOS/Linux):
   ```bash
   chmod +x /path/to/ddp
   ```

3. Verify:
   ```bash
   ddp process --help
   ```

---

## License Key

Store your license key securely. Expired keys are rejected — contact the publisher for a new key.

**Providing the key:**

1. **Command line:** `ddp process input output --api-key "your-token"`
2. **Environment:** `export DDP_LICENSE_KEY="your-token"` (add to `~/.bashrc` / `~/.zshrc` to persist)
3. **`.env` file** in the current directory — the `ddp` binary loads it automatically when invoked (the language wrappers do not load `.env`). Do not commit to version control; add `.env` to `.gitignore`.

---

## Input and Output

**Input** — directory containing DDP files, or a ZIP with that structure:
- DDPID, PQDESCR (or SD), DDPMS (or DDPMS.DAT or IMAGE.DAT)
- Optional: CDTEXT.BIN

**Output** — directory where results are written (created if missing).

**Paths:**
- Local paths: `/path/to/ddp`, `./output`
- `file://` URLs: `file:///path/to/ddp`
- **S3 (mock):** `s3://bucket/key` — for testing without real AWS. Set `DDP_SDK_S3_MOCK_ROOT` to a local directory; `s3://bucket/key` maps to `$S3_MOCK_ROOT/bucket/key`. Example: `DDP_SDK_S3_MOCK_ROOT=/tmp/mock-s3 ddp process s3://mybucket/ddp s3://mybucket/out --api-key ...`

**Example layout:**

```
/path/to/ddp/           ← input directory
  DDPID
  PQDESCR
  DDPMS
  (or SD, DDPMS.DAT, IMAGE.DAT, CDTEXT.BIN as applicable)

/path/to/output/        ← output directory (you choose)
  metadata.json         ← created
  track_01.wav          ← created
  track_02.wav          ← created
  ...
```

---

## Memory and resource requirements

DDP uses CD Red Book format: **2352 bytes per frame**, **75 frames per second**.  
DDPMS size ≈ 10.6 MB per minute (e.g. 80 min full CD ≈ 847 MB).

WAVs are written one track at a time; peak RAM is DDPMS plus the largest single track, not the sum of all tracks.

### Serverless (Lambda, Azure Functions, etc.)

| Duration | Metadata only | Full (metadata + WAVs) |
|----------|---------------|------------------------|
| &lt; 5 min | 256 MB | 256 MB |
| 5–20 min (single/EP) | 256 MB | 512 MB |
| 20–50 min | 512 MB | 512 MB |
| 50–80 min (full CD) | 512 MB | 1024 MB |

Lambda default (128 MB) is too low. Full CDs with WAV output need **1024 MB**. Single-track full CDs (entire disc as one track) may need 2048 MB.

### Path-based processing

When using paths (`process(input_dir, output_dir, ...)`), the binary loads DDPMS and writes one WAV at a time. Use the same sizing table.

---

## CLI

```bash
ddp process <input_dir> <output_dir> [--api-key <token>]
```

If `--api-key` is omitted, `DDP_API_KEY` must be set.

---

## Python Wrapper

Thin wrapper that invokes the `ddp` binary. Requires `ddp` in PATH (or `DDP_SDK_BIN` set to its path).

### Install

```bash
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e /path/to/ddp-sdk/python
```

### API

```python
from ddp_sdk import process, process_from_bytes, EngineError

# From path (directory or ZIP)
metadata = process("/path/to/ddp", "/path/to/output", "your-api-key")

# From in-memory files — writes to output path, returns metadata
files = {"DDPID": ..., "PQDESCR": ..., "DDPMS": ...}
metadata = process_from_bytes(files, "/path/to/output", "your-api-key")
# WAVs written to /path/to/output/track_01.wav, etc.
```

Raises `EngineError` on failure (invalid key, parse error, etc.).

---

## TypeScript / Node Wrapper

Thin wrapper that invokes the `ddp` binary. Requires `ddp` in PATH (or `DDP_SDK_BIN` set).

### Install

```bash
cd ddp-sdk/typescript
npm install
npm run build
```

### API

```typescript
import { process, processFromBytes, EngineError } from "ddp-sdk";

// From path
const metadata = await process("/path/to/ddp", "/path/to/output", "your-api-key");

// From in-memory files — writes to output path, returns metadata
const files = { DDPID: ..., PQDESCR: ..., DDPMS: ... };
const metadata = await processFromBytes(files, "/path/to/output", "your-api-key");
```

For Python/TypeScript in serverless: include the `ddp` binary in your deployment (e.g. Lambda layer or container) and set `DDP_SDK_BIN` to its path. See [Memory and resource requirements](#memory-and-resource-requirements) for sizing.

---

## C# / .NET Wrapper

Thin wrapper that invokes the `ddp` binary. Requires `ddp` in PATH (or `DDP_SDK_BIN` set). Targets .NET 6.0+.

### Install

```bash
dotnet add reference /path/to/ddp-sdk/csharp/DDPEngine/DDPEngine.csproj
```

### API

```csharp
using DDPEngine;

// From path
var metadata = DDPEngine.DDPEngine.Process("/path/to/ddp", "/path/to/output", "your-api-key");

// From in-memory files — writes to output path, returns metadata
var files = new Dictionary<string, byte[]> { ["DDPID"] = ..., ["PQDESCR"] = ..., ["DDPMS"] = ... };
var metadata = DDPEngine.DDPEngine.ProcessFromBytes(files, "/path/to/output", "your-api-key");
```

Throws `EngineError` on failure.

---

## Java Wrapper

Thin wrapper that invokes the `ddp` binary. Requires `ddp` in PATH (or `DDP_SDK_BIN` set). Java 17+.

### Install

```xml
<dependency>
    <groupId>ddp.engine</groupId>
    <artifactId>ddp-sdk</artifactId>
    <version>0.1.0</version>
</dependency>
```

### API

```java
import ddp.engine.DDPEngine;
import com.fasterxml.jackson.databind.JsonNode;

// From path
JsonNode metadata = DDPEngine.process("/path/to/ddp", "/path/to/output", "your-api-key");

// From in-memory files
var files = Map.of(
    "DDPID", Files.readAllBytes(Path.of("DDPID")),
    "PQDESCR", Files.readAllBytes(Path.of("PQDESCR")),
    "DDPMS", Files.readAllBytes(Path.of("DDPMS"))
);
var metadata = DDPEngine.processFromBytes(files, "/path/to/output", "your-api-key");
// WAVs written to output path
```

Throws `EngineError` on failure.

---

## Rust Library

Direct use without subprocess. Add as a dependency:

```toml
[dependencies]
ddp-sdk = { path = "../ddp-sdk" }
```

### `process_to_json`

Process DDP from a path and return metadata JSON in memory (no file writes).

```rust
use ddp_sdk::process_to_json;

let metadata_json = process_to_json("/path/to/ddp", "your-api-key").await?;
// metadata_json: String (pretty-printed JSON)
```

### `process_from_bytes`

Process DDP from an in-memory map of filename to contents. Writes metadata and WAVs to output path. Requires valid license key.

```rust
use std::collections::HashMap;
use ddp_sdk::process_from_bytes;

let mut files = HashMap::new();
files.insert("DDPID".into(), ddpid_bytes);
files.insert("PQDESCR".into(), pqdescr_bytes);
files.insert("DDPMS".into(), audio_bytes);

let result = process_from_bytes(&files, "/path/to/output", "your-api-key").await?;
// result.metadata: DDPDisc, result.wav_files: Vec<String>
```

### `process` (async)

Process from a path (directory or ZIP) and write metadata + WAV files.

```rust
use ddp_sdk::process;

let result = process(
    "/path/to/ddp/directory",  // or /path/to/ddp.zip
    "/path/to/output/dir",
    "your-api-key",
).await?;

println!("Tracks: {}", result.metadata.tracks.len());
println!("WAV files: {:?}", result.wav_files);
```

---

## AWS Lambda (Rust)

Use `process_from_bytes` in your Lambda handler. Writes metadata and WAVs to `/tmp`; never holds all WAVs in memory.

**1. Dependencies:**
```toml
[dependencies]
ddp-sdk = { path = "../ddp-sdk" }
lambda_runtime = "0.13"
tokio = { version = "1", features = ["macros"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
base64 = "0.22"
zip = "2"
```

**2. Handler example** (base64-encoded ZIP in event, returns metadata JSON):
```rust
use lambda_runtime::{run, service_fn, Error, LambdaEvent};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::Read;
use ddp_sdk::process_from_bytes;

#[derive(Deserialize)]
struct Request {
    api_key: String,
    ddp_zip_base64: String,
}

#[derive(Serialize)]
struct Response {
    metadata_json: String,
    track_count: u32,
}

async fn handler(event: LambdaEvent<Request>) -> Result<Response, Error> {
    let zip_bytes = base64::Engine::decode(
        &base64::engine::general_purpose::STANDARD,
        &event.payload.ddp_zip_base64,
    )?;
    let files = extract_zip_to_map(&zip_bytes)?;
    let result = process_from_bytes(&files, "/tmp/ddp-out", &event.payload.api_key).await?;
    let metadata_json = serde_json::to_string_pretty(&result.metadata)?;
    Ok(Response { metadata_json, track_count: result.metadata.tracks.len() as u32 })
}

fn extract_zip_to_map(data: &[u8]) -> Result<HashMap<String, Vec<u8>>, Error> {
    let mut archive = zip::ZipArchive::new(std::io::Cursor::new(data))?;
    let mut files = HashMap::new();
    for i in 0..archive.len() {
        let mut entry = archive.by_index(i)?;
        let name = entry.name().to_string();
        let base = name.split('/').last().unwrap_or(&name).to_uppercase();
        let key = if base == "SD.SD" { "SD" } else { base.as_str() };
        if ["DDPID", "PQDESCR", "DDPMS", "DDPMS.DAT", "IMAGE.DAT", "CDTEXT.BIN", "SD"].contains(&key) {
            let mut buf = Vec::new();
            entry.read_to_end(&mut buf)?;
            files.insert(key.to_string(), buf);
        }
    }
    Ok(files)
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    run(service_fn(handler)).await
}
```

**3. Configure Lambda:**
- **Runtime:** `provided.al2023` or use `cargo lambda build`
- **Memory:** See [Memory and resource requirements](#memory-and-resource-requirements). Typical: 512 MB for singles/EPs, 1024 MB for full CDs with WAV output.
- **Ephemeral storage** (`/tmp`): Must hold WAV output (~same as DDPMS). 512 MB default is enough for &lt; 50 min; increase for full CDs.
- **Network:** Outbound access may be required for licence validation
- **License key:** In request payload or `DDP_LICENSE_KEY` env

**4. Build and deploy:**
```bash
cargo lambda build --release
# ARM64: cargo lambda build --release --arm64
```

---

## Azure Functions (Rust)

Use a custom handler with `process_from_bytes`. Build a Rust HTTP server that accepts the DDP payload and returns results.

**1. Dependencies:**
```toml
[dependencies]
ddp-sdk = { path = "../ddp-sdk" }
axum = { version = "0.7", features = ["json"] }
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
zip = "2"
```

**2. Handler:** Accept DDP ZIP in the request body, extract to `HashMap<String, Vec<u8>>`, call `process_from_bytes(&files, output_path, &api_key).await`, return metadata JSON. Use license key from `DDP_LICENSE_KEY` (app setting) or a request header.

**3. host.json:**
```json
{
  "version": "2.0",
  "customHandler": {
    "description": {
      "defaultExecutablePath": "handler",
      "workingDirectory": "",
      "arguments": []
    }
  }
}
```

**4. Application settings:** `DDP_API_KEY`. Outbound network access may be required.

**5. Memory:** See [Memory and resource requirements](#memory-and-resource-requirements). Azure Consumption plan (1.5 GB) is sufficient for typical full CDs.

**6. Build for Linux:**
```bash
cargo build --release --target x86_64-unknown-linux-gnu
# Copy binary to project root as "handler"
```

---

## Error Handling

- **InvalidApiKey:** Key missing, invalid, or expired. Obtain a new key from the publisher.
- **Parse:** Invalid or incomplete DDP data.
- **MissingFile:** Required DDP file absent.
- **Io:** File system error.
- **Storage:** Storage backend error.

Python/TypeScript/C#/Java wrappers raise `EngineError` with the binary's stderr message.
