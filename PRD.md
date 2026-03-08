# Ollama Manager - 产品需求文档（PRD）

## 1. 产品概述

**产品名称**：Ollama Manager

**一句话描述**：macOS 菜单栏应用，用于管理 Ollama 服务和本地大模型。

**目标用户**：本地部署大模型的 macOS 用户，需要便捷管理 Ollama 服务状态和模型资源。

**核心价值**：替代命令行操作，提供可视化的 Ollama 服务控制和模型生命周期管理。

## 2. 技术选型

| 层 | 选择 | 理由 |
|---|------|------|
| 框架 | Electron | 全栈 TypeScript、生态成熟、Node.js 层方便管理系统进程 |
| 前端 | React + TypeScript | 生态成熟、开发效率高 |
| UI | Tailwind CSS | 快速构建 |
| 构建 | electron-builder | 打包 DMG、自动更新 |
| 分发 | DMG + Homebrew Cask | 需管理系统进程，不适合 App Store Sandbox |

## 3. 功能规格

### P0 - MVP 必须

#### 3.1 菜单栏常驻

- 系统菜单栏显示图标，颜色反映 Ollama 运行状态
  - 绿色：运行中
  - 灰色：已停止
- 点击图标弹出管理面板（Popover 窗口）

#### 3.2 服务控制

- **启动 Ollama**：spawn `ollama serve` 子进程，支持配置环境变量
- **停止 Ollama**：终止 Ollama 进程
- **状态检测**：轮询 `GET http://localhost:11434/`，间隔 5 秒
- **启动来源感知**：检测 Ollama 是否由本应用启动、brew services 启动、或其他方式启动
  - 非本应用启动时，停止按钮需二次确认

#### 3.3 模型列表

- 调用 `GET /api/tags` 获取本地模型列表
- 展示信息：
  - 模型名称（name）
  - 大小（size，人类可读格式）
  - 量化类型（从 details 中提取）
  - 参数量（parameter_size）
  - 修改时间（modified_at）
- 支持按名称搜索/过滤
- 支持按大小、时间排序

#### 3.4 模型删除

- 选中模型后点击删除
- 二次确认弹窗，显示模型名和大小
- 调用 `DELETE /api/delete`
- 删除后自动刷新列表

#### 3.5 模型下载

- 输入框输入模型名称（如 `qwen3.5:27b`）
- 调用 `POST /api/pull`，解析 NDJSON 流
- 展示下载进度：
  - 当前文件进度条（百分比 + 已下载/总大小）
  - 下载速度
  - 预计剩余时间
- 支持取消下载

### P1 - 增强功能

#### 3.6 模型详情

- 点击模型查看详情面板
- 调用 `POST /api/show` 获取：
  - 模型架构信息
  - Modelfile 内容
  - 模板（template）
  - 系统提示词（system）
  - License 信息

#### 3.7 运行中模型监控

- 调用 `GET /api/ps` 显示当前加载到内存的模型
- 展示信息：
  - 模型名称
  - 内存占用（size / vram）
  - 过期时间（expires_at）
- 支持手动卸载模型（通过设置 keep_alive 为 0 触发）

#### 3.8 Ollama 启动配置

- 可视化配置 Ollama 启动环境变量：
  - `OLLAMA_FLASH_ATTENTION`（开/关）
  - `OLLAMA_KV_CACHE_TYPE`（q8_0 / q4_0 / f16）
  - `OLLAMA_NUM_PARALLEL`（并发数）
  - `OLLAMA_KEEP_ALIVE`（模型保持时间）
  - `OLLAMA_MAX_LOADED_MODELS`（最大加载数）
  - `OLLAMA_HOST`（监听地址）
- 配置持久化到本地文件

#### 3.9 开机自启

- 设置选项：开机时自动启动 Ollama Manager
- 设置选项：启动 Manager 时自动启动 Ollama 服务

### P2 - 未来规划

#### 3.10 Modelfile 管理

- 从本地 GGUF 文件创建模型（可视化 Modelfile 编辑器）
- 调用 `POST /api/create`

#### 3.11 模型仓库浏览

- 浏览 Ollama Library 可用模型
- 展示模型介绍、可用 tag、大小
- 一键 pull

#### 3.12 资源监控

- 实时显示系统内存使用
- 显示模型加载后的内存变化

## 4. API 参考

所有接口基于 Ollama REST API（默认 `http://localhost:11434`）。

| 接口 | 方法 | 用途 | 响应格式 |
|------|------|------|---------|
| `/` | GET | 健康检查 | text |
| `/api/tags` | GET | 本地模型列表 | JSON |
| `/api/show` | POST | 模型详情 | JSON |
| `/api/pull` | POST | 下载模型 | NDJSON stream |
| `/api/delete` | DELETE | 删除模型 | JSON |
| `/api/ps` | GET | 运行中的模型 | JSON |
| `/api/create` | POST | 创建模型 | NDJSON stream |

## 5. 设计规范

### 布局

- 菜单栏 Popover 窗口，宽 400px，高度自适应（最大 600px）
- 顶部：服务状态 + 启停按钮
- 中部：模型列表（滚动）
- 底部：下载输入 + 设置入口

### 视觉风格

- 跟随系统 Light/Dark Mode
- macOS 原生毛玻璃效果（vibrancy）
- 最小化视觉噪音，信息密度优先

### 交互

- 所有破坏性操作（删除、停止服务）需二次确认
- 下载进度实时更新，不阻塞其他操作
- 模型列表支持键盘导航

## 6. 非功能需求

| 项 | 要求 |
|----|------|
| 启动时间 | < 1 秒 |
| 内存占用 | < 50MB |
| 安装包大小 | < 100MB（Electron 含 Chromium） |
| 最低系统版本 | macOS 13 (Ventura) |
| 架构支持 | Apple Silicon (ARM64) + Intel (x86_64) |

## 7. 里程碑

| 阶段 | 范围 | 目标 |
|------|------|------|
| M1 - MVP | P0（3.1-3.5） | 菜单栏启停 + 模型列表/删除/下载 |
| M2 - 增强 | P1（3.6-3.9） | 模型详情 + 运行监控 + 配置管理 |
| M3 - 完善 | P2（3.10-3.12） | Modelfile 编辑 + 仓库浏览 + 资源监控 |
