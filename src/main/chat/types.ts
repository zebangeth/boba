import type { IpcMain } from "electron";
import type { i18n } from "../../shared/i18n";
import type {
  ChatCompanionDiagnostics,
  CompanionSession,
  PetState,
  Settings,
  SpeechBubble
} from "../../shared/types";

export type ChatModuleHost = {
  getSettings: () => Settings;
  text: () => ReturnType<typeof i18n>;
  getSession: () => CompanionSession | undefined;
  setSession: (session: CompanionSession) => void;
  showBubble: (bubble: SpeechBubble) => void;
  hideBubble: () => void;
  ensurePetWindowVisible: () => void;
  setPetState: (state: PetState, options?: { ignoreChatLock?: boolean }) => void;
  fallbackPetState: () => PetState;
  isBlockingMode: () => boolean;
  openSettingsWindow: () => void;
};

export type ChatModule = {
  normalizeSettings: (settings: Settings) => Settings;
  lockedState: () => PetState | null;
  isChatVisible: () => boolean;
  diagnostics: () => ChatCompanionDiagnostics;
  registerIpc: (ipc: IpcMain) => void;
  openChat: () => void;
  hideChat: () => void;
  resetSession: () => void;
  handlePetClick: () => boolean;
  handleBubbleAction: (actionId: string) => boolean;
  interruptForReminder: () => void;
  restoreAfterReminder: () => boolean;
  restoreIfAvailable: () => boolean;
  scheduleTimers: () => void;
  clearTimers: () => void;
};
