# CD-DDP-SDK

An SDK for reading and writing DDP (Disc Description Protocol) filesets. DDP is the industry-standard format used in CD and audio mastering: a fileset that describes disc structure and track layout, and contains the master audio.

The SDK works in both directions:

- **Read** — `ddp` parses a DDP directory or ZIP into structured metadata (JSON) plus individual WAV tracks, ready for digital distribution or QC.
- **Write** — `ddpbuild` turns WAV audio and that same metadata back into a complete DDP 2.00 fileset, ready for glass mastering.

Both sides share one schema, so an extract is directly a build input. A disc read with `ddp` and rebuilt with `ddpbuild` reproduces the master byte for byte, checksums included.

This repository contains the distribution for end users: language wrappers and documentation.

**The binaries and your licence keys are provided together by the publisher when you sign up.** Contact the publisher to get started. The binaries are not included in this repository.

**Reading and writing are separate entitlements.** A reader licence will not build a DDP; the error says which entitlement is missing. Ask the publisher for a build licence if you need to write discs.

## Clone and Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/invertedworld/CD-DDP-SDK.git
   cd CD-DDP-SDK
   ```

2. **Install the binaries** — the publisher provides `ddp` (reading) and, if you are licensed for it, `ddpbuild` (writing). Copy them to a directory in your PATH (e.g. `~/bin/` or `/usr/local/bin/`) and make them executable:
   ```bash
   chmod +x /path/to/ddp /path/to/ddpbuild
   ```
   Or point the wrappers at them directly with `DDP_SDK_BIN` and `DDP_BUILD_BIN`.

3. **Optional: install a language wrapper:**
   - **Python:** `pip install -e python`
   - **TypeScript/Node:** `cd typescript && npm install && npm run build`
   - **Java:** Add as Maven dependency or `mvn install -f java/pom.xml`
   - **C#:** Add project reference to `csharp/DDPEngine/DDPEngine.csproj`

4. **Set your licence keys** (provided by the publisher along with the binaries):
   ```bash
   export DDP_LICENSE_KEY="your-reader-token"
   export DDP_BUILD_LICENSE_KEY="your-build-token"   # only if licensed to write
   ```
   Or pass `--license-key "your-token"` to each command.

## Contents

- **`docs/`** — [Manual](docs/MANUAL.md), [Client Overview](docs/CLIENT_OVERVIEW.md), [Manifest schema](docs/MANIFEST.md)
- **`LICENSE_AGREEMENT.md`** — License terms, including DDP trademark and logo attribution requirements
- **`assets/ddp.png`** — DDP logo (required for attribution in software that implements DDP)
- **`python/`** — Python wrapper (`pip install -e python`)
- **`typescript/`** — TypeScript/Node wrapper (`npm install` in `typescript/`)
- **`java/`** — Java wrapper (Maven project)
- **`csharp/`** — C# wrapper (.NET project)

## Quick Start

After cloning, installing the binaries (from the publisher), and setting your licence keys:

**Read a disc** — WAV tracks plus `metadata.json`:

```bash
ddp process /path/to/ddp /path/to/output --license-key "your-reader-token"
```

**Write a disc** — from WAVs and a manifest:

```bash
ddpbuild validate album.json                      # check the audio, print the TOC
ddpbuild build album.json /path/to/ddp-out --license-key "your-build-token"
```

**Round trip** — read a master and rebuild it byte for byte. `metadata.json` is itself a
build manifest, so nothing has to be translated in between:

```bash
ddp process    master/ extract/
ddpbuild build extract/metadata.json rebuilt/
```

See [docs/MANUAL.md](docs/MANUAL.md) for full documentation and
[docs/MANIFEST.md](docs/MANIFEST.md) for the manifest schema.
