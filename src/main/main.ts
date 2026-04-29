import { app, BrowserWindow, ipcMain, Menu, nativeImage, screen, Tray } from "electron";
import Store from "electron-store";
import { execFile } from "node:child_process";
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
  BlockingMode,
  DistractionStatus,
  DemoTrigger,
  PetState,
  Settings,
  SpeechBubble,
  TodayStats
} from "../shared/types";

type PetPosition = {
  x: number;
  y: number;
};

type StoreSchema = {
  settings: Settings;
  stats: TodayStats;
  petPosition?: PetPosition;
  petParked: boolean;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PET_WINDOW_WIDTH = 320;
const PET_WINDOW_HEIGHT = 300;
const SETTINGS_WINDOW_WIDTH = 460;
const SETTINGS_WINDOW_HEIGHT = 600;
const PRELOAD_PATH = join(__dirname, "../preload/index.cjs");
const IS_DEV = Boolean(process.env.ELECTRON_RENDERER_URL);
const DISTRACTION_CHECK_INTERVAL_MS = 3000;
const DISTRACTION_WARNING_COOLDOWN_MS = 60_000;
const IGNORED_DISTRACTION_APPS = ["Pawse", "Electron"];

app.setName("Pawse");

const store = new Store<StoreSchema>({
  name: "pawse-demo",
  defaults: {
    settings: DEFAULT_SETTINGS,
    stats: createEmptyStats(),
    petParked: false
  }
});

let petWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let petParked = store.get("petParked", false);
let petState: PetState = petParked ? "sitting" : "walking";
let blockingMode: BlockingMode = null;
let focusActive = false;
let focusStartedAt: number | null = null;
let movementTimer: NodeJS.Timeout | null = null;
let breakTimer: NodeJS.Timeout | null = null;
let hydrationTimer: NodeJS.Timeout | null = null;
let focusTimer: NodeJS.Timeout | null = null;
let distractionTimer: NodeJS.Timeout | null = null;
let distractionStartupTimer: NodeJS.Timeout | null = null;
let breakDueAt: number | null = null;
let hydrationDueAt: number | null = null;
let focusEndsAt: number | null = null;
let idleTimer: NodeJS.Timeout | null = null;
let bubbleTimer: NodeJS.Timeout | null = null;
let dragTimer: NodeJS.Timeout | null = null;
let walkDirection: 1 | -1 = 1;
let breakMutedToday = false;
let dragOffset: PetPosition = { x: 0, y: 0 };
let distractionStatus: DistractionStatus = {
  state: "idle",
  activeApp: "",
  activeWindowTitle: "",
  matchedRule: null,
  lastCheckedAt: null,
  lastWarningAt: null,
  error: null
};

function getSettings(): Settings {
  return { ...DEFAULT_SETTINGS, ...store.get("settings") };
}

function setSettings(next: Settings): void {
  store.set("settings", next);
  sendToAll("settings:updated", next);
  scheduleReminderTimers();
  scheduleDistractionDetection();
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
    timers: {
      breakDueAt,
      hydrationDueAt,
      focusEndsAt
    },
    distraction: distractionStatus,
    petState,
    blockingMode,
    petParked,
    dogVisible: Boolean(petWindow?.isVisible()),
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

function publishSnapshot(): void {
  sendToAll("app:snapshot", snapshot());
}

function setPetState(next: PetState): void {
  petState = next;
  sendToAll("pet:set-state", next);
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

function clampBoundsToWorkArea(bounds: Electron.Rectangle): Electron.Rectangle {
  const center = {
    x: bounds.x + Math.round(bounds.width / 2),
    y: bounds.y + Math.round(bounds.height / 2)
  };
  const workArea = screen.getDisplayNearestPoint(center).workArea;
  return {
    ...bounds,
    x: Math.min(Math.max(bounds.x, workArea.x), workArea.x + workArea.width - bounds.width),
    y: Math.min(Math.max(bounds.y, workArea.y), workArea.y + workArea.height - bounds.height)
  };
}

function initialPetBounds(): Electron.Rectangle {
  const workArea = screen.getPrimaryDisplay().workArea;
  const stored = store.get("petPosition");
  const fallback = {
    width: PET_WINDOW_WIDTH,
    height: PET_WINDOW_HEIGHT,
    x: Math.round(workArea.x + workArea.width / 2 - PET_WINDOW_WIDTH / 2),
    y: workArea.y + workArea.height - PET_WINDOW_HEIGHT
  };

  if (!stored) return fallback;
  return clampBoundsToWorkArea({
    ...fallback,
    x: stored.x,
    y: stored.y
  });
}

function persistPetPosition(): void {
  if (!petWindow || petWindow.isDestroyed()) return;
  const bounds = petWindow.getBounds();
  store.set("petPosition", { x: bounds.x, y: bounds.y });
}

function createPetWindow(): void {
  const bounds = initialPetBounds();
  petWindow = new BrowserWindow({
    width: PET_WINDOW_WIDTH,
    height: PET_WINDOW_HEIGHT,
    x: bounds.x,
    y: bounds.y,
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
    updateTrayMenu();
    publishSnapshot();
  });
  petWindow.on("show", () => {
    updateTrayMenu();
    publishSnapshot();
  });
  petWindow.on("hide", () => {
    updateTrayMenu();
    publishSnapshot();
  });
  petWindow.on("closed", () => {
    petWindow = null;
    updateTrayMenu();
    publishSnapshot();
  });
}

function ensurePetWindowVisible(): void {
  if (!petWindow || petWindow.isDestroyed()) createPetWindow();
  if (petWindow && !petWindow.isVisible()) petWindow.showInactive();
  updateTrayMenu();
  publishSnapshot();
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
    publishSnapshot();
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
        sendToAll("app:snapshot", snapshot());
      }
    },
    {
      label: focusActive ? "Stop Focus Mode" : "Start Focus Mode",
      click: () => {
        if (focusActive) stopFocusMode(true);
        else startFocusMode();
      }
    },
    {
      label: petParked ? "Resume Walking" : "Park Dog Here",
      enabled: dogVisible && !focusActive,
      click: () => {
        if (petParked) resumeWalking();
        else parkPetHere();
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

function showPetContextMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    { label: "Settings", click: createSettingsWindow },
    {
      label: focusActive ? "Stop Focus Mode" : "Start Focus Mode",
      click: () => {
        if (focusActive) stopFocusMode(false);
        else startFocusMode();
      }
    },
    {
      label: petParked ? "Resume Walking" : "Park Dog Here",
      enabled: !focusActive,
      click: () => {
        if (petParked) resumeWalking();
        else parkPetHere();
      }
    },
    { type: "separator" },
    { label: "Demo: Break Reminder", click: () => triggerDemo("break") },
    { label: "Demo: Hydration Reminder", click: () => triggerDemo("hydration") },
    { label: "Demo: Focus Warning", click: () => triggerDemo("focusWarning") },
    { label: "Demo: Happy Reaction", click: () => triggerDemo("happy") },
    { type: "separator" },
    {
      label: "Hide Dog",
      click: () => {
        petWindow?.hide();
        updateTrayMenu();
        sendToAll("app:snapshot", snapshot());
      }
    }
  ];

  Menu.buildFromTemplate(template).popup({ window: petWindow ?? undefined });
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

function parkPetHere(): void {
  if (!petWindow || petWindow.isDestroyed()) return;
  petParked = true;
  store.set("petParked", true);
  persistPetPosition();
  if (!focusActive && !blockingMode) {
    setPetState("sitting");
    showBubble({ id: "parked", message: COPY.parked, autoDismissMs: 1800 });
  }
  updateTrayMenu();
  sendToAll("app:snapshot", snapshot());
}

function resumeWalking(): void {
  petParked = false;
  store.set("petParked", false);
  if (!focusActive && !blockingMode) {
    setPetState("walking");
    showBubble({ id: "resume-walking", message: COPY.resumeWalking, autoDismissMs: 1600 });
  }
  updateTrayMenu();
  sendToAll("app:snapshot", snapshot());
}

function movePetWithCursor(): void {
  if (!petWindow || petWindow.isDestroyed()) return;
  const cursor = screen.getCursorScreenPoint();
  const bounds = clampBoundsToWorkArea({
    width: PET_WINDOW_WIDTH,
    height: PET_WINDOW_HEIGHT,
    x: cursor.x - dragOffset.x,
    y: cursor.y - dragOffset.y
  });
  petWindow.setBounds(bounds);
}

function startPetDrag(offset: { offsetX: number; offsetY: number }): void {
  if (focusActive || blockingMode || !petWindow || petWindow.isDestroyed()) return;
  dragOffset = {
    x: Math.min(Math.max(Math.round(offset.offsetX), 0), PET_WINDOW_WIDTH),
    y: Math.min(Math.max(Math.round(offset.offsetY), 0), PET_WINDOW_HEIGHT)
  };
  if (dragTimer) clearInterval(dragTimer);
  hideBubble();
  setPetState("sitting");
  movePetWithCursor();
  dragTimer = setInterval(movePetWithCursor, 16);
}

function stopPetDrag(): void {
  if (!dragTimer) return;
  clearInterval(dragTimer);
  dragTimer = null;
  parkPetHere();
}

function startMovement(): void {
  if (movementTimer) clearInterval(movementTimer);
  movementTimer = setInterval(() => {
    if (!petWindow || petWindow.isDestroyed() || !petWindow.isVisible()) return;
    if (blockingMode || focusActive || petParked || petState !== "walking") return;

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
    if (blockingMode || focusActive || petParked || petState !== "walking") return;
    setPetState("idle");
    setTimeout(() => {
      if (!blockingMode && !focusActive && petState === "idle") setPetState("walking");
    }, 3500);
  }, 22000);
}

function scheduleReminderTimers(): void {
  if (breakTimer) clearTimeout(breakTimer);
  if (hydrationTimer) clearTimeout(hydrationTimer);
  breakDueAt = null;
  hydrationDueAt = null;

  const settings = getSettings();
  if (settings.breakReminderEnabled && !breakMutedToday) {
    breakDueAt = Date.now() + settings.breakIntervalMinutes * 60 * 1000;
    breakTimer = setTimeout(
      () => triggerBreakReminder(false),
      settings.breakIntervalMinutes * 60 * 1000
    );
  }
  if (settings.hydrationReminderEnabled) {
    hydrationDueAt = Date.now() + settings.hydrationIntervalMinutes * 60 * 1000;
    hydrationTimer = setTimeout(
      () => triggerHydrationReminder(false),
      settings.hydrationIntervalMinutes * 60 * 1000
    );
  }
  publishSnapshot();
}

function setDistractionStatus(partial: Partial<DistractionStatus>): void {
  distractionStatus = { ...distractionStatus, ...partial };
  publishSnapshot();
}

function normalizeRule(value: string): string {
  return value.trim().toLowerCase();
}

function activeWindowScript(): string {
  return `
tell application "System Events"
  set frontAppProcess to first application process whose frontmost is true
  set frontApp to name of frontAppProcess
  set frontWindow to ""
  try
    set frontWindow to name of front window of frontAppProcess
  end try
end tell
return frontApp & linefeed & frontWindow
`;
}

function readActiveWindow(): Promise<{ appName: string; windowTitle: string }> {
  return new Promise((resolve, reject) => {
    execFile("/usr/bin/osascript", ["-e", activeWindowScript()], { timeout: 2500 }, (error, stdout) => {
      if (error) {
        reject(error);
        return;
      }
      const [appName = "", ...titleParts] = stdout.trimEnd().split("\n");
      resolve({
        appName: appName.trim(),
        windowTitle: titleParts.join("\n").trim()
      });
    });
  });
}

function classifyDistraction(
  active: { appName: string; windowTitle: string },
  settings: Settings
): string | null {
  const appName = active.appName.trim();
  const title = active.windowTitle.trim();
  const appNameLower = appName.toLowerCase();
  const titleLower = title.toLowerCase();

  if (IGNORED_DISTRACTION_APPS.some((ignored) => ignored.toLowerCase() === appNameLower)) {
    return null;
  }

  const blockedApp = settings.distractionBlockedApps
    .map(normalizeRule)
    .filter(Boolean)
    .find((rule) => appNameLower.includes(rule));
  if (blockedApp) return `app:${blockedApp}`;

  const blockedKeyword = settings.distractionBlockedKeywords
    .map(normalizeRule)
    .filter(Boolean)
    .find((rule) => titleLower.includes(rule) || appNameLower.includes(rule));
  if (blockedKeyword) return `keyword:${blockedKeyword}`;

  return null;
}

function isPermissionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("not allowed assistive access") ||
    message.includes("System Events got an error") ||
    message.includes("not authorized") ||
    message.includes("Operation not permitted")
  );
}

async function checkDistractionNow(): Promise<void> {
  const settings = getSettings();
  if (!settings.distractionDetectionEnabled) return;

  try {
    const active = await readActiveWindow();
    const matchedRule = classifyDistraction(active, settings);
    const now = Date.now();

    setDistractionStatus({
      state: "watching",
      activeApp: active.appName,
      activeWindowTitle: active.windowTitle,
      matchedRule,
      lastCheckedAt: now,
      error: null
    });

    if (!focusActive || blockingMode === "focusWarning") return;
    if (!matchedRule) return;
    if (
      distractionStatus.lastWarningAt &&
      now - distractionStatus.lastWarningAt < DISTRACTION_WARNING_COOLDOWN_MS
    ) {
      return;
    }

    setDistractionStatus({ lastWarningAt: now });
    triggerFocusWarning();
  } catch (error) {
    setDistractionStatus({
      state: isPermissionError(error) ? "permission-needed" : "error",
      error: error instanceof Error ? error.message : String(error),
      lastCheckedAt: Date.now()
    });
  }
}

function scheduleDistractionDetection(): void {
  if (distractionTimer) {
    clearInterval(distractionTimer);
    distractionTimer = null;
  }
  if (distractionStartupTimer) {
    clearTimeout(distractionStartupTimer);
    distractionStartupTimer = null;
  }

  const settings = getSettings();
  if (!settings.distractionDetectionEnabled) {
    setDistractionStatus({
      state: "idle",
      matchedRule: null,
      error: null
    });
    return;
  }

  setDistractionStatus({
    state: process.platform === "darwin" ? "watching" : "unsupported",
    error: process.platform === "darwin" ? null : "Distraction detection currently supports macOS only."
  });

  if (process.platform !== "darwin") return;

  const firstCheckDelay = focusActive ? Math.max(0, settings.distractionGraceSeconds * 1000) : 0;
  distractionStartupTimer = setTimeout(() => {
    void checkDistractionNow();
    distractionTimer = setInterval(() => void checkDistractionNow(), DISTRACTION_CHECK_INTERVAL_MS);
  }, firstCheckDelay);
}

function resumeLongTermState(): void {
  blockingMode = null;
  hideBubble();
  if (focusActive) {
    setPetState("focusGuard");
    pinToBottomRight();
    sendToAll("app:snapshot", snapshot());
    return;
  }
  setPetState(petParked ? "sitting" : "walking");
  sendToAll("app:snapshot", snapshot());
}

function happyFeedback(message: string = COPY.woof, after?: () => void): void {
  if (blockingMode) return;
  const returnState = focusActive ? "focusGuard" : petParked ? "sitting" : "walking";
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
  ensurePetWindowVisible();
  blockingMode = "break";
  breakDueAt = null;
  publishSnapshot();
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
  ensurePetWindowVisible();
  blockingMode = "hydration";
  hydrationDueAt = null;
  publishSnapshot();
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
  ensurePetWindowVisible();
  if (!focusActive) startFocusMode();
  blockingMode = "focusWarning";
  updateStats((stats) => ({ ...stats, focusWarnings: stats.focusWarnings + 1 }));
  sendToAll("app:snapshot", snapshot());
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
  ensurePetWindowVisible();
  const settings = getSettings();
  focusActive = true;
  focusStartedAt = Date.now();
  blockingMode = null;
  petParked = false;
  store.set("petParked", false);
  setPetState("focusGuard");
  focusEndsAt = Date.now() + settings.focusDurationMinutes * 60 * 1000;
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
  scheduleDistractionDetection();
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
  focusEndsAt = null;
  scheduleDistractionDetection();
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
      setPetState(petParked ? "sitting" : "walking");
    }
  }, 2900);
  updateTrayMenu();
}

