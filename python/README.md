# DDP SDK (Python)

Thin wrappers around the `ddp` and `ddpbuild` binaries. Licence validation, DDP parsing and DDP writing run in native code.

See the [unified manual](../docs/MANUAL.md) for full documentation.

## Requirements

- Python 3.9+
- `ddp` binary in PATH (or set `DDP_SDK_BIN` to its path)
- `ddpbuild` binary, to write DDP (or set `DDP_BUILD_BIN`)

## Setup with venv

```bash
python3 -m venv .venv
source .venv/bin/activate   # or .venv\Scripts\activate on Windows
pip install -e .
```

Or: `make venv && source .venv/bin/activate && make install`

## Example

```python
from ddp_sdk import process, process_from_bytes, build, validate

# Reading, from a path
metadata = process("/path/to/ddp", "/path/to/output", "your-license-key")

# Reading, from in-memory files (writes temp dir, invokes binary)
files = {"DDPID": b"...", "PQDESCR": b"...", "DDPMS": b"..."}
metadata = process_from_bytes(files, "/path/to/output", "your-license-key")

# Writing. metadata.json from a read is itself a valid manifest, so this
# rebuilds the disc byte for byte.
print(validate("/path/to/output/metadata.json"))          # no licence needed
report = build("/path/to/output/metadata.json", "/path/to/rebuilt", "your-build-key")
for f in report["files"]:
    print(f["name"], f["md5"])
```
