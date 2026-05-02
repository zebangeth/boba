export type Language = "zh-CN" | "en";

export type PetAppearanceId = "lovartPuppy" | "lineDog";

export type PetFacing = "left" | "right";

export type ChatProviderId =
  | "openai"
  | "gemini"
  | "kimi"
  | "deepseek"
  | "openclaw"
  | "openai-compatible";

export type PetState =
  | "idle"
  | "sitting"
  | "happy"
  | "breakPrompt"
  | "breakRunning"
  | "breakDone"
  | "hydrationPrompt"
  | "drinking"
  | "hydrationDone"
  | "focusGuard"
  | "focusAlert"
  | "focusDone"
  | "sad"
  | "sleeping";

export const COMPANION_AVAILABLE_STATES = [
  "idle",
  "sitting",
  "happy",
  "breakPrompt",
  "breakRunning",
  "breakDone",
  "hydrationPrompt",
  "drinking",
  "hydrationDone",
  "focusGuard",
  "focusAlert",
  "focusDone",
  "sad",
  "sleeping"
] as const satisfies readonly PetState[];

export type BubbleAction = {
  id: string;
  label: string;
  kind?: "primary" | "secondary" | "danger";
};

export type SpeechBubble = {
  id: string;
  message: string;
  actions?: BubbleAction[];
  autoDismissMs?: number;
  dismissible?: boolean;
  input?: {
    placeholder: string;
    submitLabel: string;
    disabled?: boolean;
  };
};

export type BlockingMode = "break" | "breakRun" | "hydration" | "focusWarning" | null;

export type Settings = {
  language: Language;
  petAppearanceId: PetAppearanceId;
  onboardingDismissed: boolean;
  breakReminderEnabled: boolean;
  breakIntervalMinutes: number;
  hydrationReminderEnabled: boolean;
  hydrationIntervalMinutes: number;
  focusDurationMinutes: number;
  distractionDetectionEnabled: boolean;
  distractionGraceSeconds: number;
  distractionBlockedApps: string[];
  distractionBlockedKeywords: string[];
  chatCompanionEnabled: boolean;
  chatProviderId: ChatProviderId;
  chatBaseUrl: string;
  chatApiKey: string;
  chatModel: string;
  chatThinkingPrefix: string;
  chatSystemPrompt: string;
  chatCompanionInactivityMinutes: number;
  chatSessionExpiryHours: number;
};

export type ChatProviderModel = {
  id: string;
  ownedBy?: string;
};

export type ChatProviderModelsResult =
  | {
      ok: true;
      models: ChatProviderModel[];
    }
  | {
      ok: false;
      error: string;
    };

export type TodayStats = {
  date: string;
  breaksTaken: number;
  watersLogged: number;
  focusMinutes: number;
  focusWarnings: number;
};

export type StatsHistory = Record<string, TodayStats>;

export type TimerStatus = {
  breakDueAt: number | null;
  hydrationDueAt: number | null;
  focusEndsAt: number | null;
};

export type DistractionStatus = {
  state: "idle" | "watching" | "permission-needed" | "unsupported" | "error";
  activeApp: string;
  activeWindowTitle: string;
  matchedRule: string | null;
  lastCheckedAt: number | null;
  lastWarningAt: number | null;
  error: string | null;
};

export type CompanionSessionMessage = {
  role: "user" | "assistant";
  content: string;
  state?: PetState;
  createdAt: number;
};

export type CompanionSession = {
  id: string;
  startedAt: number;
  lastActivityAt: number;
  lastState: PetState;
  messages: CompanionSessionMessage[];
  endedAt?: number;
  endReason?: "dismissed" | "expired";
};

export type ChatCompanionDiagnostics = {
  moduleEnabled: boolean;
  session: CompanionSession | null;
  active: boolean;
  conversationRounds: number;
  resetDueAt: number | null;
};

export type AppSnapshot = {
  settings: Settings;
  stats: TodayStats;
  statsHistory: StatsHistory;
  timers: TimerStatus;
  distraction: DistractionStatus;
  petState: PetState;
  petFacing: PetFacing;
  blockingMode: BlockingMode;
  focusActive: boolean;
  pawpalVisible: boolean;
  chatCompanion: ChatCompanionDiagnostics;
};

export type DemoTrigger =
  | "break"
  | "hydration"
  | "focusWarning"
  | "happy";

export type CompanionChatResult =
  | {
      ok: true;
      message: string;
    }
  | {
      ok: false;
      error: string;
    };

export type RendererEventMap = {
  "pet:set-state": PetState;
  "pet:show-bubble": SpeechBubble;
  "pet:hide-bubble": void;
  "settings:updated": Settings;
  "stats:updated": TodayStats;
  "app:snapshot": AppSnapshot;
};
