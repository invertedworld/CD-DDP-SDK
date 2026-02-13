# DDP SDK (Java)

Thin wrapper around the `ddp` binary. License key validation and DDP parsing run in native code.

See the [unified manual](../docs/MANUAL.md) for full documentation.

## Requirements

- Java 17+
- Maven 3.6+
- `ddp` binary in PATH (or set `DDP_SDK_BIN` to its path)

## Install

```xml
<dependency>
    <groupId>ddp.sdk</groupId>
    <artifactId>ddp-sdk</artifactId>
    <version>0.1.0</version>
</dependency>
```

Or add as a local module:

```xml
<dependency>
    <groupId>ddp.sdk</groupId>
    <artifactId>ddp-sdk</artifactId>
    <version>0.1.0</version>
    <scope>system</scope>
    <systemPath>${project.basedir}/path/to/CD-DDP-SDK/java/target/ddp-sdk-0.1.0.jar</systemPath>
</dependency>
```

## Example

```java
import ddp.engine.DDPEngine;
import com.fasterxml.jackson.databind.JsonNode;

// From path
JsonNode metadata = DDPEngine.process("/path/to/ddp", "/path/to/output", "your-api-key");

// From in-memory files
var files = Map.of(
    "DDPID", Files.readAllBytes(Path.of("DDPID")),
    "PQDESCR", Files.readAllBytes(Path.of("PQDESCR")),
    "DDPMS", Files.readAllBytes(Path.of("DDPMS"))
);
var result = DDPEngine.processFromBytes(files, "your-api-key");
// result.metadata() -> JsonNode, result.wavs() -> List<WavEntry>
```
