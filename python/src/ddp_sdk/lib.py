"""Thin wrappers around the ddp and ddpbuild binaries.

`process` and friends read a DDP; `build` writes one. All parsing, writing and
licence validation run in native code. Reading and writing are separate
entitlements, so each takes its own licence key.
"""

import json
import os
import subprocess
import tempfile
from typing import Dict

DDP_BIN = "ddp"
DDPBUILD_BIN = "ddpbuild"


class EngineError(Exception):
    """Raised when the ddp or ddpbuild binary fails."""

    def __init__(self, message: str, stderr: str = ""):
        self.message = message
        self.stderr = stderr
        super().__init__(message)


def _find_ddp() -> str:
    """Path to the ddp binary. Use DDP_SDK_BIN env to override."""
    return os.environ.get("DDP_SDK_BIN", DDP_BIN)


def _find_ddpbuild() -> str:
    """Path to the ddpbuild binary. Use DDP_BUILD_BIN env to override."""
    return os.environ.get("DDP_BUILD_BIN", DDPBUILD_BIN)


def _run(cmd: list) -> str:
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise EngineError(
            result.stderr or result.stdout or f"{cmd[0]} exited with code {result.returncode}",
            stderr=result.stderr or "",
        )
    return result.stdout


def _run_ddp(input_path: str, output_path: str, license_key: str) -> None:
    cmd = [_find_ddp(), "process", input_path, output_path, "--license-key", license_key]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise EngineError(
            result.stderr or result.stdout or f"ddp exited with code {result.returncode}",
            stderr=result.stderr or "",
        )


def _run_ddp_json(
    input_path: str, license_key: str, output_path: str | None = None
) -> str:
    cmd = [_find_ddp(), "json", input_path, "--license-key", license_key]
    if output_path is not None:
        cmd.extend(["--output", output_path])
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise EngineError(
            result.stderr or result.stdout or f"ddp exited with code {result.returncode}",
            stderr=result.stderr or "",
        )
    if output_path is not None:
        with open(output_path, "r", encoding="utf-8") as f:
            return f.read()
    return result.stdout


def process_from_bytes(
    files: Dict[str, bytes],
    output_path: str,
    license_key: str,
) -> dict:
    """
    Process DDP from in-memory files. Writes metadata and WAVs to output_path.
    License key validation runs in the native binary. Returns metadata dict.
    """
    with tempfile.TemporaryDirectory(prefix="ddp-in-") as in_dir:
        for name, data in files.items():
            filename = "SD.SD" if name == "SD" else name
            path = os.path.join(in_dir, filename)
            with open(path, "wb") as f:
                f.write(data)

        _run_ddp(in_dir, output_path.rstrip("/"), license_key)
        meta_path = os.path.join(output_path.rstrip("/"), "metadata.json")
        with open(meta_path, "r", encoding="utf-8") as f:
            return json.load(f)


def process(
    input_path: str,
    output_path: str,
    license_key: str,
) -> dict:
    """
    Process DDP from a path (directory or ZIP). Invokes ddp binary.
    License key validation runs in the native binary.
    Returns the metadata dict (metadata.json contents).
    """
    _run_ddp(input_path, output_path, license_key)
    meta_path = os.path.join(output_path.rstrip("/"), "metadata.json")
    with open(meta_path, "r", encoding="utf-8") as f:
        return json.load(f)


def process_to_json(
    input_path: str,
    license_key: str,
    *,
    output_path: str | None = None,
) -> dict:
    """
    Extract metadata JSON only (no WAV files). Invokes ddp binary.
    License key validation runs in the native binary.
    Returns the metadata dict. If output_path is given, also writes metadata.json there.
    """
    json_str = _run_ddp_json(input_path, license_key, output_path)
    return json.loads(json_str)


def build(
    manifest_path: str,
    output_path: str,
    license_key: str,
    *,
    strict: bool = False,
    write_ident: bool = True,
    write_checksum: bool = True,
) -> dict:
    """
    Build a DDP fileset from a manifest and the WAVs it names. Invokes the
    ddpbuild binary; licence validation runs natively.

    The manifest is the same document `process` writes as metadata.json, so a
    disc that was read can be rebuilt without translating anything. Track paths
    inside it resolve relative to the manifest.

    Building requires the `ddp:build` entitlement, which is separate from the
    reader's. A reader licence is refused, and says which entitlement is missing.

    Returns the build report: the files written with their MD5s, the track
    layout, the lead-out, and any warnings.
    """
    cmd = [
        _find_ddpbuild(), "build", manifest_path, output_path,
        "--json", "--license-key", license_key,
    ]
    if strict:
        cmd.append("--strict")
    if not write_ident:
        cmd.append("--no-ident")
    if not write_checksum:
        cmd.append("--no-checksum")
    return json.loads(_run(cmd))


def validate(manifest_path: str, *, strict: bool = False) -> str:
    """
    Check a manifest and the audio it names, and return the disc layout as text.
    Writes nothing, and needs no licence key: planning a disc is free.
    """
    cmd = [_find_ddpbuild(), "validate", manifest_path]
    if strict:
        cmd.append("--strict")
    return _run(cmd)
