# DDP SDK — End User Manual

## Overview

DDP SDK parses DDP (Disc Description Protocol) filesets and exports track metadata plus individual WAV files. **All parsing and license key validation run in native code.** The Python, TypeScript, C#, and Java libraries are thin wrappers that invoke the `ddp` binary.

You receive a license key from the publisher when you sign up. The binary validates keys locally.

---

## Installing the Binaries

The publisher provides the `ddp` executable. Install it first — the Python, TypeScript, C#, and Java wrappers depend on it.

Binaries are provided for macOS (one universal binary covering Apple Silicon and
Intel), Linux x86_64 and ARM64 (statically linked, no glibc requirement), and Windows
x86_64. Ask the publisher if you need a platform not listed.

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

## Licence Keys

Reading and writing are separate entitlements, issued as separate keys.

| Task | Binary | Key | Environment variable |
|---|---|---|---|
| Read a DDP | `ddp` | reader licence | `DDP_LICENSE_KEY` |
| Write a DDP | `ddpbuild` | build licence (`ddp:build`) | `DDP_BUILD_LICENSE_KEY` |

A reader licence presented to `ddpbuild` is refused by entitlement, not by signature,
and the error names what is missing. Binary paths can be overridden with `DDP_SDK_BIN`
and `DDP_BUILD_BIN`.

### Detail

Store your license key securely. Expired keys are rejected — contact the publisher for a new key.

**Providing the key:**

1. **Command line:** `ddp process input output --license-key "your-token"`
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
- **S3 (mock):** `s3://bucket/key` — for testing without real AWS. Set `DDP_SDK_S3_MOCK_ROOT` to a local directory; `s3://bucket/key` maps to `$S3_MOCK_ROOT/bucket/key`. Example: `DDP_SDK_S3_MOCK_ROOT=/tmp/mock-s3 ddp process s3://mybucket/ddp s3://mybucket/out --license-key ...`

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

Reading:

```bash
ddp process <input_dir> <output_dir> [--license-key <token>]
ddp json    <input_dir> [--output <file>] [--license-key <token>]
```

If `--license-key` is omitted, `DDP_LICENSE_KEY` must be set.

Writing:

```bash
ddpbuild validate <manifest.json> [--strict]
ddpbuild build    <manifest.json> <output_dir> [--license-key <token>] [--json]
                                  [--strict] [--no-ident] [--no-checksum] [--dry-run]
```

If `--license-key` is omitted, `DDP_BUILD_LICENSE_KEY` must be set. `validate` needs
no key — planning a disc is free. `--json` prints the build report as JSON, which is
what the language wrappers read.

---

## Writing DDP

`ddpbuild` turns WAV audio and a manifest into a DDP 2.00 fileset: `DDPID`, `DDPMS`,
`PQDESCR`, `IMAGE.DAT`, and where the manifest calls for them `CDTEXT.BIN`,
`IDENT.TXT` and `CHECKSUM.MD5`.

**Writing is a separate entitlement.** A reader licence is refused, and the error names
the entitlement that is missing. Ask the publisher for a build licence.

### The manifest

One JSON document describes the disc. See **[MANIFEST.md](MANIFEST.md)** for the full
schema.

```json
{
  "disc": {
    "title": "Night Ferry",
    "performer": "The Harbour Lights",
    "upc_ean": "0602537351169",
    "cd_text": true
  },
  "tracks": [
    {"file": "audio/01.wav", "title": "Slack Water", "isrc": "ZZABC2500001"},
    {"file": "audio/02.wav", "title": "Cold Harbour", "pregap": "00:05:00"}
  ]
}
```

Track paths resolve relative to the manifest.

### It is the same document the reader writes

`ddp process` writes its metadata in exactly this schema, so an extract is directly a
build input and a disc can be taken apart and put back together with nothing in
between to disagree:

```bash
ddp process      master/ extract/          # writes extract/metadata.json
ddpbuild build   extract/metadata.json rebuilt/
```

Done this way the rebuild reproduces the master byte for byte, checksums included.

### Audio requirements

Every WAV must be 44.1 kHz, 16-bit, stereo PCM. Anything else is rejected, naming the
file, what it is, and what it needs to be. Nothing is resampled, dithered or
channel-mapped: a master is written as it was approved.

Audio that does not fill a whole number of 2352-byte sectors is padded to the sector
boundary with silence, because a CD cannot store a partial sector. Every pad is
reported per track rather than done quietly.

### Pregaps

By default `pregap` inserts digital silence before a track. Real masters often carry
audio in their pauses — dither, room tone, a fade — so a pregap can instead be taken
from the head of the track's own file:

```json
{"file": "02.wav", "pregap": "00:05:00", "pregap_source": "audio"}
```

That is what a lossless extract produces, and what makes a bit-identical rebuild
possible.

### Validation

Errors, with nothing written: audio that is not Red Book; a track with no audio; more
than 99 tracks or 99 indices; an index past the end of its track; a malformed ISRC or
UPC; a disc longer than the 99:59:74 the PQ descriptor can address; CD-TEXT needing
more than 256 packs or holding characters ISO 8859-1 cannot represent.

Warnings, reported but not fatal: a track under the Red Book four-second minimum; a
disc past 74 or 80 minutes; a UPC whose check digit disagrees; sector padding.
`--strict` makes warnings fatal.

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
from ddp_sdk import process, process_from_bytes, build, validate, EngineError

# Reading. From a path (directory or ZIP)
metadata = process("/path/to/ddp", "/path/to/output", "your-license-key")

