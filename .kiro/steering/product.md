# Product Overview

File Mover Express (FME) is a high-performance file transfer application for moving media assets between local filesystems and Amazon S3. It targets digital imaging technicians and content creators.

It provides two interfaces:
- A Go-based CLI daemon for scripting, automation, and headless operation
- An Angular GUI (packaged via Electron) for drag-and-drop file management

Key capabilities:
- Auto-tuned parallel transfers with multipart upload optimization
- Hot folder monitoring for automatic uploads
- Checksumming (MD5, XXHash, XXHash64, XXH3) with MHL (Media Hash List) support
- Cross-platform: macOS (x64/ARM64), Windows (x64), Linux (x64/ARM64)
- AWS IAM integration for authentication and authorization

The CLI runs as a daemon process. The GUI communicates with the daemon over ConnectRPC (protobuf-based). This client-server architecture means the GUI and CLI share protobuf service definitions but are otherwise independent codebases.
