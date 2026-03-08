# OllamaTray Development Guide

## Quick Reference

- **Dev**: `pnpm run dev`
- **Typecheck**: `pnpm run typecheck`
- **E2E tests**: `pnpm run test:e2e`
- **Build**: `pnpm run build:mac` / `pnpm run build:win`

## Ollama Version Requirement

**Minimum Ollama version: 0.5.0** (defined in `src/shared/types.ts` as `MIN_OLLAMA_VERSION`)

The app detects the Ollama version via `GET /api/version` and shows a warning banner if outdated.

## Ollama REST API Reference

All API calls go through `src/main/ollama/api.ts`. The base URL is resolved from `OLLAMA_HOST` env var or `electron-store` config.

### Endpoints Used

| Endpoint | Method | Purpose |
|---|---|---|
| `/` | GET | Health check |
| `/api/version` | GET | Get server version |
| `/api/tags` | GET | List installed models |
| `/api/pull` | POST | Pull model from registry (streaming) |
| `/api/delete` | DELETE | Delete a model |
| `/api/blobs/sha256:<digest>` | HEAD | Check if blob exists |
| `/api/blobs/sha256:<digest>` | POST | Upload file as blob (streaming body) |
| `/api/ps` | GET | List running (loaded) models |
| `/api/generate` | POST | Generate (used with keep_alive:0 to unload) |
| `/api/show` | POST | Get model details (parameters, template, system, license) |
| `/api/copy` | POST | Copy model to new name |
| `/api/create` | POST | Create model from blobs (streaming response) |

### GGUF Model Import Flow (Critical)

Importing local GGUF files requires a **two-step blob-based process**. Do NOT use the deprecated `modelfile` parameter.

```
Step 1: For each GGUF file
  - Calculate SHA256 hash of the file
  - HEAD /api/blobs/sha256:<hash>  → check if already uploaded
  - POST /api/blobs/sha256:<hash>  → upload file content as request body (streaming)

Step 2: Create model
  POST /api/create
  {
    "model": "model-name",
    "files": {
      "filename.gguf": "sha256:<hash>",
      "filename-00002-of-00004.gguf": "sha256:<hash2>"  // for split shards
    },
    "stream": true
  }
```

**Split GGUF files** (e.g., `model-00001-of-00004.gguf`) are shards of a single model. The scan handler groups them automatically by detecting the `-NNNNN-of-NNNNN.gguf` pattern.

### Deprecated API Patterns (Do NOT Use)

```
// OLD - silently succeeds but creates nothing:
POST /api/create { "name": "...", "modelfile": "FROM /path/to/file.gguf" }

// OLD - "name" field replaced by "model":
POST /api/create { "name": "..." }
```

### Create Model Parameters (Current API)

```typescript
{
  model: string       // Required. Name for the new model
  from?: string       // Create from existing model (e.g., "llama3.2")
  files?: Record<string, string>  // GGUF/Safetensors: { filename: "sha256:..." }
  adapters?: Record<string, string>  // LORA adapters
  template?: string   // Prompt template
  system?: string     // System prompt
  license?: string | string[]
  parameters?: object // Model parameters (temperature, num_ctx, etc.)
  messages?: Array<{ role: string; content: string }>
  quantize?: string   // e.g., "q4_K_M", "q8_0"
  stream?: boolean    // Default: true
}
```

### Environment Variables

| Variable | Purpose |
|---|---|
| `OLLAMA_HOST` | Server address (default: `127.0.0.1:11434`) |
| `OLLAMA_MODELS` | Custom models storage directory |

These are passed to `ollama serve` via the managed process spawn in `src/main/ollama/service.ts`.

## Logging System

`src/main/logger.ts` provides a tagged file-based logger.

```typescript
import { createLogger } from '../logger'
const log = createLogger('my-module')

log.info('Starting process', { pid: 123 })
log.error('Failed to connect', { url })
```

