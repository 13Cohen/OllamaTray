# OllamaTray

System tray app for managing [Ollama](https://ollama.com) service and local LLMs. Available for macOS and Windows.

![Electron](https://img.shields.io/badge/Electron-39-47848F?logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

[中文文档](./README.zh-CN.md)

## Features

- **Service Control** — Start/stop Ollama from the tray with one click. Detects whether Ollama was started by this app, Homebrew, or externally, and warns before stopping external instances.
- **Model Management** — View all local models with name, size, quantization type, parameter count, and last modified time. Search and sort by name/size/date.
- **Model Download** — Pull models by name with real-time progress (speed, ETA, percentage). Supports cancellation. NDJSON stream parsing.
- **GGUF Import** — Import local GGUF model files via blob-based upload. Automatically detects and groups split shard files (e.g. `model-00001-of-00004.gguf`). Batch import with progress tracking.
- **Model Deletion** — Delete models with confirmation dialog showing model name and size.
- **Version Detection** — Displays Ollama server version in the status bar. Shows a warning banner if the installed version is below the minimum requirement (v0.5.0), with a one-click link to upgrade.
- **Settings** — Configure Ollama host/port and models directory. Copy API URL to clipboard. View and open log files.
- **System Tray** — Lives in your menu bar (macOS) or system tray (Windows). Icon color reflects Ollama status: green = running, gray = stopped.
- **Native Look** — macOS vibrancy (frosted glass), Windows Mica material. Auto dark/light mode.
- **Logging** — Built-in file-based logging system for debugging. Logs are stored per-day in the app's log directory.

## Install

### From Source

```bash
git clone https://github.com/13Cohen/OllamaTray.git
cd OllamaTray
pnpm install
pnpm run dev
```

### Build

```bash
# macOS (DMG, arm64 + x64)
pnpm run build:mac

# Windows (NSIS installer, x64 + arm64)
pnpm run build:win
```

## Prerequisites

- [Ollama](https://ollama.com/download) v0.5.0 or later must be installed on your system
- OllamaTray manages the Ollama service — it does not bundle Ollama itself

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Electron 39 + electron-vite |
| Frontend | React 19 + TypeScript 5 |
| Styling | Tailwind CSS v4 |
| State | Zustand |
| Storage | electron-store |
| Testing | Playwright (Electron E2E) |
| Packaging | electron-builder |

## Project Structure

```
src/
├── shared/              # Types, IPC channel constants, MIN_OLLAMA_VERSION
├── main/
│   ├── index.ts         # Tray + window management
│   ├── logger.ts        # File-based logging system
│   ├── ipc/handlers.ts  # IPC handler registration
│   ├── ollama/
│   │   ├── api.ts       # Ollama REST API client (NDJSON streaming, blob upload)
│   │   ├── service.ts   # Process management (macOS + Windows)
│   │   └── status-poller.ts  # Health + version polling
│   └── store.ts         # electron-store config
├── preload/             # contextBridge (typed API)
└── renderer/src/
    ├── components/      # ServiceStatus, ModelList, PullModelInput, Settings, VersionWarning, etc.
    ├── stores/          # Zustand store
    └── styles/          # Tailwind globals
e2e/                     # Playwright E2E tests with mock Ollama server
```

## Testing

E2E tests use Playwright with a mock Ollama HTTP server — no real Ollama instance needed.

```bash
pnpm run test:e2e
```

## Development

```bash
pnpm run dev          # Start dev server with HMR
pnpm run typecheck    # TypeScript checking
pnpm run lint         # ESLint
pnpm run format       # Prettier
```

## License

MIT
