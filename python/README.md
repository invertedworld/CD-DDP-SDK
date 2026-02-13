# DDP SDK (Python)

Thin wrapper around the `ddp` binary. License key validation and DDP parsing run in native code.

See the [unified manual](../docs/MANUAL.md) for full documentation.

## Requirements

- Python 3.9+
- `ddp` binary in PATH (or set `DDP_SDK_BIN` to its path)

## Setup with venv

```bash
python3 -m venv .venv
source .venv/bin/activate   # or .venv\Scripts\activate on Windows
pip install -e .
```

Or: `make venv && source .venv/bin/activate && make install`

## Example

```python
from ddp_sdk import process, process_from_bytes

# From path
metadata = process("/path/to/ddp", "/path/to/output", "your-api-key")

# From in-memory files (writes temp dir, invokes binary)
files = {"DDPID": b"...", "PQDESCR": b"...", "DDPMS": b"..."}
metadata, wavs = process_from_bytes(files, "your-api-key")
# wavs: [("track_01.wav", bytes), ...]
```
