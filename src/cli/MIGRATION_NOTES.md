# CLI Migration Notes

## Migration Status

The CLI code has been successfully migrated from the original source to the Nx monorepo structure at `apps/cli/`.

### Completed Steps

1. ✅ Created `apps/cli` directory
2. ✅ Copied all existing Go code from source
3. ✅ Preserved existing directory structure (cmd/, internal/, core/, service/, types/, etc.)
4. ✅ Copied go.mod and go.sum files
5. ✅ Created project.json with Nx targets for build, test, and lint
6. ✅ Configured build to output binary as "filemoverexpress"

### Pending Work

#### Proto Constant Naming Mismatch

The CLI code has been updated to import from the new proto location (`github.com/awslabs/filemoverexpress/protobuf/fme/v1`), but there's a
mismatch in constant naming:

**Issue:**

- Old proto constants: `EventType_ALERT_EVENT_TYPE`
- New proto constants: `EventType_EVENT_TYPE_ALERT_EVENT_TYPE`

The new proto files follow better naming conventions with an `EVENT_TYPE_` prefix. The CLI code needs to be updated to use the new constant
names.

**Affected Areas:**

- All files in `types/eventtypes/` that reference EventType constants
- Any other files that use proto enum constants

**Resolution:**
This should be handled as part of task 3.2 "Configure CLI build dependencies" which involves updating the CLI code to work with the
generated proto code.

#### Proto Import Path Updates

The CLI currently uses its own generated protobuf files located at `types/pbtypes/`. According to the monorepo design, these should be
replaced with references to the centrally generated proto code at `../../dist/libs/proto-gen/go`.

**Current State:**

- CLI imports: `github.com/awslabs/filemoverexpress/types/pbtypes`
- Generated proto location: `dist/libs/proto-gen/go/`
- Generated proto package: `_go` (needs to be updated to `pbtypes` or similar)

**Required Changes:**

1. **Update buf.gen.yaml** to generate Go code with proper package structure:
   ```yaml
   plugins:
     - local: protoc-gen-go
       out: ../../dist/libs/proto-gen/go
       opt:
         - paths=source_relative
         - go_package=github.com/file-mover-express/proto-gen/go/pbtypes
   ```

2. **Update CLI imports** throughout the codebase:
    - Find: `github.com/awslabs/filemoverexpress/types/pbtypes`
    - Replace with: Path to generated proto code (TBD based on final structure)

3. **Remove old generated files** from `apps/cli/types/pbtypes/` once migration is complete

4. **Update go.mod** if needed to reference the new proto package location

**Files Affected:**

- All files in `service/` directory
- Files in `types/` subdirectories (jobmanagertypes, eventtypes, configtypes, etc.)
- Any other files importing pbtypes

**Recommendation:**
This should be handled as part of task 3.2 "Configure CLI build dependencies" which explicitly mentions updating Go code to import generated
ConnectRPC server types.

## Build Instructions

### Using Nx

```bash
# Build the CLI
nx build cli

# Run tests
nx test cli

# Run linter
nx lint cli

# Run with coverage
nx test-coverage cli
```

### Direct Go Commands

```bash
cd apps/cli

# Build
go build -o ../../dist/apps/cli/filemoverexpress

# Test
go test ./...

# Lint
golangci-lint run
```

## Directory Structure

```
apps/cli/
├── cmd/                    # Cobra command definitions
├── core/                   # Core transfer logic
├── service/                # gRPC service implementations
├── types/                  # Type definitions
│   ├── pbtypes/           # Generated protobuf (to be replaced)
│   └── ...
├── config/                 # Configuration management
├── events/                 # Event bus
├── logger/                 # Logging
├── utils/                  # Utilities
├── e2e-tests/             # End-to-end tests
├── testdata/              # Test fixtures
├── go.mod                 # Go module definition
├── go.sum                 # Go dependencies
├── main.go                # Application entry point
└── project.json           # Nx project configuration
```

## Next Steps

1. Complete task 3.2: Configure CLI build dependencies
2. Update proto generation to use correct package structure
3. Update all import paths in CLI code
4. Remove old generated proto files
5. Verify build and tests pass with new structure
