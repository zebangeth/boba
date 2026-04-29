import { app, BrowserWindow, ipcMain, Menu, nativeImage, screen, Tray } from "electron";
import Store from "electron-store";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  COPY,
  createEmptyStats,
  DEFAULT_SETTINGS,
  todayKey
} from "../shared/constants";
import type {
  AppSnapshot,
  DemoTrigger,
  PetState,
  Settings,
  SpeechBubble,
  TodayStats
} from "../shared/types";

type StoreSchema = {
  settings: Settings;
  stats: TodayStats;
};

type BlockingMode = "break" | "hydration" | "focusWarning" | null;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PET_WINDOW_WIDTH = 320;
const PET_WINDOW_HEIGHT = 300;
const SETTINGS_WINDOW_WIDTH = 460;
const SETTINGS_WINDOW_HEIGHT = 600;
const PRELOAD_PATH = join(__dirname, "../preload/index.cjs");
const IS_DEV = Boolean(process.env.ELECTRON_RENDERER_URL);

app.setName("Pawse");

const store = new Store<StoreSchema>({
  name: "pawse-demo",
  defaults: {
    settings: DEFAULT_SETTINGS,
    stats: createEmptyStats()
  }
});

let petWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let petState: PetState = "walking";
let blockingMode: BlockingMode = null;
let focusActive = false;
let focusStartedAt: number | null = null;
let movementTimer: NodeJS.Timeout | null = null;
let breakTimer: NodeJS.Timeout | null = null;
let hydrationTimer: NodeJS.Timeout | null = null;
let focusTimer: NodeJS.Timeout | null = null;
let idleTimer: NodeJS.Timeout | null = null;
let bubbleTimer: NodeJS.Timeout | null = null;
let walkDirection: 1 | -1 = 1;
let breakMutedToday = false;

function getSettings(): Settings {
  return { ...DEFAULT_SETTINGS, ...store.get("settings") };
}

function setSettings(next: Settings): void {
  store.set("settings", next);
  sendToAll("settings:updated", next);
  scheduleReminderTimers();
  updateTrayMenu();
}

function getStats(): TodayStats {
  const stats = store.get("stats", createEmptyStats());
  if (stats.date !== todayKey()) {
    const reset = createEmptyStats();
    store.set("stats", reset);
    return reset;
  }
  return stats;
}

function updateStats(mutator: (stats: TodayStats) => TodayStats): void {
  const next = mutator(getStats());
  store.set("stats", next);
  sendToAll("stats:updated", next);
}

function resetTodayStats(): void {
  breakMutedToday = false;
  const reset = createEmptyStats();
  store.set("stats", reset);
  sendToAll("stats:updated", reset);
}

function snapshot(): AppSnapshot {
  return {
    settings: getSettings(),
    stats: getStats(),
    petState,
    focusActive
  };
}

function sendToPet<T>(channel: string, payload?: T): void {
  if (!petWindow || petWindow.isDestroyed()) return;
  petWindow.webContents.send(channel, payload);
}

function sendToAll<T>(channel: string, payload?: T): void {
  sendToPet(channel, payload);
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.webContents.send(channel, payload);
  }
}

function setPetState(next: PetState): void {
  petState = next;
  sendToPet("pet:set-state", next);
}

function showBubble(bubble: SpeechBubble): void {
  if (bubbleTimer) clearTimeout(bubbleTimer);
  sendToPet("pet:show-bubble", bubble);
  if (bubble.autoDismissMs) {
    bubbleTimer = setTimeout(() => hideBubble(), bubble.autoDismissMs);
  }
}

function hideBubble(): void {
  if (bubbleTimer) {
    clearTimeout(bubbleTimer);
    bubbleTimer = null;
  }
  sendToPet("pet:hide-bubble");
}

function rendererUrl(route: "pet" | "settings"): string {
  const devServer = process.env.ELECTRON_RENDERER_URL;
  if (devServer) return `${devServer}#${route}`;
  return join(__dirname, "../renderer/index.html");
}

function loadRenderer(win: BrowserWindow, route: "pet" | "settings"): void {
  const devServer = process.env.ELECTRON_RENDERER_URL;
  if (devServer) {
    void win.loadURL(rendererUrl(route));
    return;
  }
  void win.loadFile(rendererUrl(route), { hash: route });
}

