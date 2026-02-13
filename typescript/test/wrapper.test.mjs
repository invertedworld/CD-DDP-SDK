/**
 * Wrapper tests. Require ddp binary, token, and ddpfiles.
 * Set DDP_SDK_BIN, DDP_LICENSE_KEY (or DDP_TOKEN_FILE), DDP_INPUT_DIR to run.
 * Skips when binary/token/ddpfiles are missing.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import * as fs from "fs/promises";
import fsSync from "fs";
import * as path from "path";
import * as os from "os";
import { fileURLToPath } from "url";
import {
  process as processPath,
  processFromBytes,
  processToJson,
  EngineError,
} from "../dist/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");  // repo root
const PARENT = path.dirname(ROOT);
const INPUT_DIR = globalThis.process.env.DDP_INPUT_DIR || path.join(PARENT, "ddpfiles", "DDP");
const DDP_BIN = globalThis.process.env.DDP_SDK_BIN || path.join(ROOT, "target", "release", "ddp");
const TOKEN_PATH = globalThis.process.env.DDP_TOKEN_FILE || path.join(ROOT, "test-e2e", "token.txt");

function getToken() {
  try {
    return fsSync.readFileSync(TOKEN_PATH, "utf-8").trim();
  } catch {
    return null;
  }
}

async function inputDirExists() {
  try {
    const s = await fs.stat(INPUT_DIR);
    return s.isDirectory();
  } catch {
    return false;
  }
}

async function loadDDPFiles() {
  const files = {};
  const names = await fs.readdir(INPUT_DIR);
  const known = ["DDPID", "PQDESCR", "SD", "DDPMS", "DDPMS.DAT", "IMAGE.DAT", "CDTEXT.BIN"];
  for (const name of names) {
    const key = name.toUpperCase() === "SD.SD" ? "SD" : name.toUpperCase();
    if (known.includes(key)) {
      const buf = await fs.readFile(path.join(INPUT_DIR, name));
      if (buf.length > 0) files[key] = buf;
    }
  }
  return files;
}

describe("TypeScript wrapper", () => {
  it("processFromBytes with valid key writes metadata and WAVs to outputPath", async () => {
    const token = getToken();
    const hasInput = await inputDirExists();
    if (!token || !hasInput) {
      console.log("Skipped: token or ddpfiles missing");
      return;
    }
    if (fsSync.existsSync(DDP_BIN)) {
      globalThis.process.env.DDP_SDK_BIN = path.resolve(DDP_BIN);
    }

    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ddp-test-"));
    try {
      const files = await loadDDPFiles();
      const metadata = await processFromBytes(files, tmp, token);

      assert.ok(metadata.tracks);
      assert.ok(metadata.tracks.length > 0);
      const metaPath = path.join(tmp, "metadata.json");
      await fs.stat(metaPath);
      for (let i = 1; i <= metadata.tracks.length; i++) {
        const wavPath = path.join(tmp, `track_${String(i).padStart(2, "0")}.wav`);
        const data = await fs.readFile(wavPath);
        assert.ok(data.length >= 44);
        assert.deepStrictEqual(data.slice(0, 4), Buffer.from("RIFF"));
        assert.deepStrictEqual(data.slice(8, 12), Buffer.from("WAVE"));
      }
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });

  it("process with valid key writes metadata and WAVs", async () => {
    const token = getToken();
    const hasInput = await inputDirExists();
    if (!token || !hasInput) {
      console.log("Skipped: token or ddpfiles missing");
      return;
    }

    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ddp-test-"));
    try {
      const metadata = await processPath(INPUT_DIR, tmp, token);
      assert.ok(metadata.tracks);
      assert.ok(metadata.tracks.length > 0);
      const metaPath = path.join(tmp, "metadata.json");
      const stat = await fs.stat(metaPath);
      assert.ok(stat.isFile());
      for (let i = 1; i <= metadata.tracks.length; i++) {
        const wavPath = path.join(tmp, `track_${String(i).padStart(2, "0")}.wav`);
        const wstat = await fs.stat(wavPath);
        assert.ok(wstat.isFile());
      }
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });

  it("processToJson with valid key returns metadata only (no WAVs)", async () => {
    const token = getToken();
    const hasInput = await inputDirExists();
    if (!token || !hasInput) {
      console.log("Skipped: token or ddpfiles missing");
      return;
    }
    if (fsSync.existsSync(DDP_BIN)) {
      globalThis.process.env.DDP_SDK_BIN = path.resolve(DDP_BIN);
    }

    const metadata = await processToJson(INPUT_DIR, token);
    assert.ok(metadata.tracks);
    assert.ok(metadata.tracks.length > 0);
  });

  it("processToJson with outputPath writes metadata.json", async () => {
    const token = getToken();
    const hasInput = await inputDirExists();
    if (!token || !hasInput) {
      console.log("Skipped: token or ddpfiles missing");
      return;
    }
    if (fsSync.existsSync(DDP_BIN)) {
      globalThis.process.env.DDP_SDK_BIN = path.resolve(DDP_BIN);
    }

    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ddp-json-"));
    const metaPath = path.join(tmp, "metadata.json");
    try {
      const metadata = await processToJson(INPUT_DIR, token, {
        outputPath: metaPath,
      });
      assert.ok(metadata.tracks);
      assert.ok(metadata.tracks.length > 0);
      const stat = await fs.stat(metaPath);
      assert.ok(stat.isFile());
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });

  it("process with invalid key throws EngineError", async () => {
    const hasInput = await inputDirExists();
    if (!hasInput) {
      console.log("Skipped: ddpfiles missing");
      return;
    }

    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ddp-test-"));
    try {
      await assert.rejects(
        async () => processPath(INPUT_DIR, tmp, "invalid-garbage-token"),
        (err) => {
          assert.ok(err instanceof EngineError);
          return true;
        }
      );
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });
});
