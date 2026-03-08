# OllamaTray

系统托盘应用，用于管理 [Ollama](https://ollama.com) 服务和本地大模型。支持 macOS 和 Windows。

![Electron](https://img.shields.io/badge/Electron-39-47848F?logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

[English](./README.md)

## 功能特性

- **服务控制** — 从托盘一键启停 Ollama。自动检测 Ollama 的启动来源（本应用 / Homebrew / 外部），停止非本应用启动的实例时会二次确认。
- **模型管理** — 查看所有本地模型，展示名称、大小、量化类型、参数量、修改时间。支持搜索过滤和按名称/大小/时间排序。
- **模型下载** — 输入模型名称即可拉取，实时显示下载进度（速度、预计剩余时间、百分比）。支持取消下载。基于 NDJSON 流解析。
- **模型删除** — 删除前弹出确认对话框，显示模型名称和大小。
- **系统托盘** — 常驻菜单栏（macOS）或系统托盘（Windows）。图标颜色反映 Ollama 状态：绿色 = 运行中，灰色 = 已停止。
- **原生外观** — macOS 毛玻璃效果（vibrancy），Windows Mica 材质。自动跟随系统深色/浅色模式。

## 安装

### 从源码构建

```bash
git clone https://github.com/13Cohen/OllamaTray.git
cd OllamaTray
npm install
npm run dev
```

### 打包

```bash
# macOS（DMG，arm64 + x64）
npm run build:mac

# Windows（NSIS 安装包，x64 + arm64）
npm run build:win
```

## 前置要求

- 系统需已安装 [Ollama](https://ollama.com/download)
- OllamaTray 负责管理 Ollama 服务，不内置 Ollama 本体

## 技术栈

| 层 | 选择 |
|----|------|
| 框架 | Electron 39 + electron-vite |
| 前端 | React 19 + TypeScript 5 |
| 样式 | Tailwind CSS v4 |
| 状态管理 | Zustand |
| 配置存储 | electron-store |
| 测试 | Playwright（Electron E2E） |
| 打包 | electron-builder |

## 项目结构

```
src/
├── shared/              # 共享类型与 IPC 通道常量
├── main/
│   ├── index.ts         # 托盘 + 窗口管理
│   ├── ipc/handlers.ts  # IPC 处理器注册
│   ├── ollama/
│   │   ├── api.ts       # Ollama REST API 客户端（NDJSON 流）
│   │   ├── service.ts   # 进程管理（macOS + Windows）
│   │   └── status-poller.ts
│   └── store.ts         # electron-store 配置
├── preload/             # contextBridge（类型安全 API）
└── renderer/src/
    ├── components/      # ServiceStatus, ModelList, PullProgress 等
    ├── stores/          # Zustand store
    └── styles/          # Tailwind 全局样式
e2e/                     # Playwright E2E 测试 + 模拟 Ollama 服务器
```

## 测试

E2E 测试使用 Playwright 配合模拟 Ollama HTTP 服务器 — 无需真实 Ollama 实例。

```bash
npm run test:e2e
```

## 开发

```bash
npm run dev          # 启动开发服务器（HMR 热更新）
npm run typecheck    # TypeScript 类型检查
npm run lint         # ESLint 检查
npm run format       # Prettier 格式化
```

## 开源协议

MIT