function createPetWindow(): void {
  const workArea = screen.getPrimaryDisplay().workArea;
  petWindow = new BrowserWindow({
    width: PET_WINDOW_WIDTH,
    height: PET_WINDOW_HEIGHT,
    x: Math.round(workArea.x + workArea.width / 2 - PET_WINDOW_WIDTH / 2),
    y: workArea.y + workArea.height - PET_WINDOW_HEIGHT,
    transparent: true,
    frame: false,
    resizable: false,
    movable: false,
    show: false,
    skipTaskbar: true,
    hasShadow: false,
    backgroundColor: "#00000000",
    alwaysOnTop: true,
    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: !IS_DEV
    }
  });

  petWindow.setAlwaysOnTop(true, "floating");
  petWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  loadRenderer(petWindow, "pet");
  petWindow.once("ready-to-show", () => {
    petWindow?.showInactive();
    sendToPet("app:snapshot", snapshot());
  });
  petWindow.on("closed", () => {
    petWindow = null;
  });
}

function createSettingsWindow(): void {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: SETTINGS_WINDOW_WIDTH,
    height: SETTINGS_WINDOW_HEIGHT,
    title: "Pawse Settings",
    resizable: false,
    show: false,
    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: !IS_DEV
    }
  });

  loadRenderer(settingsWindow, "settings");
  settingsWindow.once("ready-to-show", () => {
    settingsWindow?.show();
    sendToAll("app:snapshot", snapshot());
  });
  settingsWindow.on("closed", () => {
    settingsWindow = null;
  });
}

function trayImage(): Electron.NativeImage {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18"><path fill="black" d="M5.8 6.5c-.6 0-1.1-.7-1.1-1.6s.5-1.6 1.1-1.6 1.1.7 1.1 1.6-.5 1.6-1.1 1.6Zm6.4 0c-.6 0-1.1-.7-1.1-1.6s.5-1.6 1.1-1.6 1.1.7 1.1 1.6-.5 1.6-1.1 1.6ZM9 14.7c-3 0-5.1-1.7-5.1-4 0-1.8 1.2-3.2 2.8-3.2.9 0 1.5.4 2.3.4s1.4-.4 2.3-.4c1.6 0 2.8 1.4 2.8 3.2 0 2.3-2.1 4-5.1 4Zm0-2.3c.8 0 1.7-.4 1.7-1.1 0-.5-.4-.8-.9-.8-.3 0-.5.1-.8.1s-.5-.1-.8-.1c-.5 0-.9.3-.9.8 0 .7.9 1.1 1.7 1.1Z"/></svg>`;
  const image = nativeImage.createFromDataURL(
    `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`
  );
  image.setTemplateImage(true);
  return image;
}

function createTray(): void {
  tray = new Tray(trayImage());
  tray.setTitle("Pawse");
  tray.setToolTip("Pawse");
  tray.on("click", () => {
    tray?.popUpContextMenu();
  });
  updateTrayMenu();
}

function actionMenuItems(): Electron.MenuItemConstructorOptions[] {
  const dogVisible = Boolean(petWindow?.isVisible());
  return [
    {
      label: dogVisible ? "Hide Dog" : "Show Dog",
      click: () => {
        if (!petWindow) createPetWindow();
        if (!petWindow) return;
        if (petWindow.isVisible()) petWindow.hide();
        else petWindow.showInactive();
        updateTrayMenu();
      }
    },
    {
      label: focusActive ? "Stop Focus Mode" : "Start Focus Mode",
      click: () => {
        if (focusActive) stopFocusMode(true);
        else startFocusMode();
      }
    },
    { type: "separator" },
    { label: "Demo: Break Reminder", click: () => triggerDemo("break") },
    { label: "Demo: Hydration Reminder", click: () => triggerDemo("hydration") },
    { label: "Demo: Focus Warning", click: () => triggerDemo("focusWarning") },
    { label: "Demo: Happy Reaction", click: () => triggerDemo("happy") },
    { type: "separator" },
    { label: "Settings", click: createSettingsWindow },
    { label: "Reset Today", click: resetTodayStats }
  ];
}

function updateApplicationMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: "Pawse",
      submenu: [
        ...actionMenuItems(),
        { type: "separator" },
        { role: "quit", label: "Quit" }
      ]
    },
    { role: "editMenu" },
    { role: "windowMenu" }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function updateTrayMenu(): void {
  updateApplicationMenu();
  if (!tray) return;
  const template: Electron.MenuItemConstructorOptions[] = [
    { label: "Pawse", enabled: false },
    { type: "separator" },
    ...actionMenuItems(),
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        app.quit();
      }
    }
  ];
  tray.setContextMenu(Menu.buildFromTemplate(template));
}

function pinToBottomRight(): void {
  if (!petWindow || petWindow.isDestroyed()) return;
  const workArea = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
  petWindow.setBounds({
    x: workArea.x + workArea.width - PET_WINDOW_WIDTH - 24,
    y: workArea.y + workArea.height - PET_WINDOW_HEIGHT,
    width: PET_WINDOW_WIDTH,
    height: PET_WINDOW_HEIGHT
  });
}