- Outputs to both console and file simultaneously
- Log file: `app.getPath('logs')/main-YYYY-MM-DD.log`
- Levels: `debug` | `info` | `warn` | `error`
- Use `getLogPath()` to get current log file path
- Use `setLogLevel()` to change minimum level

## Architecture

```
src/shared/         Types, IPC channels, constants (shared between main & renderer)
src/main/
  logger.ts         Tagged file-based logging (createLogger, getLogPath)
  notifications.ts  System notifications (download/import complete, service stopped)
  ollama/api.ts     REST client (all Ollama HTTP calls, blob upload)
  ollama/service.ts Cross-platform process management (spawn/kill ollama)
  ollama/status-poller.ts  Periodic health + version polling
  ipc/handlers.ts   All IPC handlers (bridges renderer ↔ main)
  store.ts          electron-store for persistent config (host, theme, launchAtLogin, notifications)
src/preload/        contextBridge typed API
src/renderer/
  stores/           Zustand store
  components/       React UI components
    Settings.tsx    Host/port, models dir, theme, launch at login, notifications
    RunningModels.tsx  Running models list with unload button
    VersionWarning.tsx  Ollama version check banner
    PullModelInput.tsx  Model pull + GGUF scan/import UI
e2e/                Playwright tests + mock Ollama HTTP server
```

## IPC Channels

All channels are defined in `src/shared/channels.ts`. The preload bridge (`src/preload/index.ts`) must mirror `ElectronAPI` in `src/shared/types.ts`.

| Channel | Direction | Purpose |
|---|---|---|
| `ollama:get-status` | invoke | Get running status + version |
| `ollama:start-service` | invoke | Start Ollama process |
| `ollama:stop-service` | invoke | Stop Ollama process |
| `ollama:list-models` | invoke | List installed models |
| `ollama:delete-model` | invoke | Delete a model |
| `ollama:pull-model` | invoke | Pull model from registry |
| `ollama:cancel-pull` | invoke | Cancel in-progress pull |
| `ollama:get-config` | invoke | Get app config (host, dirs) |
| `ollama:set-config` | invoke | Save app config |
| `ollama:select-directory` | invoke | Open native directory picker |
| `ollama:scan-gguf-models` | invoke | Scan for local GGUF files |
| `ollama:import-model` | invoke | Import GGUF model (blob upload + create) |
| `ollama:list-running` | invoke | List running (loaded) models |
| `ollama:unload-model` | invoke | Unload model from memory |
| `ollama:get-log-path` | invoke | Get current log file path |
| `ollama:open-url` | send | Open URL in default browser |
| `ollama:status-changed` | event | Broadcast status changes |
| `ollama:pull-progress` | event | Broadcast pull progress |
| `ollama:pull-complete` | event | Broadcast pull completion |
| `app:get-launch-at-login` | invoke | Get launch at login setting |
| `app:set-launch-at-login` | invoke | Set launch at login |
| `app:get-theme` | invoke | Get theme mode (system/light/dark) |
| `app:set-theme` | invoke | Set theme mode |
| `app:theme-changed` | event | Broadcast theme changes |
| `app:get-notifications-enabled` | invoke | Get notifications setting |
| `app:set-notifications-enabled` | invoke | Set notifications setting |

## Configurable Ollama Host

The Ollama server address is configurable via Settings UI. Stored in `electron-store` as `ollamaHost` (default: `127.0.0.1:11434`). The base URL in `api.ts` resolves from: `electron-store` config > `OLLAMA_HOST` env var > default.

## Key Conventions

- All IPC channels are defined in `src/shared/channels.ts`
- All shared types in `src/shared/types.ts` (includes `ElectronAPI` interface)
- The preload bridge must mirror `ElectronAPI` exactly
- E2E tests use a mock Ollama server (`e2e/mock-ollama-server.ts`) via `OLLAMA_HOST` env var
- UI uses hand-rolled shadcn-style components in `src/renderer/src/components/ui/`
- Tailwind CSS v4 via `@tailwindcss/vite`
- Use `createLogger(tag)` for logging in main process modules
