<p align="center">
  <img src="docs/social-preview.png" alt="PawPal" width="800" />
</p>

<h1 align="center">PawPal</h1>

<p align="center">
  一只住在你桌面上的小狗，提醒你休息、喝水、保持专注。
</p>

<p align="center">
  <img alt="Downloads" src="https://img.shields.io/github/downloads/zebangeth/PawPal/total?style=flat-square&label=downloads" />
  <img alt="Electron" src="https://img.shields.io/badge/Electron-vite-47848f?style=flat-square&logo=electron&logoColor=white" />
  <img alt="React" src="https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react&logoColor=111111" />
  <img alt="License" src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" />
</p>

<p align="center">
  <a href="#中文">中文</a> · <a href="#english">English</a>
</p>

## 中文

PawPal 是一个桌面宠物应用，支持 macOS 和 Windows。一只透明、始终置顶的小狗会陪在你的屏幕上，在你久坐、忘记喝水或者分心刷社交媒体时，温柔地把你带回节奏里。

## 功能

- **休息提醒** — 定时提醒你站起来活动一下，小狗会跑过整个屏幕引起你的注意
- **喝水提醒** — 别忘了喝水
- **专注模式** — 检测你当前在用的 app，如果你在刷社交媒体，小狗会来提醒你回去工作
- **多种宠物外观** — 目前有线条小狗和金毛 puppy 两种风格
- **中文 / English** — 支持中英文切换
- **本地优先** — 设置和统计数据保存在本地；只有手动检查更新或开启启动时检查更新时才会访问 GitHub Releases

## 安装

### 下载安装包（推荐）

从 [Releases](../../releases) 页面下载对应平台的安装包：

| 文件 | 适用设备 |
|------|---------|
| `PawPal-x.x.x-arm64.dmg` | macOS Apple Silicon (M1/M2/M3/M4) |
| `PawPal-x.x.x-x64.dmg` | macOS Intel |
| `PawPal.Setup.x.x.x.exe` | Windows (64-bit) |

> **macOS**：首次打开时可能提示"无法验证开发者"，请在 系统设置 → 隐私与安全性 中允许打开。专注模式的分心检测需要授予 Accessibility 权限。
>
> **Windows**：分心检测功能暂不可用（目前仅支持 macOS），其他功能正常。

### 从源码运行

需要 Node.js 20+ 和 pnpm 9。推荐通过 Corepack 启用 pnpm：

```bash
corepack enable
git clone https://github.com/zebangeth/PawPal.git
cd PawPal
pnpm install
pnpm dev
```

如果 `corepack enable` 没有权限，请用其他方式安装 pnpm 9，并确认 `pnpm --version` 可以正常运行。

## 构建

```bash
pnpm test         # 运行纯逻辑测试
pnpm build        # 编译（含类型检查）
pnpm dist         # 编译 + 打包 macOS 和 Windows
pnpm dist:mac     # 仅打包 macOS
pnpm dist:win     # 仅打包 Windows（需要 Wine 或在 Windows 上运行）
```

> 本地打包时请确保 `pnpm` 命令可以在 shell 中直接运行；electron-builder 会用它收集依赖。

## 技术栈

- Electron + electron-vite
- React 19 + TypeScript
- electron-store（本地持久化）
- electron-builder（打包分发）

## 项目结构

```
src/main/       主进程：窗口管理、托盘菜单、定时器、持久化、专注检测、更新检查
src/preload/    IPC 桥接层
src/renderer/   React UI（宠物窗口 + 设置窗口）
src/shared/     共享类型、默认配置、i18n、宠物外观定义
tests/          纯逻辑测试
pet_assets/     宠物动画素材（GIF）
```

## 开发路线

- [ ] 更多宠物外观
- [ ] 声音效果
- [ ] Windows 分心检测
- [ ] 多显示器适配优化

## 许可

源代码基于 [MIT License](LICENSE)。宠物动画素材有独立的授权说明，详见 [ASSET_LICENSE.md](ASSET_LICENSE.md)。

---

## English

A tiny desktop dog that helps you pause before you burn out.

PawPal is a desktop pet app for macOS and Windows. A transparent, always-on-top dog lives on your screen and gently reminds you to take breaks, drink water, and stay focused.

### Features

- **Break reminders** — timed nudges to get up and move; the dog runs across your screen to get your attention
- **Hydration reminders** — don't forget to drink water
- **Focus mode** — detects what app you're using; if you're on social media, the dog will nudge you back to work
- **Multiple pet styles** — line-drawing dog and golden retriever puppy
- **Chinese / English UI**
- **Local-first data** — settings and stats stay on your machine; PawPal only contacts GitHub Releases when you manually check for updates or opt in to launch-time checks

### Install

Download the latest installer from [Releases](../../releases) (`.dmg` for macOS, `.exe` for Windows), or run from source:

```bash
corepack enable
git clone https://github.com/zebangeth/PawPal.git
cd PawPal
pnpm install
pnpm dev
```

Source builds require Node.js 20+ and pnpm 9. Make sure the `pnpm` command is available in your shell before packaging, because electron-builder uses it while collecting dependencies.

If `corepack enable` does not have permission to install shims, install pnpm 9 another way and verify that `pnpm --version` works.

Common commands:

```bash
pnpm test
pnpm build
pnpm dist
```

### License

Source code under [MIT License](LICENSE). Pet animation assets have separate licensing; see [ASSET_LICENSE.md](ASSET_LICENSE.md).