function startMovement(): void {
  if (movementTimer) clearInterval(movementTimer);
  movementTimer = setInterval(() => {
    if (!petWindow || petWindow.isDestroyed() || !petWindow.isVisible()) return;
    if (blockingMode || focusActive || petState !== "walking") return;

    const workArea = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
    const bounds = petWindow.getBounds();
    let nextX = bounds.x + walkDirection * 2;
    const minX = workArea.x + 12;
    const maxX = workArea.x + workArea.width - PET_WINDOW_WIDTH - 12;

    if (nextX <= minX) {
      nextX = minX;
      walkDirection = 1;
    }
    if (nextX >= maxX) {
      nextX = maxX;
      walkDirection = -1;
    }

    petWindow.setBounds({
      ...bounds,
      x: nextX,
      y: workArea.y + workArea.height - PET_WINDOW_HEIGHT
    });
  }, 70);
}

function scheduleIdleBeat(): void {
  if (idleTimer) clearInterval(idleTimer);
  idleTimer = setInterval(() => {
    if (blockingMode || focusActive || petState !== "walking") return;
    setPetState("idle");
    setTimeout(() => {
      if (!blockingMode && !focusActive && petState === "idle") setPetState("walking");
    }, 3500);
  }, 22000);
}

function scheduleReminderTimers(): void {
  if (breakTimer) clearTimeout(breakTimer);
  if (hydrationTimer) clearTimeout(hydrationTimer);

  const settings = getSettings();
  if (settings.breakReminderEnabled && !breakMutedToday) {
    breakTimer = setTimeout(
      () => triggerBreakReminder(false),
      settings.breakIntervalMinutes * 60 * 1000
    );
  }
  if (settings.hydrationReminderEnabled) {
    hydrationTimer = setTimeout(
      () => triggerHydrationReminder(false),
      settings.hydrationIntervalMinutes * 60 * 1000
    );
  }
}

function resumeLongTermState(): void {
  blockingMode = null;
  hideBubble();
  if (focusActive) {
    setPetState("focusGuard");
    pinToBottomRight();
    return;
  }
  setPetState("walking");
}

function happyFeedback(message: string = COPY.woof, after?: () => void): void {
  if (blockingMode) return;
  const returnState = focusActive ? "focusGuard" : "walking";
  setPetState("happy");
  showBubble({ id: "happy", message, autoDismissMs: 1800 });
  setTimeout(() => {
    hideBubble();
    setPetState(returnState);
    if (focusActive) pinToBottomRight();
    after?.();
  }, 1900);
}

function triggerBreakReminder(fromDemo: boolean): void {
  if (blockingMode === "focusWarning") return;
  if (!fromDemo && (focusActive || breakMutedToday)) {
    scheduleReminderTimers();
    return;
  }
  blockingMode = "break";
  setPetState("knocking");
  showBubble({
    id: "break",
    message: COPY.breakReminder,
    actions: [
      { id: "break:done", label: "我站起来了", kind: "primary" },
      { id: "break:snooze", label: "10 分钟后提醒" },
      { id: "break:mute", label: "今天先别管我", kind: "danger" }
    ]
  });
}

function triggerHydrationReminder(fromDemo: boolean): void {
  if (blockingMode || (!fromDemo && focusActive)) {
    scheduleReminderTimers();
    return;
  }
  blockingMode = "hydration";
  setPetState("thirsty");
  showBubble({
    id: "hydration",
    message: COPY.hydrationReminder,
    actions: [
      { id: "hydration:done", label: "我喝水了", kind: "primary" },
      { id: "hydration:snooze", label: "稍后提醒" }
    ]
  });
}

function triggerFocusWarning(): void {
  if (!focusActive) startFocusMode();
  blockingMode = "focusWarning";
  updateStats((stats) => ({ ...stats, focusWarnings: stats.focusWarnings + 1 }));
  setPetState("focusGuard");
  pinToBottomRight();
  showBubble({
    id: "focus-warning",
    message: COPY.focusWarning,
    actions: [
      { id: "focus:back", label: "回去工作", kind: "primary" },
      { id: "focus:end", label: "结束 Focus" }
    ]
  });
}

function startFocusMode(): void {
  if (focusActive) return;
  const settings = getSettings();
  focusActive = true;
  focusStartedAt = Date.now();
  blockingMode = null;
  setPetState("focusGuard");
  sendToAll("app:snapshot", snapshot());
  pinToBottomRight();
  showBubble({
    id: "focus-start",
    message: COPY.focusStart.replace("25", String(settings.focusDurationMinutes)),
    autoDismissMs: 4500
  });
  if (focusTimer) clearTimeout(focusTimer);
  focusTimer = setTimeout(
    () => stopFocusMode(true),
    settings.focusDurationMinutes * 60 * 1000
  );
  updateTrayMenu();
}

