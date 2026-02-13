# DDP SDK (TypeScript)

Thin wrapper around the `ddp` binary. License key validation and DDP parsing run in native code.

See the [unified manual](../docs/MANUAL.md) for full documentation.

## Requirements

- Node 18+
- `ddp` binary in PATH (or set `DDP_SDK_BIN` to its path)

## Install

```bash
npm install
npm run build
```

## Example

```typescript
import { process, processFromBytes } from "ddp-sdk";
import * as fs from "fs";

// From path
const metadata = await process("/path/to/ddp", "/path/to/output", "your-api-key");

// From in-memory files
const files = {
  DDPID: fs.readFileSync("DDPID"),
  PQDESCR: fs.readFileSync("PQDESCR"),
  DDPMS: fs.readFileSync("DDPMS"),
};
const { metadata, wavs } = await processFromBytes(files, "your-api-key");
```
