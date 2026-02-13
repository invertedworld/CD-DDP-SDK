# DDP SDK — Client Overview

**Purpose:** Overview for prospective clients evaluating DDP SDK.

---

## 1. What DDP SDK Does

DDP SDK turns **DDP mastering filesets** into:

- **metadata.json** — disc structure, track times, ISRC codes, durations
- **track_01.wav, track_02.wav, …** — individual WAV files, ready for digital distribution or QC

Input: DDP directory or ZIP. Output: structured metadata and individual WAV tracks.

---

## 2. Use Cases and Integration

### Typical Use

1. Receive DDP from a mastering house or internal system.
2. Require tracks and metadata for streaming uploads, QC, catalog, or archival.
3. DDP SDK: single command or API call to produce metadata.json and WAVs.

### Integration Options

| Option | Best for |
|--------|----------|
| **CLI** | Scripts, cron jobs, batch processing on a server |
| **Python** | Data pipelines, automation, Jupyter workflows |
| **TypeScript/Node** | Web backends, serverless, Node.js services |
| **C#** | .NET applications, Windows services |
| **Java** | Enterprise Java, Maven/Gradle projects |
| **Rust library** | Direct integration, custom builds, Lambda/Azure |

### Deployment

- **On-prem** — install binary, run CLI or call from your app
- **AWS Lambda** — serverless; process DDP from S3 or request body
- **Azure Functions** — same pattern; custom handler
- **Docker / VMs** — include binary in your image; no special runtime

---

## 3. Inputs and Outputs

### Input Formats

- **DDP directory** — DDPID, PQDESCR (or SD), DDPMS (or DDPMS.DAT, IMAGE.DAT)
- **ZIP** — single archive containing the DDP structure
- **Paths** — local, `file://`, or `s3://` (mock for testing; real S3 roadmapped)

### Output

- **metadata.json** — format version, tracks, times, ISRC, album/track titles (when available)
- **track_01.wav … track_NN.wav** — 44.1 kHz, 16-bit stereo WAV

### DDP Compatibility

- DDP 2.00 (primary)
- Handles common variants: DDPMS.DAT, IMAGE.DAT, SD.sd, CDTEXT.BIN

---

## 4. How Licensing Works

As a client, you receive a **license key** from the publisher when you sign up. The key:

- Is validated locally (no phone-home; no callbacks to the publisher)
- Can expire (e.g. annual renewal)
- Is passed via `--license-key`, `DDP_LICENSE_KEY` env, or `.env` file

You run the binary or call the library; validation happens in-process. Typically works offline. In some environments (e.g. restricted containers, air-gapped systems), outbound access may be needed for time-sync checks used in expiry validation — see **Network** below.

---

## 5. Technical Requirements

### Binary

- **Platforms:** macOS, Linux, Windows (x86_64, ARM64 where supported)
- **Dependencies:** None — static binary
- **Size:** Small (stripped release build)

### Wrappers (Python, Node, C#, Java)

- Python 3.x, Node 18+, .NET 6+, Java 17+
- Binary must be in PATH or `DDP_SDK_BIN` set to its path
- For serverless: bundle binary in deployment (Lambda layer, container, etc.)

### Optional

- **Network** — usually not required. Outbound access may be needed in some environments (e.g. NTP for expiry checks). Most on-prem and serverless deployments work without it.

---

## 6. Quick Start

### CLI

```bash
ddp process /path/to/ddp /path/to/output --license-key "your-token"
# → metadata.json + track_01.wav, track_02.wav, ... in /path/to/output
```

### Python

```python
from ddp_sdk import process, process_from_bytes

# From path
result = process("/path/to/ddp", "/path/to/output", "your-api-key")
print(result.metadata.tracks)

# From in-memory files (e.g. from S3, upload, etc.)
files = {"DDPID": ..., "PQDESCR": ..., "DDPMS": ...}
disc, wavs = process_from_bytes(files, "your-api-key")
# wavs: [("track_01.wav", bytes), ...]
```

### Node / TypeScript

```typescript
import { process, processFromBytes } from "ddp-sdk";

const result = await process("/path/to/ddp", "/path/to/output", "your-api-key");
// or processFromBytes(files, "your-api-key") for in-memory
```

---

## 7. Technical Summary

| Aspect | Notes |
|--------|-------|
| **Parsing** | DDP 2.00 and common variants; tested with real-world files |
| **Performance** | Rust core; handles large DDPMS (700 MB+); low memory footprint |
| **Deployment** | CLI, Python, TypeScript, C#, Java, Rust library; Lambda, Azure, on-prem |
| **Licensing** | License key validated locally; no phone-home; offline capable |
| **Output** | JSON metadata for downstream systems |

---

## 8. Evaluation

1. Request license key and binary from the publisher.
2. Run against sample DDP files; verify metadata and WAV output.
3. Integrate into a staging pipeline (CLI or wrapper).
4. Validate output and performance.

Contact the publisher for evaluation keys and support.

---

## 9. Support and Resources

- **Manual** — integration guide, API reference, cloud deployment examples
- **Admin guide** — for publishers who issue keys (if applicable)
- **Error handling** — clear error types: InvalidApiKey, Parse, MissingFile, Io, Storage

---

## 10. Next Steps

1. Identify where DDP enters your pipeline.
2. Request evaluation key and binary from the publisher.
3. Run CLI or wrapper against sample DDP.
4. Discuss licensing terms and rollout.

---

*DDP SDK — parse DDP, export metadata and WAV. One binary, one license key.*
