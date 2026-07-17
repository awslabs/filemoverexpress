# MCP Server

File Mover Express includes a standalone [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) server that lets AI assistants manage file transfers through natural language. Connect it to any MCP-compatible client (Claude Desktop, Kiro, Cursor, etc.) and control uploads, downloads, and job monitoring conversationally.

## Why MCP?

MCP turns File Mover Express into AI-native infrastructure. Instead of memorizing CLI flags or navigating the GUI, you can say:

- "Upload everything in `/Volumes/Media/DailyRushes` to my production profile"
- "List my active transfers and pause the one going to the archive bucket"
- "Browse my S3 bucket and download the footage from last Tuesday"

The MCP server connects to the same FME daemon that the GUI and CLI use — no separate configuration, no duplicate logic. Your transfer profiles, checksums, hot folders, and tuning settings all work as-is.

## Prerequisites

1. **File Mover Express installed** — the `fme-mcp` binary ships alongside the main application
2. **FME daemon running** — the MCP server connects to the daemon's ConnectRPC API
3. **An MCP-compatible client** — Claude Desktop, Kiro, Cursor, or any tool that supports the MCP protocol

## Setup

### 1. Start the FME daemon

```bash
filemoverexpress daemon
```

The daemon listens on `http://127.0.0.1:50006` by default.

### 2. Allow the MCP origin

Add `mcp://fme` to the allowed origins in your FME configuration file (`~/.filemoverexpress/configuration.yaml`):

```yaml
apiServer:
    allowedOrigins:
        - mcp://fme
```

The daemon watches this file for changes and reloads automatically — no restart needed.

### 3. Configure your MCP client

Add the FME MCP server to your client's configuration. The exact location depends on your client:

**Kiro** (`~/.kiro/settings/mcp.json`):
```json
{
  "mcpServers": {
    "fme": {
      "command": "/path/to/fme-mcp",
      "args": ["--transport", "stdio"]
    }
  }
}
```

**Claude Desktop** (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "fme": {
      "command": "/path/to/fme-mcp",
      "args": ["--transport", "stdio"]
    }
  }
}
```

Replace `/path/to/fme-mcp` with the actual path to the binary. Typical locations by platform:

| Platform | Typical Location |
|----------|-----------------|
| macOS | `/usr/local/bin/fme-mcp` |
| Windows | `C:\Program Files\FileMoverExpress\fme-mcp.exe` |
| Linux | `/usr/local/bin/fme-mcp` |

Download the correct binary for your platform from the [Releases page](https://github.com/awslabs/filemoverexpress/releases) and place it in one of the locations above (or anywhere on your PATH).

### 4. Verify the connection

Ask your AI assistant: "List my transfer jobs." If the daemon is running and the origin is allowed, you'll get a response (even if the job list is empty).

## Available Tools

The MCP server exposes 9 tools:

### Connection

| Tool | Description |
|------|-------------|
| `fme_connect` | Connect to an FME daemon at a specific address (local or remote with PSK auth) |

### Browsing

| Tool | Description |
|------|-------------|
| `fme_browse_local_folder` | Browse the local filesystem on the daemon host |
| `fme_browse_s3_prefix` | Browse S3 objects using a configured transfer profile |

### Transfers

| Tool | Description |
|------|-------------|
| `fme_start_upload` | Start uploading local files to S3 |
| `fme_start_download` | Start downloading S3 objects to a local path |

### Job Control

| Tool | Description |
|------|-------------|
| `fme_list_jobs` | List all active and completed transfer jobs |
| `fme_pause_job` | Pause a running transfer |
| `fme_resume_job` | Resume a paused transfer |
| `fme_cancel_job` | Cancel a transfer |

## Transport Modes

The MCP server supports two transport modes:

### stdio (default)

Used by MCP clients that launch the server as a subprocess. This is the standard mode for Claude Desktop, Kiro, Cursor, etc.

```bash
fme-mcp --transport stdio
```

### Streamable HTTP

For network-accessible deployments or browser-based MCP clients:

```bash
fme-mcp --transport streamable-http --http-port 8080
```

By default, streamable HTTP binds to all interfaces (`0.0.0.0`). In production, place it behind a reverse proxy or firewall — do not expose it directly to the internet without authentication.

## Remote Daemon Connections

The MCP server auto-connects to the local daemon at `http://127.0.0.1:50006` on startup. To connect to a remote daemon, use the `fme_connect` tool:

```
Connect to my remote daemon at http://192.168.1.100:50006 with auth key "my-secret-key"
```

Remote connections require a pre-shared key (the same PSK configured in the remote daemon's `apiServer.remote.key` setting). Local connections don't require a key.

If the daemon is unreachable, the MCP server enters a retry loop (every 30 seconds) until the connection succeeds.

## Examples

### Upload a directory

> "Upload /Volumes/Media/Project-Alpha to my production profile at dailies/2026-07-12/"

The AI will call `fme_start_upload` with your local path, transfer profile, and S3 destination prefix.

### Monitor progress

> "How are my transfers doing?"

The AI calls `fme_list_jobs` and reports status, bytes transferred, and any errors.

### Browse and download

> "What's in my S3 bucket under footage/camera-b/? Download the .mov files to my Desktop."

The AI browses with `fme_browse_s3_prefix`, then initiates downloads with `fme_start_download`.

### Pause and resume

> "Pause the upload job — my network is congested. Resume it in a few minutes."

The AI calls `fme_pause_job`, and later `fme_resume_job` when you ask.

## Troubleshooting

### "not connected to daemon" error

The MCP server can't reach the FME daemon. Check:
- Is the daemon running? (`filemoverexpress daemon`)
- Is it on the expected port? (default 50006)
- Use `fme_connect` to explicitly set the address

### "Rejecting connection attempt... invalid CORS header: mcp://fme"

The daemon is running but `mcp://fme` isn't in the allowed origins. Add it to `~/.filemoverexpress/configuration.yaml` under `apiServer.allowedOrigins`. Make sure to use spaces (not tabs) for YAML indentation.

### Connection keeps retrying

The MCP server retries every 30 seconds when the daemon is unreachable. Start the daemon and the connection will establish automatically on the next retry cycle, or use `fme_connect` to force an immediate reconnection attempt.

## Security Considerations

- The MCP server has full access to whatever the daemon can do — browsing, uploading, downloading, and managing jobs. Only enable it if you trust the MCP client.
- The `mcp://fme` origin must be explicitly added to `allowedOrigins` — it is not enabled by default.
- Remote daemon connections require PSK authentication. Never expose a remote daemon without a strong pre-shared key.
- The MCP server itself doesn't store credentials — it relies on the daemon's existing AWS credential configuration (IAM profiles, environment variables, etc.).
