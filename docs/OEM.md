# Embedding the DDP writer (OEM)

For integrators shipping DDP writing inside their own application.

A sandboxed application cannot launch an arbitrary executable at all, so embedding is
the only option there.

## Which form

Both come from the same build, and the publisher supplies whichever you need.

| | Ships as | Your application must | Sandbox-safe |
|---|---|---|---|
| **Dynamic** | `libddpbuild.dylib` (macOS), `ddpbuild.dll` (Windows), `libddpbuild.so` (Linux), placed in your bundle | load a library — P/Invoke, JNI or FFM, N-API, `dlopen` | yes |
| **Static** | nothing separate; linked into your binary | build native code (C, C++, Objective-C, Swift, Rust) | yes |

The dynamic library is the usual choice. The static library is larger on disk because
it carries the whole runtime, but the linker discards what you do not call.

`ddp.h` ships with the library and is the entire interface.

## Licensing

**Your build carries its own licence.** It is embedded when the publisher compiles the
library for you, so `license_key` is `NULL` at every call site and your users never
enter anything.

```c
if (ddp_has_embedded_license()) {
    /* An OEM build: pass NULL and the library uses its own licence. */
}
```

The embedded licence names your company and carries an expiry, so a build is
time-bounded and renewed with each release you ship. It grants DDP **writing** only;
reading is a separate entitlement.

If you would rather your own customers hold their own licences, the same library
accepts a key passed in at each call. Ask the publisher for a build without one
embedded.

## The interface

Two operations, plus the handling around them.

```c
DdpStatus ddp_validate(const char *manifest_path,
                       uint32_t flags,
                       char **out_text);

DdpStatus ddp_build(const char *manifest_path,
                    const char *output_dir,
                    const char *license_key,   /* NULL on an OEM build */
                    uint32_t flags,
                    char **out_report_json);

const char *ddp_version(void);
const char *ddp_last_error(void);
bool        ddp_has_embedded_license(void);
void        ddp_string_free(char *s);
```

`ddp_validate` checks a manifest and the audio it names and returns the disc layout as
text, writing nothing. `ddp_build` writes the fileset and returns a JSON report: the
files produced with their MD5s, the track layout, the lead-out, and any warnings.

The manifest is the schema in [MANIFEST.md](MANIFEST.md) — the same document the
reader writes when it extracts a disc.

### Flags

| Flag | Effect |
|---|---|
| `DDP_BUILD_STRICT` | treat warnings as errors |
| `DDP_BUILD_NO_IDENT` | do not write `IDENT.TXT` |
| `DDP_BUILD_NO_CHECKSUM` | do not write `CHECKSUM.MD5` |

### Status codes

| Code | Meaning |
|---|---|
| `DDP_OK` | success |
| `DDP_ERR_INVALID_ARGUMENT` | a required pointer was `NULL`, or a string was not UTF-8 |
| `DDP_ERR_LICENSE` | no usable licence, or one not valid for building |
| `DDP_ERR_MANIFEST` | manifest missing, malformed, or describing an impossible disc |
| `DDP_ERR_AUDIO` | an audio file is missing, unreadable, or not Red Book |
| `DDP_ERR_RED_BOOK` | the disc would violate Red Book, or strict mode rejected a warning |
| `DDP_ERR_IO` | reading or writing failed |
| `DDP_ERR_INTERNAL` | a fault was caught at the boundary — please report it |

## Rules of the boundary

You are putting this in your process, so it is built to assume nothing about the caller.

- **Strings in** are NUL-terminated UTF-8.
- **Strings out** are allocated by the library. Release them with `ddp_string_free`,
  never `free`. On failure the out-parameter is left `NULL`.
- **Errors** go to `ddp_last_error()`, which is **per thread** and valid until that
  thread calls in again. Copy it if you need to keep it.
- **Threads** may call concurrently.
- **Faults are contained.** A fault inside the library is caught at the boundary and
  returned as `DDP_ERR_INTERNAL`. It will not unwind into your application, so a
  malformed disc cannot bring your process down.

## A complete host

```c
#include <stdio.h>
#include "ddp.h"

int write_disc(const char *manifest, const char *out_dir) {
    char *report = NULL;

    /* NULL licence key: an OEM build supplies its own. */
    DdpStatus st = ddp_build(manifest, out_dir, NULL, 0, &report);
    if (st != DDP_OK) {
        fprintf(stderr, "DDP build failed (%d): %s\n", st, ddp_last_error());
        return -1;
    }

    puts(report);              /* files written, with their MD5s */
    ddp_string_free(report);
    return 0;
}
```

Compile against the header and link the library:

```bash
cc -I. host.c -lddpbuild -o host
```

## macOS: signing and notarisation

A library nested inside your application must be signed, or **your** notarisation
fails. The publisher signs it with a Developer ID and the hardened runtime before
handing it over, so you can drop it into `YourApp.app/Contents/Frameworks/` and sign
your bundle over the top as usual.

It is a universal binary covering Apple Silicon and Intel, so one file serves any Mac.

If you re-sign it yourself, keep `--options runtime`.

## Audio requirements

Every WAV must be 44.1 kHz, 16-bit, stereo PCM. Anything else is refused, naming the
file, what it is, and what it needs to be. Nothing is ever resampled, dithered or
channel-mapped: a master is written as it was approved.

Audio that does not fill a whole number of 2352-byte sectors is padded to the sector
boundary with silence, because a CD cannot store a partial sector. Every pad is
reported in the build report so you can surface it.

## Getting a build

Contact the publisher with:

- the platforms you ship on
- dynamic or static
- whether you want the licence embedded (your users see nothing) or passed in
- the name to put on the licence, and the term

You will receive the library, `ddp.h`, and — if you asked for it — a build with your
licence already inside.