function stopFocusMode(completed: boolean): void {
  if (!focusActive) return;
  const startedAt = focusStartedAt ?? Date.now();
  const elapsedMinutes = Math.max(1, Math.round((Date.now() - startedAt) / 60000));
  focusActive = false;
  focusStartedAt = null;
  blockingMode = null;
  if (focusTimer) {
    clearTimeout(focusTimer);
    focusTimer = null;
  }
  updateStats((stats) => ({
    ...stats,
    focusMinutes: stats.focusMinutes + elapsedMinutes
  }));
  sendToAll("app:snapshot", snapshot());
  setPetState("happy");
  showBubble({
    id: "focus-complete",
    message: completed ? COPY.focusComplete : "Focus 已结束，我先回去巡逻。",
    autoDismissMs: 2800
  });
  setTimeout(() => {
    if (!focusActive && !blockingMode) {
      hideBubble();
      setPetState("walking");
    }
  }, 2900);
  updateTrayMenu();
}

function triggerDemo(trigger: DemoTrigger): void {
  if (!petWindow) createPetWindow();
  petWindow?.showInactive();
  updateTrayMenu();
  if (trigger === "break") triggerBreakReminder(true);
  if (trigger === "hydration") triggerHydrationReminder(true);
  if (trigger === "focusWarning") triggerFocusWarning();
  if (trigger === "happy") happyFeedback("woof!");
}

function handleBubbleAction(actionId: string): void {
  if (actionId === "break:done") {
    updateStats((stats) => ({ ...stats, breaksTaken: stats.breaksTaken + 1 }));
    blockingMode = null;
    happyFeedback(COPY.breakDone, scheduleReminderTimers);
    return;
  }
  if (actionId === "break:snooze") {
    resumeLongTermState();
    if (breakTimer) clearTimeout(breakTimer);
    breakTimer = setTimeout(() => triggerBreakReminder(false), 10 * 60 * 1000);
    return;
  }
  if (actionId === "break:mute") {
    breakMutedToday = true;
    setPetState("annoyed");
    showBubble({ id: "break-muted", message: COPY.breakIgnore, autoDismissMs: 2600 });
    setTimeout(resumeLongTermState, 2700);
    return;
  }
  if (actionId === "hydration:done") {
    updateStats((stats) => ({ ...stats, watersLogged: stats.watersLogged + 1 }));
    blockingMode = null;
    setPetState("drinking");
    showBubble({ id: "hydration-done", message: COPY.hydrationDone, autoDismissMs: 2300 });
    setTimeout(() => happyFeedback(COPY.hydrationDone, scheduleReminderTimers), 2400);
    return;
  }
  if (actionId === "hydration:snooze") {
    resumeLongTermState();
    if (hydrationTimer) clearTimeout(hydrationTimer);
    hydrationTimer = setTimeout(() => triggerHydrationReminder(false), 15 * 60 * 1000);
    return;
  }
  if (actionId === "focus:back") {
    blockingMode = null;
    setPetState("focusGuard");
    showBubble({ id: "focus-back", message: COPY.focusBack, autoDismissMs: 1800 });
    setTimeout(() => {
      if (focusActive && !blockingMode) hideBubble();
    }, 1900);
    return;
  }
  if (actionId === "focus:end") {
    stopFocusMode(false);
  }
}

function registerIpc(): void {
  ipcMain.handle("app:get-snapshot", () => snapshot());
  ipcMain.on("pet:clicked", () => {
    if (blockingMode) return;
    happyFeedback(COPY.woof);
  });
  ipcMain.on("bubble:action", (_event, actionId: string) => handleBubbleAction(actionId));
  ipcMain.on("settings:update", (_event, partial: Partial<Settings>) => {
    setSettings({ ...getSettings(), ...partial });
  });
  ipcMain.on("demo:trigger", (_event, trigger: DemoTrigger) => triggerDemo(trigger));
  ipcMain.on("focus:start", startFocusMode);
  ipcMain.on("focus:stop", () => stopFocusMode(false));
  ipcMain.on("stats:reset-today", resetTodayStats);
}

app.whenReady().then(() => {
  getStats();
  registerIpc();
  createPetWindow();
  createTray();
  startMovement();
  scheduleIdleBeat();
  scheduleReminderTimers();
  if (IS_DEV) {
    createSettingsWindow();
  }

  app.on("activate", () => {
    if (!petWindow) createPetWindow();
  });
});

app.on("before-quit", () => {
  for (const timer of [movementTimer, breakTimer, hydrationTimer, focusTimer, idleTimer, bubbleTimer]) {
    if (timer) clearTimeout(timer);
  }
});

app.on("window-all-closed", () => {
  // Keep the menu-bar utility alive after the settings window is closed.
});
