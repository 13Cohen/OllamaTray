# OllamaTray Feature Roadmap

> 最后更新: 2026-03-09

## 状态说明

| 标记 | 含义 |
|------|------|
| ⬜ | 未开始 |
| 🔵 | 进行中 |
| ✅ | 已完成 |
| ⏸️ | 暂停 |

---

## Phase 1 — 基础体验完善

> 目标: 补齐日常使用中最常需要的基础功能，提升可用性。

| # | 功能 | 状态 | 说明 |
|---|------|------|------|
| 1.1 | 运行中模型列表 | ✅ | 调用 `GET /api/ps` 显示当前加载到内存的模型，支持卸载 |
| 1.2 | 系统通知 | ✅ | 下载完成、服务异常、导入完成时发送系统原生通知 |
| 1.3 | 开机自启动 | ✅ | macOS Login Items / Windows Registry，Settings 中添加开关 |
| 1.4 | 深色/浅色主题 | ✅ | 跟随系统主题 + 手动切换选项，持久化到 electron-store |

### 详细设计

#### 1.1 运行中模型列表

- **API**: `GET /api/ps` → 返回当前加载的模型、大小、到期时间
- **UI**: 在模型列表上方新增「运行中」标签页或折叠区域
- **操作**: 每个运行中模型显示卸载按钮
- **IPC**: 新增 `ollama:list-running` channel
- **刷新**: 随 status poller 一起轮询，或模型列表刷新时同步获取

#### 1.2 系统通知

- **触发场景**:
  - 模型下载/导入完成（成功或失败）
  - Ollama 服务意外停止
  - GGUF 导入批量完成汇总
- **实现**: Electron `Notification` API
- **设置**: Settings 中添加通知开关（默认开启）
- **注意**: 窗口处于前台活跃状态时不弹通知，避免干扰

#### 1.3 开机自启动

- **实现**: Electron `app.setLoginItemSettings()`
- **UI**: Settings 页面添加开关
- **存储**: electron-store `launchAtLogin` 字段
- **平台差异**:
  - macOS: `openAtLogin` + `openAsHidden`（启动后隐藏到托盘）
  - Windows: `openAtLogin`（启动后最小化到托盘）

#### 1.4 深色/浅色主题

- **模式**: `system` | `light` | `dark`
- **实现**: 监听 `nativeTheme.on('updated')` 同步到渲染进程
- **CSS**: Tailwind `dark:` 变体，通过 `<html class="dark">` 控制
- **存储**: electron-store `theme` 字段
- **默认**: `system`（跟随系统）

---

## Phase 2 — 模型管理增强

> 目标: 提供更丰富的模型信息和管理能力。

| # | 功能 | 状态 | 说明 |
|---|------|------|------|
| 2.1 | 模型详情查看 | ✅ | 调用 `POST /api/show` 展示模型完整信息 |
| 2.2 | 模型复制/自定义 | ✅ | 基于已有模型创建变体，自定义 system prompt 和参数 |
| 2.3 | 模型使用统计 | ✅ | 记录使用频率、最后使用时间，辅助模型清理决策 |

### 详细设计

#### 2.1 模型详情查看

- **API**: `POST /api/show` → 返回 modelfile、parameters、template、license 等
- **UI**: 点击模型名称展开详情面板或弹出侧边栏
- **展示内容**:
  - 基础信息: 参数量、量化方式、家族、格式
  - 模板: prompt template 内容
  - System prompt（如有）
  - License 信息
  - 原始 modelfile
- **IPC**: 新增 `ollama:show-model` channel

#### 2.2 模型复制/自定义

- **API**: `POST /api/create` with `from` 字段
- **UI**: 模型详情中添加「创建变体」按钮，弹出表单:
  - 新模型名称（必填）
  - System prompt（可选）
  - Parameters: temperature, num_ctx, top_p 等（可选，滑块/输入框）
- **IPC**: 新增 `ollama:create-model` channel
- **进度**: 流式响应，复用 pull-progress 事件

#### 2.3 模型使用统计

- **存储**: electron-store `modelStats` 字段
  ```json
  {
    "llama3.2:3b": {
      "useCount": 42,
      "lastUsedAt": "2026-03-08T10:30:00Z",
      "firstUsedAt": "2026-02-01T08:00:00Z"
    }
  }
  ```
- **数据来源**: 通过轮询 `GET /api/ps` 检测模型加载事件
- **UI**: 模型列表中显示使用频率标签，支持按使用频率排序
- **用途**: 帮助用户识别不常用的模型，辅助清理磁盘空间

