# The DDP manifest

A JSON document describing one disc. Track file paths are resolved relative to the
manifest, so a manifest and its `audio/` directory travel together.

**One schema, both directions.** The reader SDK writes this document when it extracts a
disc, and the builder reads it when it presses one, so an extract is directly a build
input:

```bash
ddp process      master/ extract/     # writes extract/metadata.json
ddpbuild build   extract/metadata.json rebuilt/
```

That is what makes a bit-identical round trip possible: there is no translation step in
between for the two sides to disagree in. Both binaries share one implementation of
this schema, so they cannot drift apart.

Fields divide in two. Most describe what the disc should contain and are what the
builder acts on. A few are **derived** — times, byte offsets, totals — which the reader
fills in from a disc it read and the builder ignores. They are marked below.

Unknown fields are an error, not silently ignored, and the message lists the fields
that were expected — a typo in `titel` should not ship a disc with no title.

## Shape

```json
{
  "disc":   { ... },
  "tracks": [ { ... }, { ... } ]
}
```

## Times

Anywhere a duration or offset is wanted, three forms are accepted:

| Form | Example | Meaning |
|---|---|---|
| `"MM:SS:FF"` | `"00:05:00"` | 5 seconds, 375 sectors |
| number | `5` or `5.0` | seconds, rounded to the nearest sector |
| object | `{"sectors": 375}` | exact sectors (`frames` is accepted too) |

A sector is 1/75 second: 2352 bytes, 588 stereo samples. All three forms describe the
same thing; use whichever the source material speaks in.

## `disc`

| Field | Type | Notes |
|---|---|---|
| `title` | string | Disc title. CD-TEXT pack 0x80, element 0. Alias: `album_title` |
| `performer` | string | Disc artist. Pack 0x81. Aliases: `album_artist`, `artist` |
| `songwriter` | string | Pack 0x82 |
| `composer` | string | Pack 0x83 |
| `arranger` | string | Pack 0x84 |
| `message` | string | Pack 0x85 |
| `disc_id` | string | Pack 0x86 |
| `genre` | string | Genre description, pack 0x87 |
| `genre_code` | number | CD-TEXT genre code. 0 means "not used" |
| `upc_ean` | string | 12 or 13 digits. Written to DDPID and the first PQ packet. Aliases: `upc`, `ean`, `mcn`, `catalog_number` |
| `master_id` | string | Job reference, DDPID Master ID (48 bytes) |
| `text` | string | DDPID user text (33 bytes). Defaults to `ddpbuild vX.Y.Z`. Alias: `ddpid_text` |
| `lead_in_pregap` | time | Pause before track 1 index 01. Defaults to `"00:02:00"`, which Red Book requires |
| `cd_text` | bool or object | See below |
| `ident_file` | string | Use this file as `IDENT.TXT` verbatim instead of generating one |
| `format_version` | string | *Derived.* DDP level of the disc read |
| `byte_order` | string | *Derived.* |
| `total_sectors` | number | *Derived.* Length of the program area |
| `total_time` | string | *Derived.* Program length as `MM:SS:FF` |

The aliases match the field names the reader SDK writes into `metadata.json`, so
metadata read off an existing disc can be edited into a manifest without renaming.

### `cd_text`

`true` writes `CDTEXT.BIN` when there is anything to say; `false` or omitted writes
none. As an object:

| Field | Type | Default | Notes |
|---|---|---|---|
| `enabled` | bool | `true` | |
| `language` | string or number | `"english"` | EBU language name or numeric code |
| `include_upc_isrc` | bool | `false` | Also carry UPC and ISRC in pack 0x8E |
| `file` | string | — | Use this `CDTEXT.BIN` verbatim instead of building one |

`include_upc_isrc` is off by default because the PQ descriptor is the authoritative
place for both, and two copies can disagree.

Text must be representable in ISO 8859-1, which is what CD-TEXT character code 0x00
means. A character outside it is an error naming the character. A CD-TEXT block holds
at most 256 packs; exceeding it is an error.

Leaving a track's CD-TEXT field empty means "same as the previous track", which is how
a disc-wide performer is carried in three packs rather than one per track.

## `tracks[]`

