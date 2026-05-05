import { join, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeTheme,
  net,
  protocol,
  screen,
  shell,
  Tray
} from "electron";
import Store from "electron-store";
import {
  createEmptyStats,
  DEFAULT_SETTINGS,
  todayKey
} from "../shared/constants";
import { i18n, pick, resolveLanguage } from "../shared/i18n";
import { resolvePetAppearanceId } from "../shared/petAppearances";
import type {
  AppSnapshot,
  BlockingMode,
  DistractionStatus,
  DemoTrigger,
  PetFacing,
  PetState,
  Settings,
  StatsHistory,
  SpeechBubble,
  TodayStats,
  UpdateCheckResult
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
  RELEASES_API_URL,
  RELEASES_URL,
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
  statsHistory: StatsHistory;
  petPosition?: PetPosition;
};

app.setName(APP_NAME);

const store = new Store<StoreSchema>({
  name: STORE_NAME,
  defaults: {
    settings: DEFAULT_SETTINGS,
    stats: createEmptyStats(),
    statsHistory: {}
  }
});

let petWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let petState: PetState = "idle";
let petFacing: PetFacing = "right";
let blockingMode: BlockingMode = null;
let focusActive = false;
let focusStartedAt: number | null = null;
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
let bubbleTimer: NodeJS.Timeout | null = null;
let dragTimer: NodeJS.Timeout | null = null;
let dragSafetyTimer: NodeJS.Timeout | null = null;
let breakRunVelocity: PetPosition = { x: 0, y: 0 };
let breakRunFormatter: ((seconds: number) => string) | null = null;
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
let updateCheck: UpdateCheckResult = {
  status: "idle",
  currentVersion: app.getVersion(),
  latestVersion: null,
  releaseUrl: RELEASES_URL,
  checkedAt: null,
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
  applyLaunchAtLoginPreference(normalized.launchAtLoginEnabled);
  store.set("settings", normalized);
  sendToAll("settings:updated", getSettingsWithSystemState());
  settingsWindow?.setTitle(`${APP_NAME} ${text().menu.settings}`);
  scheduleReminderTimers();
  scheduleDistractionDetection();
  updateTrayMenu();
}

function supportsLoginItemSettings(): boolean {
  return (process.platform === "darwin" || process.platform === "win32") && app.isPackaged;
}

function applyLaunchAtLoginPreference(enabled: boolean): void {
  if (!supportsLoginItemSettings()) return;
  app.setLoginItemSettings({
    openAtLogin: enabled,
    openAsHidden: true
  });
}

function getLaunchAtLoginState(fallback: boolean): boolean {
  if (!supportsLoginItemSettings()) return fallback;
  return app.getLoginItemSettings().openAtLogin;
}

function getSettingsWithSystemState(): Settings {
  const settings = getSettings();
  return {
    ...settings,
    launchAtLoginEnabled: getLaunchAtLoginState(settings.launchAtLoginEnabled)
  };
}

function getStatsHistory(): StatsHistory {
  return store.get("statsHistory", {});
}

function isSameStats(left: TodayStats | undefined, right: TodayStats): boolean {
  return Boolean(
    left &&
      left.date === right.date &&
      left.breaksTaken === right.breaksTaken &&
      left.watersLogged === right.watersLogged &&
      left.focusMinutes === right.focusMinutes &&
      left.focusWarnings === right.focusWarnings
  );
}

function saveStatsToHistory(stats: TodayStats): void {
  if (!stats.date) return;
  const history = getStatsHistory();
  if (isSameStats(history[stats.date], stats)) return;
  store.set("statsHistory", {
    ...history,
    [stats.date]: stats
  });
}

function getStats(): TodayStats {
  const today = todayKey();
  const stats = store.get("stats", createEmptyStats());
  if (stats.date !== today) {
    saveStatsToHistory(stats);
    const current = getStatsHistory()[today] ?? createEmptyStats(today);
    store.set("stats", current);
    saveStatsToHistory(current);
    return current;
  }
  saveStatsToHistory(stats);
  return stats;
}

function updateStats(mutator: (stats: TodayStats) => TodayStats): void {
  const next = mutator(getStats());
  store.set("stats", next);
  saveStatsToHistory(next);
  sendToAll("stats:updated", next);
}

function resetTodayStats(): void {
  breakMutedToday = false;
  const reset = createEmptyStats();
  store.set("stats", reset);
  saveStatsToHistory(reset);
  sendToAll("stats:updated", reset);
}

