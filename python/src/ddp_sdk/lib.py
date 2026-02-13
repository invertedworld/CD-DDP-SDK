"""Thin wrapper around the ddp binary. All parsing and API key validation run natively."""

import json
import os
import subprocess
import tempfile
from typing import Dict

DDP_BIN = "ddp"


class EngineError(Exception):
    """Raised when the ddp binary fails."""

    def __init__(self, message: str, stderr: str = ""):
        self.message = message
        self.stderr = stderr
        super().__init__(message)


def _find_ddp() -> str:
    """Path to ddp binary. Use DDP_SDK_BIN env to override."""
    return os.environ.get("DDP_SDK_BIN", DDP_BIN)


def _run_ddp(input_path: str, output_path: str, api_key: str) -> None:
    cmd = [_find_ddp(), "process", input_path, output_path, "--license-key", license_key]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise EngineError(
            result.stderr or result.stdout or f"ddp exited with code {result.returncode}",
            stderr=result.stderr or "",
        )


def _run_ddp_json(
    input_path: str, api_key: str, output_path: str | None = None
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
    api_key: str,
) -> dict:
    """
    Process DDP from in-memory files. Writes metadata and WAVs to output_path.
    API key validation runs in the native binary. Returns metadata dict.
    """
    with tempfile.TemporaryDirectory(prefix="ddp-in-") as in_dir:
        for name, data in files.items():
            filename = "SD.SD" if name == "SD" else name
            path = os.path.join(in_dir, filename)
            with open(path, "wb") as f:
                f.write(data)

        _run_ddp(in_dir, output_path.rstrip("/"), api_key)
        meta_path = os.path.join(output_path.rstrip("/"), "metadata.json")
        with open(meta_path, "r", encoding="utf-8") as f:
            return json.load(f)


def process(
    input_path: str,
    output_path: str,
    api_key: str,
) -> dict:
    """
    Process DDP from a path (directory or ZIP). Invokes ddp binary.
    API key validation runs in the native binary.
    Returns the metadata dict (metadata.json contents).
    """
    _run_ddp(input_path, output_path, api_key)
    meta_path = os.path.join(output_path.rstrip("/"), "metadata.json")
    with open(meta_path, "r", encoding="utf-8") as f:
        return json.load(f)


def process_to_json(
    input_path: str,
    api_key: str,
    *,
    output_path: str | None = None,
) -> dict:
    """
    Extract metadata JSON only (no WAV files). Invokes ddp binary.
    API key validation runs in the native binary.
    Returns the metadata dict. If output_path is given, also writes metadata.json there.
    """
    json_str = _run_ddp_json(input_path, api_key, output_path)
    return json.loads(json_str)
