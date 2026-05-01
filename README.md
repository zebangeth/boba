# Pawse

Pawse is a small Electron desktop pet that helps you take breaks, drink water, and stay focused.

The current milestone is a demo-first macOS utility: a transparent always-on-top dog window, tray/menu controls, reminder flows, focus mode, distraction detection, bilingual UI, local persistence, and a lightweight settings/stats window.

## Stack

- Electron + electron-vite
- React + TypeScript
- CSS animations
- electron-store
- pnpm

## Getting Started

```bash
pnpm install
pnpm dev
```

The dev build opens the pet window and the settings window. The tray/menu bar entry contains demo triggers for break reminders, hydration reminders, focus warnings, focus mode, settings, and reset actions.

## Validation

```bash
pnpm typecheck
pnpm build
```

## License

Source code is licensed under MIT. Pet animation assets have separate licensing notes; see [ASSET_LICENSE.md](./ASSET_LICENSE.md).

## Project Structure

```text
src/main/       Electron main process: windows, tray/menu, timers, persistence, focus flow
src/preload/    Safe IPC bridge exposed to the renderer
src/renderer/   React UI for the pet and settings windows
src/shared/     Shared types, defaults, and i18n copy
```

## Current Scope

Implemented:

- Transparent desktop pet window
- Settings window
- Tray/menu and pet context menu controls
- Break and hydration reminders
- Focus mode
- macOS active-window based distraction detection
- Chinese/English UI text
- Local settings and daily stats persistence

Deferred:

- Sound effects
- Launch at startup
- Multi-monitor polish
- Production packaging/signing
- Unit tests
