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
- **Model Deletion** — Delete models with confirmation dialog showing model name and size.
- **System Tray** — Lives in your menu bar (macOS) or system tray (Windows). Icon color reflects Ollama status: green = running, gray = stopped.
- **Native Look** — macOS vibrancy (frosted glass), Windows Mica material. Auto dark/light mode.

## Install

### From Source

```bash
git clone https://github.com/13Cohen/OllamaTray.git
cd OllamaTray
npm install
npm run dev
```

### Build

```bash
# macOS (DMG, arm64 + x64)
npm run build:mac

# Windows (NSIS installer, x64 + arm64)
npm run build:win
```

## Prerequisites

- [Ollama](https://ollama.com/download) must be installed on your system
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
├── shared/              # Types & IPC channel constants
├── main/
│   ├── index.ts         # Tray + window management
│   ├── ipc/handlers.ts  # IPC handler registration
│   ├── ollama/
│   │   ├── api.ts       # Ollama REST API client (NDJSON streaming)
│   │   ├── service.ts   # Process management (macOS + Windows)
│   │   └── status-poller.ts
│   └── store.ts         # electron-store config
├── preload/             # contextBridge (typed API)
└── renderer/src/
    ├── components/      # ServiceStatus, ModelList, PullProgress, etc.
    ├── stores/          # Zustand store
    └── styles/          # Tailwind globals
e2e/                     # Playwright E2E tests with mock Ollama server
```

## Testing

E2E tests use Playwright with a mock Ollama HTTP server — no real Ollama instance needed.

```bash
npm run test:e2e
```

## Development

```bash
npm run dev          # Start dev server with HMR
npm run typecheck    # TypeScript checking
npm run lint         # ESLint
npm run format       # Prettier
```

## License

MIT