# From in-memory files — writes to output path, returns metadata
files = {"DDPID": ..., "PQDESCR": ..., "DDPMS": ...}
metadata = process_from_bytes(files, "/path/to/output", "your-license-key")
# WAVs written to /path/to/output/track_01.wav, etc.

# Writing. Needs a build licence; requires ddpbuild in PATH (or DDP_BUILD_BIN set)
print(validate("album.json"))                     # no licence needed
report = build("album.json", "/path/to/ddp-out", "your-build-license-key")
for f in report["files"]:
    print(f["name"], f["md5"])
```

Raises `EngineError` on failure (invalid key, parse error, etc.).

---

## TypeScript / Node Wrapper

Thin wrapper that invokes the `ddp` and `ddpbuild` binaries. Requires them in PATH (or
`DDP_SDK_BIN` / `DDP_BUILD_BIN` set).

Writing:

```ts
import { build, validate } from "ddp-sdk";

console.log(await validate("album.json"));                  // no licence needed
const report = await build("album.json", "out/", process.env.DDP_BUILD_LICENSE_KEY!);
```

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
const metadata = await process("/path/to/ddp", "/path/to/output", "your-license-key");

// From in-memory files — writes to output path, returns metadata
const files = { DDPID: ..., PQDESCR: ..., DDPMS: ... };
const metadata = await processFromBytes(files, "/path/to/output", "your-license-key");
```

For Python/TypeScript in serverless: include the `ddp` binary in your deployment (e.g. Lambda layer or container) and set `DDP_SDK_BIN` to its path. See [Memory and resource requirements](#memory-and-resource-requirements) for sizing.

---

## C# / .NET Wrapper

Writing:

```csharp
// The class sits inside a namespace of the same name, hence the double qualification.
var text   = DDPEngine.DDPEngine.Validate("album.json");     // no licence needed
var report = DDPEngine.DDPEngine.Build("album.json", "out/", buildLicenseKey);
```


Thin wrapper that invokes the `ddp` and `ddpbuild` binaries. Requires them in PATH (or `DDP_SDK_BIN` / `DDP_BUILD_BIN` set). Targets .NET 8.0 (LTS) and later.

### Install

```bash
dotnet add reference /path/to/ddp-sdk/csharp/DDPEngine/DDPEngine.csproj
```

### API

```csharp
using DDPEngine;

// From path
var metadata = DDPEngine.DDPEngine.Process("/path/to/ddp", "/path/to/output", "your-license-key");

// From in-memory files — writes to output path, returns metadata
var files = new Dictionary<string, byte[]> { ["DDPID"] = ..., ["PQDESCR"] = ..., ["DDPMS"] = ... };
var metadata = DDPEngine.DDPEngine.ProcessFromBytes(files, "/path/to/output", "your-license-key");
```

Throws `EngineError` on failure.

---

## Java Wrapper

Writing:

```java
String text = DDPEngine.validate("album.json", false);     // no licence needed
JsonNode report = DDPEngine.build("album.json", "out/", buildLicenseKey);
```


Thin wrapper that invokes the `ddp` and `ddpbuild` binaries. Requires them in PATH (or `DDP_SDK_BIN` / `DDP_BUILD_BIN` set). Java 17+.

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
JsonNode metadata = DDPEngine.process("/path/to/ddp", "/path/to/output", "your-license-key");

// From in-memory files
var files = Map.of(
    "DDPID", Files.readAllBytes(Path.of("DDPID")),
    "PQDESCR", Files.readAllBytes(Path.of("PQDESCR")),
    "DDPMS", Files.readAllBytes(Path.of("DDPMS"))
);
var metadata = DDPEngine.processFromBytes(files, "/path/to/output", "your-license-key");
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

let metadata_json = process_to_json("/path/to/ddp", "your-license-key").await?;
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

let result = process_from_bytes(&files, "/path/to/output", "your-license-key").await?;
// result.metadata: DDPDisc, result.wav_files: Vec<String>
```

### `process` (async)

Process from a path (directory or ZIP) and write metadata + WAV files.

```rust
use ddp_sdk::process;

let result = process(
    "/path/to/ddp/directory",  // or /path/to/ddp.zip
    "/path/to/output/dir",
    "your-license-key",
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
    license_key: String,
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
    let result = process_from_bytes(&files, "/tmp/ddp-out", &event.payload.license_key).await?;
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

**2. Handler:** Accept DDP ZIP in the request body, extract to `HashMap<String, Vec<u8>>`, call `process_from_bytes(&files, output_path, &license_key).await`, return metadata JSON. Use license key from `DDP_LICENSE_KEY` (app setting) or a request header.

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

**4. Application settings:** `DDP_LICENSE_KEY`. Outbound network access may be required.

**5. Memory:** See [Memory and resource requirements](#memory-and-resource-requirements). Azure Consumption plan (1.5 GB) is sufficient for typical full CDs.

**6. Build for Linux:**
```bash
cargo build --release --target x86_64-unknown-linux-gnu
# Copy binary to project root as "handler"
```

---

## Error Handling

- **InvalidLicenseKey:** License key missing, invalid, or expired. Obtain a new key from the publisher.
- **Parse:** Invalid or incomplete DDP data.
- **MissingFile:** Required DDP file absent.
- **Io:** File system error.
- **Storage:** Storage backend error.

Python/TypeScript/C#/Java wrappers raise `EngineError` with the binary's stderr message.