function snapshot(): AppSnapshot {
  return {
    appInfo: {
      version: app.getVersion(),
      releaseNotesUrl: RELEASES_URL
    },
    updateCheck,
    settings: getSettingsWithSystemState(),
    stats: getStats(),
    statsHistory: getStatsHistory(),
    timers: {
      breakDueAt,
      hydrationDueAt,
      focusEndsAt
    },
    distraction: distractionStatus,
    petState,
    petFacing,
    blockingMode,
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

  petWindow.setAlwaysOnTop(true, process.platform === "darwin" ? "floating" : "normal");
  if (process.platform === "darwin") {
    petWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }
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
    stopPetDrag();
    updateTrayMenu();
    publishSnapshot();
  });
  petWindow.on("closed", () => {
    stopPetDrag();
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
    resizable: true,
    minWidth: SETTINGS_WINDOW.width,
    maxWidth: SETTINGS_WINDOW.width,
    minHeight: 400,
    show: false,
    backgroundColor: "#faf6ee",
    ...(process.platform === "darwin"
      ? { titleBarStyle: "hiddenInset" as const, trafficLightPosition: { x: 14, y: 14 } }
      : {}),
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
  tray.setToolTip(APP_NAME);
  tray.on("click", () => {
    tray?.popUpContextMenu();
  });
  if (process.platform !== "darwin") {
    nativeTheme.on("updated", () => tray?.setImage(createTrayImage()));
  }
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
    ...(app.isPackaged
      ? []
      : [
          { type: "separator" as const },
          { label: labels.demoBreakReminder, click: () => triggerDemo("break") },
          { label: labels.demoHydrationReminder, click: () => triggerDemo("hydration") },
          { label: labels.demoFocusWarning, click: () => triggerDemo("focusWarning") },
          { label: labels.demoHappyReaction, click: () => triggerDemo("happy") }
        ]),
    { type: "separator" },
    { label: labels.settings, click: createSettingsWindow }
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
    ...(app.isPackaged
      ? []
      : [
          { type: "separator" as const },
          { label: labels.demoBreakReminder, click: () => triggerDemo("break") },
          { label: labels.demoHydrationReminder, click: () => triggerDemo("hydration") },
          { label: labels.demoFocusWarning, click: () => triggerDemo("focusWarning") },
          { label: labels.demoHappyReaction, click: () => triggerDemo("happy") }
        ]),
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
  if (blockingMode === "breakRun" || !petWindow || petWindow.isDestroyed()) return;
  dragOffset = {
    x: Math.min(Math.max(Math.round(offset.offsetX), 0), PET_WINDOW.width),
    y: Math.min(Math.max(Math.round(offset.offsetY), 0), PET_WINDOW.height)
  };
  if (dragTimer) clearInterval(dragTimer);
  if (dragSafetyTimer) clearTimeout(dragSafetyTimer);
  movePetWithCursor();
  dragTimer = setInterval(movePetWithCursor, 16);
  dragSafetyTimer = setTimeout(stopPetDrag, 15_000);
}

function stopPetDrag(): void {
  const wasDragging = Boolean(dragTimer || dragSafetyTimer);
  if (dragTimer) {
    clearInterval(dragTimer);
    dragTimer = null;
  }
  if (dragSafetyTimer) {
    clearTimeout(dragSafetyTimer);
    dragSafetyTimer = null;
  }
  if (wasDragging) {
    persistPetPosition();
    sendToAll("app:snapshot", snapshot());
  }
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
  const formatter = breakRunFormatter ?? pick(labels.bubble.breakRun);
  showBubble({
    id: "break-run",
    message: formatter(remainingSeconds),
    actions: [{ id: "break-run:done", label: labels.actions.breakRunDone, kind: "primary" }]
  });
}

function chooseBreakRunVelocity(): PetPosition {
  const speed = 3.5 + Math.random() * 2.9;
  const angle = Math.random() * Math.PI * 2;
  return {
    x: Math.cos(angle) * speed,
    y: Math.sin(angle) * speed
  };
}

function movePetForBreakRun(): void {
  if (!petWindow || petWindow.isDestroyed() || !petWindow.isVisible()) return;

  const bounds = petWindow.getBounds();
  const workArea = screen.getDisplayNearestPoint({
    x: bounds.x + Math.round(bounds.width / 2),
    y: bounds.y + Math.round(bounds.height / 2)
  }).workArea;
  const now = Date.now();
  const minX = workArea.x + 8;
  const maxX = workArea.x + workArea.width - PET_WINDOW.width - 8;
  const minY = workArea.y + 8;
  const maxY = workArea.y + workArea.height - PET_WINDOW.height - 8;

  if (now >= nextBreakRunTurnAt && Math.random() < 0.45) {
    breakRunVelocity = chooseBreakRunVelocity();
  }

  let nextX = bounds.x + breakRunVelocity.x;
  let nextY = bounds.y + breakRunVelocity.y;

  if (nextX <= minX) {
    nextX = minX;
    breakRunVelocity.x = Math.abs(breakRunVelocity.x);
  }
  if (nextX >= maxX) {
    nextX = maxX;
    breakRunVelocity.x = -Math.abs(breakRunVelocity.x);
  }
  if (nextY <= minY) {
    nextY = minY;
    breakRunVelocity.y = Math.abs(breakRunVelocity.y);
  }
  if (nextY >= maxY) {
    nextY = maxY;
    breakRunVelocity.y = -Math.abs(breakRunVelocity.y);
  }

  if (now >= nextBreakRunTurnAt) {
    nextBreakRunTurnAt = now + 350 + Math.round(Math.random() * 850);
  }

  setPetFacing(breakRunVelocity.x >= 0 ? "right" : "left");
  petWindow.setBounds({
    ...bounds,
    x: Math.round(nextX),
    y: Math.round(nextY)
  });
}

function finishBreakRun(): void {
  clearBreakRunTimers();
  breakRunFormatter = null;
  blockingMode = null;
  hideBubble();
  showBubble({ id: "break-run-complete", message: pick(text().bubble.breakRunComplete), autoDismissMs: 2200 });
  setPetState("breakDone");
  setTimeout(() => {
    if (!blockingMode && !focusActive) {
      hideBubble();
      setPetState("idle");
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
  breakRunFormatter = pick(text().bubble.breakRun);
  breakRunVelocity = chooseBreakRunVelocity();
  nextBreakRunTurnAt = Date.now();
  setPetState("breakRunning");
  setPetFacing(breakRunVelocity.x >= 0 ? "right" : "left");
  const endsAt = Date.now() + BREAK_RUN_DURATION_MS;
  showBreakRunCountdown(endsAt);
  breakRunCountdownTimer = setInterval(() => showBreakRunCountdown(endsAt), 1000);
  breakRunMovementTimer = setInterval(movePetForBreakRun, BREAK_RUN_TICK_MS);
  breakRunTimer = setTimeout(finishBreakRun, BREAK_RUN_DURATION_MS);
  publishSnapshot();
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
    triggerFocusWarning(matchedRule.replace(/^(app|keyword):/, ""));
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
    sendToAll("app:snapshot", snapshot());
    return;
  }
  setPetState("idle");
  sendToAll("app:snapshot", snapshot());
}

function happyFeedback(message: string | null = pick(text().bubble.woof), after?: () => void): void {
  if (blockingMode) return;
  const returnState = focusActive ? "focusGuard" : "idle";
  setPetState("happy");
  if (message) {
    showBubble({ id: "happy", message, autoDismissMs: 1800 });
  }
  setTimeout(() => {
    hideBubble();
    setPetState(returnState);
    after?.();
  }, 1900);
}

function normalizeVersion(version: string): string {
  return version.trim().replace(/^v/i, "");
}

function compareVersions(left: string, right: string): number {
  const [leftCore, leftPreRelease = ""] = normalizeVersion(left).split("-", 2);
  const [rightCore, rightPreRelease = ""] = normalizeVersion(right).split("-", 2);
  const leftParts = leftCore.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const rightParts = rightCore.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const leftPart = leftParts[index] ?? 0;
    const rightPart = rightParts[index] ?? 0;
    if (leftPart > rightPart) return 1;
    if (leftPart < rightPart) return -1;
  }

  if (!leftPreRelease && rightPreRelease) return 1;
  if (leftPreRelease && !rightPreRelease) return -1;
  return leftPreRelease.localeCompare(rightPreRelease);
}

function isGitHubReleasePayload(value: unknown): value is {
  tag_name?: unknown;
  html_url?: unknown;
  name?: unknown;
} {
  return typeof value === "object" && value !== null;
}

function setUpdateCheck(next: UpdateCheckResult): void {
  updateCheck = next;
  publishSnapshot();
}

function openReleaseNotes(): void {
  void shell.openExternal(updateCheck.releaseUrl || RELEASES_URL).catch((error) => {
    console.error("Failed to open PawPal releases:", error);
  });
}

function showUpdateAvailableNotice(result: UpdateCheckResult): void {
  if (blockingMode || result.status !== "available" || !result.latestVersion) return;
  ensurePetWindowVisible();
  setPetState("happy");
  showBubble({
    id: "update-available",
    message: pick(text().bubble.updateAvailable)(result.latestVersion),
    actions: [
      { id: "app:open-release-notes", label: text().settings.openReleaseNotes, kind: "primary" }
    ],
    autoDismissMs: 12000
  });
  setTimeout(() => {
    if (!blockingMode && petState === "happy") setPetState(focusActive ? "focusGuard" : "idle");
  }, 12_100);
}

async function checkForUpdates(options: { notifyAvailable?: boolean } = {}): Promise<UpdateCheckResult> {
  setUpdateCheck({
    ...updateCheck,
    status: "checking",
    currentVersion: app.getVersion(),
    checkedAt: Date.now(),
    error: null
  });

  try {
    const response = await net.fetch(RELEASES_API_URL, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": `${APP_NAME}/${app.getVersion()}`
      }
    });

    if (!response.ok) {
      throw new Error(`GitHub returned ${response.status}`);
    }

    const payload: unknown = await response.json();
    if (!isGitHubReleasePayload(payload)) {
      throw new Error("Unexpected release response");
    }

    const latestVersion =
      typeof payload.tag_name === "string"
        ? payload.tag_name
        : typeof payload.name === "string"
          ? payload.name
          : "";

    if (!latestVersion) {
      throw new Error("Latest release has no version tag");
    }

    const releaseUrl = typeof payload.html_url === "string" ? payload.html_url : RELEASES_URL;
    const currentVersion = app.getVersion();
    const result: UpdateCheckResult = {
      status: compareVersions(latestVersion, currentVersion) > 0 ? "available" : "up-to-date",
      currentVersion,
      latestVersion,
      releaseUrl,
      checkedAt: Date.now(),
      error: null
    };

    setUpdateCheck(result);
    if (options.notifyAvailable) showUpdateAvailableNotice(result);
    return result;
  } catch (error) {
    const result: UpdateCheckResult = {
      ...updateCheck,
      status: "error",
      currentVersion: app.getVersion(),
      checkedAt: Date.now(),
      error: error instanceof Error ? error.message : String(error)
    };
    setUpdateCheck(result);
    return result;
  }
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
  setPetState("breakPrompt");
  const labels = text();
  showBubble({
    id: "break",
    message: pick(labels.bubble.breakReminder),
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
  setPetState("hydrationPrompt");
  const labels = text();
  showBubble({
    id: "hydration",
    message: pick(labels.bubble.hydrationReminder),
    actions: [
      { id: "hydration:done", label: labels.actions.hydrationDone, kind: "primary" },
      { id: "hydration:snooze", label: labels.actions.hydrationSnooze }
    ]
  });
}

function triggerFocusWarning(rule?: string): void {
  if (blockingMode === "breakRun") return;
  ensurePetWindowVisible();
  if (!focusActive) startFocusMode();
  blockingMode = "focusWarning";
  updateStats((stats) => ({ ...stats, focusWarnings: stats.focusWarnings + 1 }));
  setPetState("focusAlert");
  sendToAll("app:snapshot", snapshot());
  const labels = text();
  showBubble({
    id: "focus-warning",
    message: pick(labels.bubble.focusWarning)(rule ?? "?"),
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
  setPetState("focusGuard");
  focusEndsAt = Date.now() + settings.focusDurationMinutes * 60 * 1000;
  sendToAll("app:snapshot", snapshot());
  showBubble({
    id: "focus-start",
    message: pick(text().bubble.focusStart)(settings.focusDurationMinutes),
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
  setPetState("focusDone");
  showBubble({
    id: "focus-complete",
    message: completed ? pick(text().bubble.focusComplete) : pick(text().bubble.focusCancelled),
    autoDismissMs: 2800
  });
  setTimeout(() => {
    if (!focusActive && !blockingMode) {
      hideBubble();
      setPetState("idle");
    }
  }, 2900);
  updateTrayMenu();
}

function triggerDemo(trigger: DemoTrigger): void {
  ensurePetWindowVisible();
  if (trigger === "break") triggerBreakReminder(true);
  if (trigger === "hydration") triggerHydrationReminder(true);
  if (trigger === "focusWarning") triggerFocusWarning("Twitter");
  if (trigger === "happy") happyFeedback(pick(text().bubble.woof));
}

function handleBubbleAction(actionId: string): void {
  if (actionId === "app:open-release-notes") {
    hideBubble();
    setPetState(focusActive ? "focusGuard" : "idle");
    openReleaseNotes();
    return;
  }
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
    setPetState("sad");
    showBubble({ id: "break-muted", message: pick(text().bubble.breakIgnore), autoDismissMs: 2600 });
    setTimeout(resumeLongTermState, 2700);
    return;
  }
  if (actionId === "hydration:done") {
    updateStats((stats) => ({ ...stats, watersLogged: stats.watersLogged + 1 }));
    blockingMode = null;
    sendToAll("app:snapshot", snapshot());
    setPetState("drinking");
    hideBubble();
    setTimeout(() => {
      if (blockingMode) return;
      setPetState("hydrationDone");
      showBubble({ id: "hydration-complete", message: pick(text().bubble.hydrationDone), autoDismissMs: 1800 });
      setTimeout(() => {
        hideBubble();
        setPetState(focusActive ? "focusGuard" : "idle");
        scheduleReminderTimers();
      }, 1900);
    }, 2400);
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
    showBubble({ id: "focus-back", message: pick(text().bubble.focusBack), autoDismissMs: 1800 });
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
  ipcMain.handle("app:check-for-updates", () => checkForUpdates({ notifyAvailable: true }));
  ipcMain.on("app:open-release-notes", openReleaseNotes);
  ipcMain.on("pet:clicked", () => {
    if (blockingMode) return;
    happyFeedback(null);
  });
  ipcMain.on("pet:context-menu", showPetContextMenu);
  ipcMain.on("pet:drag-start", (_event, offset: { offsetX: number; offsetY: number }) =>
    startPetDrag(offset)
  );
  ipcMain.on("pet:drag-stop", stopPetDrag);
  ipcMain.on("bubble:action", (_event, actionId: string) => handleBubbleAction(actionId));
  ipcMain.on("settings:update", (_event, partial: Partial<Settings>) => {
    setSettings({ ...getSettings(), ...partial });
  });
  ipcMain.on("demo:trigger", (_event, trigger: DemoTrigger) => triggerDemo(trigger));
  ipcMain.on("focus:start", startFocusMode);
  ipcMain.on("focus:stop", () => stopFocusMode(false));
  ipcMain.on("stats:reset-today", resetTodayStats);
}

protocol.registerSchemesAsPrivileged([
  { scheme: "pawpal-asset", privileges: { bypassCSP: true, supportFetchAPI: true } }
]);

app.whenReady().then(() => {
  protocol.handle("pawpal-asset", (request) => {
    let relativePath = "";
    try {
      const url = new URL(request.url);
      relativePath = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
    } catch {
      return new Response("Invalid asset URL", { status: 404 });
    }

    const base = app.isPackaged ? process.resourcesPath : process.cwd();
    const assetRoot = resolve(base, "pet_assets");
    const assetPath = resolve(base, relativePath);
    const isInsideAssetRoot = assetPath === assetRoot || assetPath.startsWith(`${assetRoot}${sep}`);

    if (!isInsideAssetRoot) {
      return new Response("Asset not found", { status: 404 });
    }

    return net.fetch(pathToFileURL(assetPath).href);
  });

  getStats();
  registerIpc();
  createPetWindow();
  createTray();
  scheduleReminderTimers();
  scheduleDistractionDetection();
  if (IS_DEV) {
    createSettingsWindow();
  }
  if (getSettings().checkUpdatesOnLaunchEnabled) {
    setTimeout(() => void checkForUpdates({ notifyAvailable: true }), 1500);
  }

  app.on("activate", () => {
    if (!petWindow) createPetWindow();
  });
});

app.on("before-quit", () => {
  for (const timer of [
    breakRunTimer,
    breakRunCountdownTimer,
    breakRunMovementTimer,
    breakTimer,
    hydrationTimer,
    focusTimer,
    distractionTimer,
    distractionStartupTimer,
    bubbleTimer,
    dragTimer,
    dragSafetyTimer
  ]) {
    if (timer) clearTimeout(timer);
  }
});

app.on("window-all-closed", () => {
  // Keep the menu-bar utility alive after the settings window is closed.
});
