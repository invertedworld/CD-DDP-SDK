"""Tests for the Python wrapper. Require ddp binary, token, and ddpfiles."""

import os
import pytest

from ddp_sdk import process, process_from_bytes, process_to_json, EngineError

from conftest import (
    DDP_BIN,
    get_token,
    input_dir_exists,
    ddp_bin_exists,
    INPUT_DIR,
)


def _ensure_env():
    """Set env for wrapper to find binary. Call before tests."""
    if os.path.isfile(DDP_BIN):
        os.environ["DDP_SDK_BIN"] = os.path.abspath(DDP_BIN)


@pytest.mark.skipif(
    not input_dir_exists() or not get_token(),
    reason="ddpfiles/DDP and test-e2e/token.txt required",
)
def test_process_from_bytes_success(tmp_path):
    """process_from_bytes with valid key writes metadata and WAVs to output_path."""
    _ensure_env()
    token = get_token()
    files = {}
    for name in os.listdir(INPUT_DIR):
        path = os.path.join(INPUT_DIR, name)
        if os.path.isfile(path):
            key = name.upper() if name.upper() != "SD.SD" else "SD"
            if key in ("DDPID", "PQDESCR", "SD", "DDPMS", "DDPMS.DAT", "IMAGE.DAT", "CDTEXT.BIN"):
                with open(path, "rb") as f:
                    files[key] = f.read()

    metadata = process_from_bytes(files, str(tmp_path), token)

    assert "tracks" in metadata
    assert len(metadata["tracks"]) > 0
    assert (tmp_path / "metadata.json").exists()
    for i in range(1, len(metadata["tracks"]) + 1):
        wav_path = tmp_path / f"track_{i:02d}.wav"
        assert wav_path.exists()
        data = wav_path.read_bytes()
        assert len(data) >= 44
        assert data[:4] == b"RIFF"
        assert data[8:12] == b"WAVE"


@pytest.mark.skipif(
    not input_dir_exists() or not get_token(),
    reason="ddpfiles/DDP and test-e2e/token.txt required",
)
def test_process_path_success(tmp_path):
    """process(input_path, output_path) with valid key writes metadata and WAVs."""
    _ensure_env()
    token = get_token()
    metadata = process(INPUT_DIR, str(tmp_path), token)

    assert "tracks" in metadata
    assert len(metadata["tracks"]) > 0
    assert (tmp_path / "metadata.json").exists()
    for i in range(1, len(metadata["tracks"]) + 1):
        wav_path = tmp_path / f"track_{i:02d}.wav"
        assert wav_path.exists()


@pytest.mark.skipif(
    not input_dir_exists(),
    reason="ddpfiles/DDP required",
)
def test_process_invalid_key_raises(tmp_path):
    """process with invalid key raises EngineError."""
    _ensure_env()
    with pytest.raises(EngineError) as exc_info:
        process(INPUT_DIR, str(tmp_path), "invalid-garbage-token")
    assert "InvalidLicenseKey" in str(exc_info.value) or "invalid" in str(exc_info.value).lower()


@pytest.mark.skipif(
    not get_token(),
    reason="test-e2e/token.txt required",
)
def test_process_from_bytes_invalid_key_raises(tmp_path):
    """process_from_bytes with invalid key raises EngineError."""
    _ensure_env()
    # Minimal files to trigger binary (will fail parse or auth first)
    files = {
        "DDPID": b"DDP2.00",
        "PQDESCR": b"1 1 0 0 0",
        "DDPMS": b"\x00" * 2352,
    }
    with pytest.raises(EngineError):
        process_from_bytes(files, str(tmp_path), "invalid-garbage-token")


@pytest.mark.skipif(
    not input_dir_exists() or not get_token(),
    reason="ddpfiles/DDP and test-e2e/token.txt required",
)
def test_process_to_json_success(tmp_path):
    """process_to_json with valid key returns metadata dict, no WAVs written."""
    _ensure_env()
    token = get_token()
    metadata = process_to_json(INPUT_DIR, token)

    assert "tracks" in metadata
    assert len(metadata["tracks"]) > 0
    assert not (tmp_path / "metadata.json").exists()


@pytest.mark.skipif(
    not input_dir_exists() or not get_token(),
    reason="ddpfiles/DDP and test-e2e/token.txt required",
)
def test_process_to_json_with_output_path(tmp_path):
    """process_to_json with output_path writes metadata.json to that path."""
    _ensure_env()
    token = get_token()
    out_file = tmp_path / "meta.json"
    metadata = process_to_json(INPUT_DIR, token, output_path=str(out_file))

    assert "tracks" in metadata
    assert len(metadata["tracks"]) > 0
    assert out_file.exists()
    with open(out_file, encoding="utf-8") as f:
        data = __import__("json").load(f)
    assert "tracks" in data