| Field | Type | Notes |
|---|---|---|
| `file` | string | **Required.** WAV path, relative to the manifest. Aliases: `path`, `wav` |
| `title` | string | Pack 0x80 |
| `performer` | string | Pack 0x81. Alias: `artist` |
| `songwriter`, `composer`, `arranger`, `message` | string | Packs 0x82–0x85 |
| `isrc` | string | 12 characters, `CCXXXYYNNNNN`. Hyphens and spaces are stripped |
| `pregap` | time | Pause before this track, carried as index 00 |
| `pregap_source` | `"silence"` or `"audio"` | Where the pause's audio comes from. Default `"silence"` |
| `indices` | array of time | Extra index marks, measured from index 01. They become index 02 upward |
| `pre_emphasis` | bool | Q-channel control bit 0 |
| `copy_permitted` | bool | Control bit 1. Aliases: `digital_copy`, `copy_permit` |
| `four_channel` | bool | Control bit 3 |
| `track_number` | number | *Derived.* |
| `start_time`, `end_time`, `duration` | string | *Derived.* `MM:SS:FF` |
| `start_byte`, `end_byte` | number | *Derived.* Offsets into the image |

### Carrying files through verbatim

`cd_text.file` and `ident_file` exist because neither `CDTEXT.BIN` nor `IDENT.TXT` can
be regenerated byte for byte from a disc description. Tools lay CD-TEXT packs out in
slightly different but equally valid ways, and `IDENT.TXT` is free prose. A lossless
extract preserves both and points the manifest at them, so a rebuild carries the
originals rather than approximating them.

Tracks are numbered by their order in the array, starting at 1.

### Pregaps

`"silence"` inserts that much digital black ahead of the track's audio. This is what a
newly assembled album wants: each WAV is exactly its track.

`"audio"` says the pause is already the head of the track's own file, so index 01
falls `pregap` into it and nothing is inserted. Real masters need this — their pauses
hold dither, room tone or a fade rather than digital black, and only the source audio
has it. The pregap must be shorter than the file.

Track 1 is a partial special case: its pause is contiguous with the lead-in and is
sized by `disc.lead_in_pregap`, not by the track, so `pregap` on track 1 is ignored with
a warning. `pregap_source` still applies, so a master whose lead-in is not digital black
can be reproduced exactly.

### Control bits

`pre_emphasis`, `copy_permitted` and `four_channel` become the Q-channel control
nibble, written to PQ descriptor field CB1 as a hex digit followed by `1`:

| Bits set | CB1 | Meaning |
|---|---|---|
| none | `01` | 2-channel audio, no emphasis, copying prohibited |
| `pre_emphasis` | `11` | 50/15 µs pre-emphasis |
| `copy_permitted` | `21` | Digital copying permitted |
| `four_channel` | `81` | Four-channel audio |

The lead-in, the lead-out, and track 1's index 00 always carry control 0, matching both
reference masters.

Data tracks are not supported: this builder makes CD-DA from WAV audio, and a data
track needs Mode 1 or Mode 2 sectors rather than a WAV.

## Audio requirements

Every WAV must be 44.1 kHz, 16-bit, stereo, uncompressed PCM. Anything else is
rejected, naming the file, what it is, and what it needs to be. Nothing is resampled,
dithered or channel-mapped.

`WAVE_FORMAT_EXTENSIBLE` files are read (the real format tag is taken from the
sub-format GUID), and unknown chunks before `data` are skipped.

Audio that does not fill a whole number of 2352-byte sectors is padded with silence to
the sector boundary, because a CD cannot store a partial sector. Every pad is reported.

## Output

| File | Always | Contents |
|---|---|---|
| `DDPID` | yes | 128-byte identifier packet |
| `DDPMS` | yes | Map stream, one 128-byte packet per file |
| `PQDESCR` | yes | PQ descriptor, one 64-byte packet per subcode change |
| `IMAGE.DAT` | yes | CD-DA main channel, 2352 bytes per sector |
| `CDTEXT.BIN` | when `cd_text` | Sony CD-TEXT packs for the lead-in |
| `IDENT.TXT` | unless `--no-ident` | Human-readable mastering summary |
| `CHECKSUM.MD5` | unless `--no-checksum` | MD5 of every file above, `md5sum` binary format |

## A complete example

```json
{
  "disc": {
    "title": "Night Ferry",
    "performer": "The Harbour Lights",
    "upc_ean": "0602537351169",
    "master_id": "EXAMPLE-001",
    "cd_text": { "language": "english" }
  },
  "tracks": [
    {
      "file": "audio/01 Slack Water.wav",
      "title": "Slack Water",
      "performer": "The Harbour Lights",
      "isrc": "ZZABC2500001",
      "copy_permitted": true
    },
    {
      "file": "audio/02 Cold Harbour.wav",
      "title": "Cold Harbour",
      "isrc": "ZZABC2500002",
      "pregap": "00:05:00",
      "pregap_source": "audio",
      "copy_permitted": true,
      "indices": ["01:30:00"]
    }
  ]
}
```
