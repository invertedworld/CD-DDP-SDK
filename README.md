# CD-DDP-SDK

An SDK for processing DDP (Disc Description Protocol) files. DDP is the industry-standard format used in CD and audio mastering: a fileset that describes disc structure, track layout, and contains the master audio (DDPMS). This SDK parses DDP directories or ZIP archives and outputs structured metadata (JSON) plus individual WAV tracks, ready for digital distribution or QC.

This repository contains the distribution for end users: language wrappers and documentation.

**The `ddp` binary and your license key are provided together by the publisher when you sign up.** Contact the publisher to get started. The binary is not included in this repository.

## Clone and Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/invertedworld/CD-DDP-SDK.git
   cd CD-DDP-SDK
   ```

2. **Install the binary** — the publisher provides the `ddp` executable when you receive your license key. Copy it to a directory in your PATH (e.g. `~/bin/` or `/usr/local/bin/`) and make it executable:
   ```bash
   chmod +x /path/to/ddp
   ```

3. **Optional: install a language wrapper:**
   - **Python:** `pip install -e python`
   - **TypeScript/Node:** `cd typescript && npm install && npm run build`
   - **Java:** Add as Maven dependency or `mvn install -f java/pom.xml`
   - **C#:** Add project reference to `csharp/DDPEngine/DDPEngine.csproj`

4. **Set your license key** (provided by the publisher along with the binary):
   ```bash
   export DDP_LICENSE_KEY="your-token"
   ```
   Or pass `--license-key "your-token"` to each command.

## Contents

- **`docs/`** — [Manual](docs/MANUAL.md), [Client Overview](docs/CLIENT_OVERVIEW.md)
- **`LICENSE_AGREEMENT.md`** — License terms, including DDP trademark and logo attribution requirements
- **`assets/ddp.png`** — DDP logo (required for attribution in software that implements DDP)
- **`python/`** — Python wrapper (`pip install -e python`)
- **`typescript/`** — TypeScript/Node wrapper (`npm install` in `typescript/`)
- **`java/`** — Java wrapper (Maven project)
- **`csharp/`** — C# wrapper (.NET project)

## Quick Start

After cloning, installing the binary (from the publisher), and setting your license key:

```bash
ddp process /path/to/ddp /path/to/output --license-key "your-token"
```

See [docs/MANUAL.md](docs/MANUAL.md) for full documentation.