---

## Phase 3 — 交互与国际化

> 目标: 提升交互体验，支持多语言。

| # | 功能 | 状态 | 说明 |
|---|------|------|------|
| 3.1 | 模型对话测试 | ⬜ | 内置简单聊天界面，快速验证模型效果 |
| 3.2 | GPU/内存监控 | ⬜ | 显示 Ollama 资源占用，辅助模型选择 |
| 3.3 | 多语言支持 (i18n) | ⬜ | 中英文切换，解决当前硬编码中文问题 |

### 详细设计

#### 3.1 模型对话测试

- **API**: `POST /api/chat` (streaming)
- **UI**: 轻量聊天界面（非全功能 chatbot）
  - 模型选择下拉框（从已安装列表选）
  - 消息输入框 + 发送按钮
  - 流式输出显示
  - 清空对话按钮
  - 停止生成按钮
- **入口**: 模型列表中每个模型添加「试用」按钮
- **限制**: 不做历史记录持久化，仅会话内保持上下文
- **IPC**: 新增 `ollama:chat` / `ollama:cancel-chat` channels

#### 3.2 GPU/内存监控

- **API**: `GET /api/ps` 返回的数据包含 `size` 和 `size_vram` 字段
- **UI**: 状态栏区域或独立面板
  - 显示总 VRAM 使用量
  - 每个运行中模型的内存占用条形图
  - RAM vs VRAM 分布
- **补充**: 可通过系统 API 获取总可用 VRAM（平台相关）
- **依赖**: 依赖 Phase 1 的运行中模型列表功能

#### 3.3 多语言支持 (i18n)

- **方案**: `i18next` + `react-i18next`
- **语言**: 中文 (zh-CN)、英文 (en) 初始支持
- **范围**:
  - 渲染进程所有 UI 文本
  - 托盘右键菜单
  - 系统通知内容
- **检测**: 默认跟随系统语言，Settings 中可手动切换
- **文件结构**: `src/renderer/src/locales/{zh-CN,en}/translation.json`
- **存储**: electron-store `language` 字段

---

## 开发优先级与依赖关系

```
Phase 1 (基础体验)
  ├── 1.1 运行中模型列表  ←── Phase 3.2 GPU监控 依赖此功能
  ├── 1.2 系统通知         (独立)
  ├── 1.3 开机自启动       (独立)
  └── 1.4 深色/浅色主题    (独立)

Phase 2 (模型管理)
  ├── 2.1 模型详情查看     ←── 2.2 模型复制 依赖此功能的 UI 入口
  ├── 2.2 模型复制/自定义
  └── 2.3 模型使用统计     (独立，但与 1.1 共享 /api/ps 数据)

Phase 3 (交互与国际化)
  ├── 3.1 模型对话测试     (独立)
  ├── 3.2 GPU/内存监控     (依赖 1.1)
  └── 3.3 多语言 i18n      (独立，但建议在其他功能稳定后统一处理)
```

## 实现涉及的文件变更预估

| 功能 | 新增文件 | 修改文件 |
|------|----------|----------|
| 1.1 运行中模型 | `RunningModels.tsx` | `api.ts`, `channels.ts`, `types.ts`, `handlers.ts`, `store.ts` |
| 1.2 系统通知 | `notifications.ts` | `handlers.ts`, `store.ts`, `Settings.tsx` |
| 1.3 开机自启 | — | `index.ts`, `store.ts`, `Settings.tsx` |
| 1.4 主题切换 | `ThemeProvider.tsx` | `index.ts`, `store.ts`, `Settings.tsx`, `app.css` |
| 2.1 模型详情 | `ModelDetail.tsx` | `api.ts`, `channels.ts`, `types.ts`, `handlers.ts`, `store.ts` |
| 2.2 模型复制 | `CreateModelForm.tsx` | `api.ts`, `channels.ts`, `handlers.ts`, `store.ts` |
| 2.3 使用统计 | — | `store.ts`, `ModelItem.tsx`, `handlers.ts` |
| 3.1 对话测试 | `ChatTest.tsx` | `api.ts`, `channels.ts`, `types.ts`, `handlers.ts`, `store.ts` |
| 3.2 GPU监控 | `ResourceMonitor.tsx` | `RunningModels.tsx`, `types.ts` |
| 3.3 i18n | `locales/**`, `i18n.ts` | 几乎所有组件文件、`index.ts`(托盘菜单) |
