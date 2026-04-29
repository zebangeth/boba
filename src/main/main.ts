import { app, BrowserWindow, ipcMain, Menu, screen, Tray } from "electron";
import Store from "electron-store";
import {
  createEmptyStats,
  DEFAULT_SETTINGS,
  todayKey
} from "../shared/constants";
import { i18n, resolveLanguage } from "../shared/i18n";
import { resolvePetAppearanceId } from "../shared/petAppearances";
import type {
  AppSnapshot,
  BlockingMode,
  DistractionStatus,
  DemoTrigger,
  PetFacing,
  PetState,
  Settings,
  SpeechBubble,
  TodayStats
} from "../shared/types";
import {
  APP_NAME,
  BREAK_RUN_DURATION_MS,
  BREAK_RUN_TICK_MS,
  DISTRACTION_CHECK_INTERVAL_MS,
  DISTRACTION_WARNING_COOLDOWN_MS,
  IS_DEV,
  PET_WINDOW,
  PRELOAD_PATH,
  RENDERER_HTML_PATH,
  SETTINGS_WINDOW,
  STORE_NAME
} from "./config";
import { classifyDistraction, isPermissionError, readActiveWindow } from "./distraction";
import { createTrayImage } from "./trayIcon";

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

app.setName(APP_NAME);

const store = new Store<StoreSchema>({
  name: STORE_NAME,
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
let petFacing: PetFacing = "right";
let blockingMode: BlockingMode = null;
let focusActive = false;
let focusStartedAt: number | null = null;
let movementTimer: NodeJS.Timeout | null = null;
let breakRunTimer: NodeJS.Timeout | null = null;
let breakRunCountdownTimer: NodeJS.Timeout | null = null;
let breakRunMovementTimer: NodeJS.Timeout | null = null;
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
let breakRunDirection: 1 | -1 = 1;
let nextBreakRunTurnAt = 0;
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
  const stored = store.get("settings");
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    language: resolveLanguage(stored.language),
    petAppearanceId: resolvePetAppearanceId(stored.petAppearanceId)
  };
}

function text(): ReturnType<typeof i18n> {
  return i18n(getSettings().language);
}