function triggerDemo(trigger: DemoTrigger): void {
  ensurePetWindowVisible();
  if (trigger === "break") triggerBreakReminder(true);
  if (trigger === "hydration") triggerHydrationReminder(true);
  if (trigger === "focusWarning") triggerFocusWarning();
  if (trigger === "happy") happyFeedback("woof!");
}

function handleBubbleAction(actionId: string): void {
  if (actionId === "break:done") {
    updateStats((stats) => ({ ...stats, breaksTaken: stats.breaksTaken + 1 }));
    blockingMode = null;
    sendToAll("app:snapshot", snapshot());
    happyFeedback(COPY.breakDone, scheduleReminderTimers);
    return;
  }
  if (actionId === "break:snooze") {
    resumeLongTermState();
    if (breakTimer) clearTimeout(breakTimer);
    breakDueAt = Date.now() + 10 * 60 * 1000;
    breakTimer = setTimeout(() => triggerBreakReminder(false), 10 * 60 * 1000);
    publishSnapshot();
    return;
  }
  if (actionId === "break:mute") {
    breakMutedToday = true;
    breakDueAt = null;
    blockingMode = null;
    sendToAll("app:snapshot", snapshot());
    setPetState("annoyed");
    showBubble({ id: "break-muted", message: COPY.breakIgnore, autoDismissMs: 2600 });
    setTimeout(resumeLongTermState, 2700);
    return;
  }
  if (actionId === "hydration:done") {
    updateStats((stats) => ({ ...stats, watersLogged: stats.watersLogged + 1 }));
    blockingMode = null;
    sendToAll("app:snapshot", snapshot());
    setPetState("drinking");
    showBubble({ id: "hydration-done", message: COPY.hydrationDone, autoDismissMs: 2300 });
    setTimeout(() => happyFeedback(COPY.hydrationDone, scheduleReminderTimers), 2400);
    return;
  }
  if (actionId === "hydration:snooze") {
    resumeLongTermState();
    if (hydrationTimer) clearTimeout(hydrationTimer);
    hydrationDueAt = Date.now() + 15 * 60 * 1000;
    hydrationTimer = setTimeout(() => triggerHydrationReminder(false), 15 * 60 * 1000);
    publishSnapshot();
    return;
  }
  if (actionId === "focus:back") {
    blockingMode = null;
    sendToAll("app:snapshot", snapshot());
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
  ipcMain.on("pet:context-menu", showPetContextMenu);
  ipcMain.on("pet:drag-start", (_event, offset: { offsetX: number; offsetY: number }) =>
    startPetDrag(offset)
  );
  ipcMain.on("pet:drag-stop", stopPetDrag);
  ipcMain.on("pet:resume-walking", resumeWalking);
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
  scheduleDistractionDetection();
  if (IS_DEV) {
    createSettingsWindow();
  }

  app.on("activate", () => {
    if (!petWindow) createPetWindow();
  });
});

app.on("before-quit", () => {
  for (const timer of [
    movementTimer,
    breakTimer,
    hydrationTimer,
    focusTimer,
    distractionTimer,
    distractionStartupTimer,
    idleTimer,
    bubbleTimer,
    dragTimer
  ]) {
    if (timer) clearTimeout(timer);
  }
});

app.on("window-all-closed", () => {
  // Keep the menu-bar utility alive after the settings window is closed.
});