function setSettings(next: Settings): void {
  const normalized = {
    ...next,
    language: resolveLanguage(next.language),
    petAppearanceId: resolvePetAppearanceId(next.petAppearanceId)
  };
  store.set("settings", normalized);
  sendToAll("settings:updated", normalized);
  settingsWindow?.setTitle(`${APP_NAME} ${text().menu.settings}`);
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
    petFacing,
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

function setPetFacing(next: PetFacing): void {
  if (petFacing === next) return;
  petFacing = next;
  publishSnapshot();
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
  return RENDERER_HTML_PATH;
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
    width: PET_WINDOW.width,
    height: PET_WINDOW.height,
    x: Math.round(workArea.x + workArea.width / 2 - PET_WINDOW.width / 2),
    y: workArea.y + workArea.height - PET_WINDOW.height
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
    width: PET_WINDOW.width,
    height: PET_WINDOW.height,
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
    width: SETTINGS_WINDOW.width,
    height: SETTINGS_WINDOW.height,
    title: `${APP_NAME} ${text().menu.settings}`,
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

function createTray(): void {
  tray = new Tray(createTrayImage());
  tray.setTitle(APP_NAME);
  tray.setToolTip(APP_NAME);
  tray.on("click", () => {
    tray?.popUpContextMenu();
  });
  updateTrayMenu();
}

function actionMenuItems(): Electron.MenuItemConstructorOptions[] {
  const dogVisible = Boolean(petWindow?.isVisible());
  const labels = text().menu;
  return [
    {
      label: dogVisible ? labels.hideDog : labels.showDog,
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
      label: focusActive ? labels.stopFocusMode : labels.startFocusMode,
      click: () => {
        if (focusActive) stopFocusMode(true);
        else startFocusMode();
      }
    },
    {
      label: petParked ? labels.resumeWalking : labels.parkDogHere,
      enabled: dogVisible && !focusActive,
      click: () => {
        if (petParked) resumeWalking();
        else parkPetHere();
      }
    },
    { type: "separator" },
    { label: labels.demoBreakReminder, click: () => triggerDemo("break") },
    { label: labels.demoHydrationReminder, click: () => triggerDemo("hydration") },
    { label: labels.demoFocusWarning, click: () => triggerDemo("focusWarning") },
    { label: labels.demoHappyReaction, click: () => triggerDemo("happy") },
    { type: "separator" },
    { label: labels.settings, click: createSettingsWindow },
    { label: labels.resetToday, click: resetTodayStats }
  ];
}

function updateApplicationMenu(): void {
  const labels = text().menu;
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: APP_NAME,
      submenu: [
        ...actionMenuItems(),
        { type: "separator" },
        { role: "quit", label: labels.quit }
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
  const labels = text().menu;
  const template: Electron.MenuItemConstructorOptions[] = [
    { label: APP_NAME, enabled: false },
    { type: "separator" },
    ...actionMenuItems(),
    { type: "separator" },
    {
      label: labels.quit,
      click: () => {
        app.quit();
      }
    }
  ];
  tray.setContextMenu(Menu.buildFromTemplate(template));
}

function showPetContextMenu(): void {
  const labels = text().menu;
  const template: Electron.MenuItemConstructorOptions[] = [
    { label: labels.settings, click: createSettingsWindow },
    {
      label: focusActive ? labels.stopFocusMode : labels.startFocusMode,
      click: () => {
        if (focusActive) stopFocusMode(false);
        else startFocusMode();
      }
    },
    {
      label: petParked ? labels.resumeWalking : labels.parkDogHere,
      enabled: !focusActive,
      click: () => {
        if (petParked) resumeWalking();
        else parkPetHere();
      }
    },
    { type: "separator" },
    { label: labels.demoBreakReminder, click: () => triggerDemo("break") },
    { label: labels.demoHydrationReminder, click: () => triggerDemo("hydration") },
    { label: labels.demoFocusWarning, click: () => triggerDemo("focusWarning") },
    { label: labels.demoHappyReaction, click: () => triggerDemo("happy") },
    { type: "separator" },
    {
      label: labels.hideDog,
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
    x: workArea.x + workArea.width - PET_WINDOW.width - 24,
    y: workArea.y + workArea.height - PET_WINDOW.height,
    width: PET_WINDOW.width,
    height: PET_WINDOW.height
  });
}

function parkPetHere(): void {
  if (!petWindow || petWindow.isDestroyed()) return;
  petParked = true;
  store.set("petParked", true);
  persistPetPosition();
  if (!focusActive && !blockingMode) {
    setPetState("sitting");
    showBubble({ id: "parked", message: text().bubble.parked, autoDismissMs: 1800 });
  }
  updateTrayMenu();
  sendToAll("app:snapshot", snapshot());
}

function resumeWalking(): void {
  petParked = false;
  store.set("petParked", false);
  if (!focusActive && !blockingMode) {
    setPetState("walking");
    showBubble({ id: "resume-walking", message: text().bubble.resumeWalking, autoDismissMs: 1600 });
  }
  updateTrayMenu();
  sendToAll("app:snapshot", snapshot());
}

function movePetWithCursor(): void {
  if (!petWindow || petWindow.isDestroyed()) return;
  const cursor = screen.getCursorScreenPoint();
  const bounds = clampBoundsToWorkArea({
    width: PET_WINDOW.width,
    height: PET_WINDOW.height,
    x: cursor.x - dragOffset.x,
    y: cursor.y - dragOffset.y
  });
  petWindow.setBounds(bounds);
}

function startPetDrag(offset: { offsetX: number; offsetY: number }): void {
  if (blockingMode || !petWindow || petWindow.isDestroyed()) return;
  dragOffset = {
    x: Math.min(Math.max(Math.round(offset.offsetX), 0), PET_WINDOW.width),
    y: Math.min(Math.max(Math.round(offset.offsetY), 0), PET_WINDOW.height)
  };
  if (dragTimer) clearInterval(dragTimer);
  hideBubble();
  setPetState(focusActive ? "focusGuard" : "sitting");
  movePetWithCursor();
  dragTimer = setInterval(movePetWithCursor, 16);
}

function stopPetDrag(): void {
  if (!dragTimer) return;
  clearInterval(dragTimer);
  dragTimer = null;
  if (focusActive) {
    persistPetPosition();
    setPetState("focusGuard");
    sendToAll("app:snapshot", snapshot());
    return;
  }
  parkPetHere();
}

function clearBreakRunTimers(): void {
  if (breakRunTimer) {
    clearTimeout(breakRunTimer);
    breakRunTimer = null;
  }
  if (breakRunCountdownTimer) {
    clearInterval(breakRunCountdownTimer);
    breakRunCountdownTimer = null;
  }
  if (breakRunMovementTimer) {
    clearInterval(breakRunMovementTimer);
    breakRunMovementTimer = null;
  }
}

function showBreakRunCountdown(endsAt: number): void {
  const labels = text();
  const remainingSeconds = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
  showBubble({
    id: "break-run",
    message: labels.bubble.breakRun(remainingSeconds),
    actions: [{ id: "break-run:done", label: labels.actions.breakRunDone, kind: "primary" }]
  });
}

function movePetForBreakRun(): void {
  if (!petWindow || petWindow.isDestroyed() || !petWindow.isVisible()) return;

  const workArea = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
  const bounds = petWindow.getBounds();
  const now = Date.now();
  const minX = workArea.x + 8;
  const maxX = workArea.x + workArea.width - PET_WINDOW.width - 8;

  if (now >= nextBreakRunTurnAt && Math.random() < 0.45) {
    breakRunDirection = breakRunDirection === 1 ? -1 : 1;
  }

  const speed = 9 + Math.round(Math.random() * 10);
  let nextX = bounds.x + breakRunDirection * speed;

  if (nextX <= minX) {
    nextX = minX;
    breakRunDirection = 1;
  }
  if (nextX >= maxX) {
    nextX = maxX;
    breakRunDirection = -1;
  }

  if (now >= nextBreakRunTurnAt) {
    nextBreakRunTurnAt = now + 350 + Math.round(Math.random() * 850);
  }

  setPetFacing(breakRunDirection === 1 ? "right" : "left");
  petWindow.setBounds({
    ...bounds,
    x: nextX,
    y: workArea.y + workArea.height - PET_WINDOW.height
  });
}

function finishBreakRun(): void {
  clearBreakRunTimers();
  blockingMode = null;
  hideBubble();
  showBubble({ id: "break-run-complete", message: text().bubble.breakRunComplete, autoDismissMs: 2200 });
  setPetState("happy");
  setTimeout(() => {
    if (!blockingMode && !focusActive) {
      hideBubble();
      setPetState(petParked ? "sitting" : "walking");
      scheduleReminderTimers();
    }
  }, 2300);
  publishSnapshot();
}

function startBreakRun(): void {
  ensurePetWindowVisible();
  clearBreakRunTimers();
  blockingMode = "breakRun";
  breakDueAt = null;
  petParked = false;
  store.set("petParked", false);
  breakRunDirection = Math.random() < 0.5 ? -1 : 1;
  nextBreakRunTurnAt = Date.now();
  setPetState("breakRunning");
  setPetFacing(breakRunDirection === 1 ? "right" : "left");
  const endsAt = Date.now() + BREAK_RUN_DURATION_MS;
  showBreakRunCountdown(endsAt);
  breakRunCountdownTimer = setInterval(() => showBreakRunCountdown(endsAt), 1000);
  breakRunMovementTimer = setInterval(movePetForBreakRun, BREAK_RUN_TICK_MS);
  breakRunTimer = setTimeout(finishBreakRun, BREAK_RUN_DURATION_MS);
  publishSnapshot();
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
    const maxX = workArea.x + workArea.width - PET_WINDOW.width - 12;

    if (nextX <= minX) {
      nextX = minX;
      walkDirection = 1;
    }
    if (nextX >= maxX) {
      nextX = maxX;
      walkDirection = -1;
    }
    setPetFacing(walkDirection === 1 ? "right" : "left");

    petWindow.setBounds({
      ...bounds,
      x: nextX,
      y: workArea.y + workArea.height - PET_WINDOW.height
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
    error: process.platform === "darwin" ? null : text().system.unsupportedDistraction
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

function happyFeedback(message: string = text().bubble.woof, after?: () => void): void {
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
  if (blockingMode === "focusWarning" || blockingMode === "breakRun") return;
  if (!fromDemo && (focusActive || breakMutedToday)) {
    scheduleReminderTimers();
    return;
  }
  ensurePetWindowVisible();
  blockingMode = "break";
  breakDueAt = null;
  publishSnapshot();
  setPetState("knocking");
  const labels = text();
  showBubble({
    id: "break",
    message: labels.bubble.breakReminder,
    actions: [
      { id: "break:done", label: labels.actions.breakDone, kind: "primary" },
      { id: "break:snooze", label: labels.actions.breakSnooze },
      { id: "break:mute", label: labels.actions.breakMute, kind: "danger" }
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
  const labels = text();
  showBubble({
    id: "hydration",
    message: labels.bubble.hydrationReminder,
    actions: [
      { id: "hydration:done", label: labels.actions.hydrationDone, kind: "primary" },
      { id: "hydration:snooze", label: labels.actions.hydrationSnooze }
    ]
  });
}

function triggerFocusWarning(): void {
  if (blockingMode === "breakRun") return;
  ensurePetWindowVisible();
  if (!focusActive) startFocusMode();
  blockingMode = "focusWarning";
  updateStats((stats) => ({ ...stats, focusWarnings: stats.focusWarnings + 1 }));
  sendToAll("app:snapshot", snapshot());
  setPetState("focusGuard");
  pinToBottomRight();
  const labels = text();
  showBubble({
    id: "focus-warning",
    message: labels.bubble.focusWarning,
    actions: [
      { id: "focus:back", label: labels.actions.focusBack, kind: "primary" },
      { id: "focus:end", label: labels.actions.focusEnd }
    ]
  });
}

function startFocusMode(): void {
  if (focusActive || blockingMode) return;
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
    message: text().bubble.focusStart(settings.focusDurationMinutes),
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
    message: completed ? text().bubble.focusComplete : text().bubble.focusCancelled,
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
  if (trigger === "happy") happyFeedback(text().bubble.woof);
}

function handleBubbleAction(actionId: string): void {
  if (actionId === "break-run:done") {
    finishBreakRun();
    return;
  }
  if (actionId === "break:done") {
    updateStats((stats) => ({ ...stats, breaksTaken: stats.breaksTaken + 1 }));
    startBreakRun();
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
    showBubble({ id: "break-muted", message: text().bubble.breakIgnore, autoDismissMs: 2600 });
    setTimeout(resumeLongTermState, 2700);
    return;
  }
  if (actionId === "hydration:done") {
    updateStats((stats) => ({ ...stats, watersLogged: stats.watersLogged + 1 }));
    blockingMode = null;
    sendToAll("app:snapshot", snapshot());
    setPetState("drinking");
    showBubble({ id: "hydration-done", message: text().bubble.hydrationDone, autoDismissMs: 2300 });
    setTimeout(() => happyFeedback(text().bubble.hydrationDone, scheduleReminderTimers), 2400);
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
    showBubble({ id: "focus-back", message: text().bubble.focusBack, autoDismissMs: 1800 });
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
    happyFeedback(text().bubble.woof);
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
    breakRunTimer,
    breakRunCountdownTimer,
    breakRunMovementTimer,
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
